package backend.service;

import backend.model.Driver;
import backend.model.LapTelemetry;
import backend.model.PitStop;
import backend.model.Race;
import backend.model.RaceResult;
import backend.model.WeatherCondition;
import backend.model.enums.RaceStatus;
import backend.model.enums.TyreType;
import backend.model.enums.WeatherType;
import backend.repository.DriverRepository;
import backend.repository.LapTelemetryRepository;
import backend.repository.PitStopRepository;
import backend.repository.RaceRepository;
import backend.repository.RaceResultRepository;
import backend.repository.WeatherConditionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class OpenF1SyncService {

    private final RaceRepository raceRepo;
    private final RaceResultRepository raceResultRepo;
    private final DriverRepository driverRepo;
    private final NotificationService notificationService;
    private final PitStopRepository pitStopRepo;
    private final LapTelemetryRepository lapTelemetryRepo;
    private final WeatherConditionRepository weatherConditionRepo;

    private static final String JOLPICA_BASE = "https://api.jolpi.ca/ergast/f1";
    private static final String OPENF1_BASE = "https://api.openf1.org/v1";

    private final RestTemplate restTemplate;

    private static final int[] SPRINT_POINTS = {8, 7, 6, 5, 4, 3, 2, 1};
    private static final int[] RACE_POINTS = {25, 18, 15, 12, 10, 8, 6, 4, 2, 1};

    private static final Map<Integer, Integer> DB_TO_JOLPICA_ROUND = Map.of(
            1, 1,
            2, 2,
            3, 3,
            4, -1,
            5, -1,
            6, 4,
            7, 5,
            8, 6,
            9, 7
    );

    @Scheduled(fixedRate = 3600000)
    public void autoSyncCompletedRaces() {
        log.info("🔄 [Sync] Auto-sync checking for completed races...");
        try {
            syncRecentSessions();
        } catch (Exception e) {
            log.error("[Sync] Auto-sync failed: {}", e.getMessage());
        }
    }

    public Map<String, Object> syncRecentSessions() {
        Map<String, Object> summary = new LinkedHashMap<>();
        List<String> synced = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        List<Race> races = raceRepo.findBySeasonOrderByRoundNumber(2026);

        for (Race race : races) {
            if (race.getStatus() == RaceStatus.CANCELLED) {
                skipped.add(race.getName() + " (cancelled)");
                continue;
            }

            if (raceResultRepo.existsByRaceId(race.getId())) {
                skipped.add(race.getName() + " (already synced)");
                continue;
            }

            if (race.getDate() != null && race.getDate().isAfter(LocalDate.now())) {
                skipped.add(race.getName() + " (not yet raced)");
                continue;
            }

            String label = race.getName();
            try {
                sleep(1200);
                boolean isSprint = race.getName().toLowerCase().contains("sprint");
                boolean result = syncRaceByRound(race, isSprint);
                if (result) synced.add(label);
                else skipped.add(label + " (no data from Jolpica)");
            } catch (Exception e) {
                errors.add(label + ": " + e.getMessage());
                log.warn("[Sync] Failed to sync {}: {}", label, e.getMessage());
            }
        }

        summary.put("synced", synced);
        summary.put("skipped", skipped);
        summary.put("errors", errors);
        summary.put("total", synced.size());
        return summary;
    }

    @Transactional
    public boolean syncRaceByRound(Race race, boolean isSprint) {
        int dbRound = race.getRoundNumber();
        if (dbRound <= 0) return false;


        int round;
        if (DB_TO_JOLPICA_ROUND.containsKey(dbRound)) {
            round = DB_TO_JOLPICA_ROUND.get(dbRound);
            if (round == -1) {
                log.debug("[Sync] Skipping cancelled race: {}", race.getName());
                return false;
            }
        } else {

            round = dbRound - 2;
        }

        List<Driver> allDrivers = driverRepo.findAll();

        try {

            String endpoint = isSprint ? "/sprint" : "/results";
            String url = JOLPICA_BASE + "/2026/" + round + endpoint + ".json";
            log.info("[Sync] Fetching {} from: {}", race.getName(), url);

            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response == null) return false;

            Map<String, Object> mrData = (Map<String, Object>) response.get("MRData");
            if (mrData == null) return false;

            Map<String, Object> raceTable = (Map<String, Object>) mrData.get("RaceTable");
            if (raceTable == null) return false;

            List<Map<String, Object>> raceList = (List<Map<String, Object>>) raceTable.get("Races");
            if (raceList == null || raceList.isEmpty()) return false;

            String resultKey = isSprint ? "SprintResults" : "Results";
            List<Map<String, Object>> raceResults = (List<Map<String, Object>>) raceList.get(0).get(resultKey);
            if (raceResults == null || raceResults.isEmpty()) return false;

            int[] pointsSystem = isSprint ? SPRINT_POINTS : RACE_POINTS;
            List<RaceResult> results = new ArrayList<>();

            for (Map<String, Object> r : raceResults) {
                Integer position = toInt(r.get("position"));
                String status = String.valueOf(r.getOrDefault("status", "Finished"));

                Map<String, Object> driverMap = (Map<String, Object>) r.get("Driver");
                if (driverMap == null) continue;

                String givenName = String.valueOf(driverMap.getOrDefault("givenName", ""));
                String familyName = String.valueOf(driverMap.getOrDefault("familyName", ""));
                String fullName = (givenName + " " + familyName).trim();

                Optional<Driver> driverOpt = findDriver(fullName, allDrivers);
                if (driverOpt.isEmpty()) {
                    log.debug("[Sync] Driver not found: {}", fullName);
                    continue;
                }


                float points = 0;
                try {
                    points = Float.parseFloat(String.valueOf(r.getOrDefault("points", "0")));
                } catch (Exception e) {
                    if (position != null && position >= 1 && position <= pointsSystem.length) {
                        points = pointsSystem[position - 1];
                    }
                }


                boolean hasFastestLap = false;
                if (!isSprint) {
                    try {
                        Map<String, Object> fastestLap = (Map<String, Object>) r.get("FastestLap");
                        if (fastestLap != null) {
                            hasFastestLap = "1".equals(String.valueOf(fastestLap.getOrDefault("rank", "")));
                        }
                    } catch (Exception ignored) {}
                }

                boolean isDnf = !status.equals("Finished") && !status.startsWith("+");
                int finishPos = (position != null) ? position : 0;
                if (isDnf) finishPos = 0;

                Integer grid = toInt(r.get("grid"));
                int startPos = (grid != null && grid > 0) ? grid : finishPos;

                results.add(RaceResult.builder()
                        .race(race)
                        .driver(driverOpt.get())
                        .finishPosition(finishPos)
                        .startPosition(startPos)
                        .points(points)
                        .hasFastestLap(hasFastestLap)
                        .dnfReason(isDnf ? status : null)
                        .build());
            }

            if (results.isEmpty()) return false;

            raceResultRepo.saveAll(results);
            race.setStatus(RaceStatus.COMPLETED);
            raceRepo.save(race);

            results.stream()
                    .filter(r -> r.getFinishPosition() == 1 && r.getDnfReason() == null)
                    .findFirst()
                    .ifPresent(winner -> notificationService.notifyRaceResult(
                            race.getName() + (isSprint ? " (Sprint)" : ""),
                            winner.getDriver().getName(),
                            winner.getDriver().getTeam() != null ? winner.getDriver().getTeam().getName() : ""
                    ));

            log.info("✅ [Sync] Synced {} — {} results via Jolpica", race.getName(), results.size());
            return true;

        } catch (Exception e) {
            log.warn("[Sync] Jolpica failed for {} (DB round={}, Jolpica round={}): {}", race.getName(), dbRound, round, e.getMessage());
            return false;
        }
    }


    @Transactional
    public boolean syncSession(int sessionKey, String countryName, boolean isSprint) {
        List<Race> races = raceRepo.findBySeasonOrderByRoundNumber(2026);
        Optional<Race> raceOpt = races.stream()
                .filter(r -> {
                    String name = r.getName().toLowerCase();
                    String country = countryName.toLowerCase();
                    boolean nameMatch = name.contains(country) ||
                            (country.equals("china") && name.contains("chinese")) ||
                            (country.equals("united states") && (name.contains("miami") || name.contains("austin"))) ||
                            (country.equals("great britain") && name.contains("british")) ||
                            (country.equals("united arab emirates") && name.contains("abu dhabi")) ||
                            (country.equals("brazil") && (name.contains("brazil") || name.contains("paulo")));
                    boolean typeMatch = isSprint ? name.contains("sprint") : !name.contains("sprint");
                    return nameMatch && typeMatch;
                })
                .findFirst();

        if (raceOpt.isEmpty()) {
            log.warn("[Sync] No race found for country={} sprint={}", countryName, isSprint);
            return false;
        }
        return syncRaceByRound(raceOpt.get(), isSprint);
    }

    // ─── Sync Pit Stops from OpenF1 ──────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    @Transactional
    public void syncPitStops(int sessionKey, Race race) {
        try {
            String url = OPENF1_BASE + "/stints?session_key=" + sessionKey;
            List<Map<String, Object>> stints = restTemplate.getForObject(url, List.class);
            if (stints == null || stints.isEmpty()) {
                log.debug("[Sync] No stints data for session {}", sessionKey);
                return;
            }

            List<RaceResult> raceResults = raceResultRepo.findByRaceIdOrderByFinishPosition(race.getId());
            Map<Integer, RaceResult> resultsByCarNumber = new HashMap<>();
            for (RaceResult rr : raceResults) {
                if (rr.getDriver() != null) {
                    resultsByCarNumber.put(rr.getDriver().getCarNumber(), rr);
                }
            }

            List<PitStop> pitStops = new ArrayList<>();
            for (Map<String, Object> stint : stints) {
                Integer driverNumber = toInt(stint.get("driver_number"));
                Integer lapStart = toInt(stint.get("lap_start"));
                String compound = String.valueOf(stint.getOrDefault("compound", ""));

                if (driverNumber == null || lapStart == null) continue;

                RaceResult raceResult = resultsByCarNumber.get(driverNumber);
                if (raceResult == null) {
                    log.warn("[Sync] No race result found for driver number {} in session {}", driverNumber, sessionKey);
                    continue;
                }

                TyreType tyreOut = mapCompoundToTyreType(compound);

                pitStops.add(PitStop.builder()
                        .lapNumber(lapStart)
                        .durationSec(0f) // not available from stints endpoint
                        .tyreOut(tyreOut)
                        .crewSize(0) // not available
                        .underSafetyCar(false) // not available
                        .raceResult(raceResult)
                        .build());
            }

            if (!pitStops.isEmpty()) {
                pitStopRepo.saveAll(pitStops);
                log.info("✅ [Sync] Synced {} pit stops for session {}", pitStops.size(), sessionKey);
            }
        } catch (Exception e) {
            log.warn("[Sync] Failed to sync pit stops for session {}: {}", sessionKey, e.getMessage());
        }
    }

    // ─── Sync Lap Times from OpenF1 ──────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    @Transactional
    public void syncLapTimes(int sessionKey, Race race) {
        try {
            String url = OPENF1_BASE + "/laps?session_key=" + sessionKey;
            List<Map<String, Object>> laps = restTemplate.getForObject(url, List.class);
            if (laps == null || laps.isEmpty()) {
                log.debug("[Sync] No laps data for session {}", sessionKey);
                return;
            }

            List<RaceResult> raceResults = raceResultRepo.findByRaceIdOrderByFinishPosition(race.getId());
            Map<Integer, RaceResult> resultsByCarNumber = new HashMap<>();
            for (RaceResult rr : raceResults) {
                if (rr.getDriver() != null) {
                    resultsByCarNumber.put(rr.getDriver().getCarNumber(), rr);
                }
            }

            List<LapTelemetry> telemetries = new ArrayList<>();
            for (Map<String, Object> lap : laps) {
                Integer driverNumber = toInt(lap.get("driver_number"));
                Integer lapNumber = toInt(lap.get("lap_number"));
                Object lapDuration = lap.get("lap_duration");

                if (driverNumber == null || lapNumber == null || lapDuration == null) continue;

                float lapTimeSec = ((Number) lapDuration).floatValue();
                if (lapTimeSec <= 0 || lapTimeSec > 600) continue;

                RaceResult raceResult = resultsByCarNumber.get(driverNumber);
                if (raceResult == null) {
                    log.warn("[Sync] No race result found for driver number {} in session {}", driverNumber, sessionKey);
                    continue;
                }

                telemetries.add(LapTelemetry.builder()
                        .lapNumber(lapNumber)
                        .lapTimeSec(lapTimeSec)
                        .speedKmh(0f)    // not available from laps endpoint
                        .rpm(0)           // not available
                        .gear(0)          // not available
                        .throttlePct(0f)  // not available
                        .brakePct(0f)     // not available
                        .drsActive(false) // not available
                        .fuelLoad(0f)     // not available
                        .raceResult(raceResult)
                        .build());
            }

            if (!telemetries.isEmpty()) {
                lapTelemetryRepo.saveAll(telemetries);
                log.info("✅ [Sync] Synced {} lap telemetries for session {}", telemetries.size(), sessionKey);
            }
        } catch (Exception e) {
            log.warn("[Sync] Failed to sync lap times for session {}: {}", sessionKey, e.getMessage());
        }
    }

    // ─── Sync Weather from OpenF1 ────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    @Transactional
    public void syncWeather(int sessionKey, Race race) {
        try {
            String url = OPENF1_BASE + "/weather?session_key=" + sessionKey;
            List<Map<String, Object>> weatherData = restTemplate.getForObject(url, List.class);
            if (weatherData == null || weatherData.isEmpty()) {
                log.debug("[Sync] No weather data for session {}", sessionKey);
                return;
            }

            List<WeatherCondition> conditions = new ArrayList<>();
            for (Map<String, Object> w : weatherData) {
                Object airTemp = w.get("air_temperature");
                Object trackTemp = w.get("track_temperature");
                Object humidity = w.get("humidity");
                Object windSpeed = w.get("wind_speed");
                Object rainfall = w.get("rainfall");

                if (airTemp == null || trackTemp == null) continue;

                WeatherType weatherType = (rainfall instanceof Boolean && (Boolean) rainfall)
                        ? WeatherType.WET : WeatherType.DRY;

                conditions.add(WeatherCondition.builder()
                        .airTempC(((Number) airTemp).floatValue())
                        .trackTempC(((Number) trackTemp).floatValue())
                        .humidityPct(humidity != null ? ((Number) humidity).floatValue() : 0f)
                        .windSpeedKmh(windSpeed != null ? ((Number) windSpeed).floatValue() : 0f)
                        .condition(weatherType)
                        .race(race)
                        .build());
            }

            if (!conditions.isEmpty()) {
                weatherConditionRepo.saveAll(conditions);
                log.info("✅ [Sync] Synced {} weather records for session {}", conditions.size(), sessionKey);
            }
        } catch (Exception e) {
            log.warn("[Sync] Failed to sync weather for session {}: {}", sessionKey, e.getMessage());
        }
    }

    private TyreType mapCompoundToTyreType(String compound) {
        if (compound == null) return null;
        return switch (compound.toUpperCase()) {
            case "SOFT" -> TyreType.SOFT;
            case "MEDIUM" -> TyreType.MEDIUM;
            case "HARD" -> TyreType.HARD;
            case "INTERMEDIATE" -> TyreType.INTERMEDIATE;
            case "WET" -> TyreType.WET;
            default -> null;
        };
    }

    private Optional<Driver> findDriver(String fullName, List<Driver> allDrivers) {
        // Normalize diacritics so Jolpica names (Hülkenberg, Pérez) match DB names without accents
        String fName = stripAccents(fullName);
        String[] fParts = fName.split(" ");
        String fLast = fParts.length > 0 ? fParts[fParts.length - 1] : "";

        return allDrivers.stream()
                .filter(d -> {
                    String dName = stripAccents(d.getName());
                    String[] dParts = dName.split(" ");
                    String dLast = dParts.length > 0 ? dParts[dParts.length - 1] : "";
                    return dName.equals(fName) || dLast.equals(fLast) ||
                            dName.contains(fLast) || fName.contains(dLast);
                })
                .findFirst();
    }

    public static String stripAccents(String s) {
        // NFKD decomposes most accented chars (ñ, é, ü, ç, etc.) but NOT
        // precomposed letter-strokes/ligatures like ø, æ, œ, ł, đ, ß.
        // Apply known mappings first, then NFKD for remaining diacritics.
        String result = s
                .replace("ø", "o").replace("Ø", "O")
                .replace("æ", "ae").replace("Æ", "AE")
                .replace("œ", "oe").replace("Œ", "OE")
                .replace("ß", "ss")
                .replace("ł", "l").replace("Ł", "L")
                .replace("đ", "d").replace("Đ", "D");
        return java.text.Normalizer.normalize(result, java.text.Normalizer.Form.NFKD)
                .replaceAll("\\p{M}", "")
                .toLowerCase();
    }

    private Integer toInt(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).intValue();
        try { return Integer.parseInt(o.toString().trim()); } catch (Exception e) { return null; }
    }

    private void sleep(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }
}
