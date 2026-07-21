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

    private static final String OPENF1_BASE = "https://api.openf1.org/v1";

    private final RestTemplate restTemplate;

    private static final int[] SPRINT_POINTS = {8, 7, 6, 5, 4, 3, 2, 1};
    private static final int[] RACE_POINTS = {25, 18, 15, 12, 10, 8, 6, 4, 2, 1};

    /** Maps OpenF1 circuit_short_name → DB Circuit.name for session-key lookups. */
    private static final Map<String, String> OPENF1_CIRCUIT_TO_DB = Map.ofEntries(
            Map.entry("Melbourne", "Albert Park Circuit"),
            Map.entry("Shanghai", "Shanghai International Circuit"),
            Map.entry("Suzuka", "Suzuka International Racing Course"),
            Map.entry("Sakhir", "Bahrain International Circuit"),
            Map.entry("Jeddah", "Jeddah Corniche Circuit"),
            Map.entry("Miami", "Miami International Autodrome"),
            Map.entry("Montreal", "Circuit Gilles-Villeneuve"),
            Map.entry("Monte Carlo", "Circuit de Monaco"),
            Map.entry("Catalunya", "Circuit de Barcelona-Catalunya"),
            Map.entry("Spielberg", "Red Bull Ring"),
            Map.entry("Silverstone", "Silverstone Circuit"),
            Map.entry("Spa-Francorchamps", "Circuit de Spa-Francorchamps"),
            Map.entry("Hungaroring", "Hungaroring"),
            Map.entry("Zandvoort", "Circuit Zandvoort"),
            Map.entry("Monza", "Autodromo Nazionale Monza"),
            Map.entry("Madring", "Madring Circuit"),
            Map.entry("Baku", "Baku City Circuit"),
            Map.entry("Singapore", "Marina Bay Street Circuit"),
            Map.entry("Austin", "Circuit of the Americas"),
            Map.entry("Mexico City", "Autodromo Hermanos Rodriguez"),
            Map.entry("Interlagos", "Interlagos Circuit"),
            Map.entry("Las Vegas", "Las Vegas Strip Circuit"),
            Map.entry("Lusail", "Lusail International Circuit"),
            Map.entry("Yas Marina Circuit", "Yas Marina Circuit")
    );

    // ─── Auto-sync (every 30 min) ──────────────────────────────────────────────

    @Scheduled(fixedRate = 1_800_000)
    public void autoSyncCompletedRaces() {
        log.info("🔄 [AutoSync] Checking for completed races...");
        try {
            syncRecentSessions();
        } catch (Exception e) {
            log.error("[AutoSync] Race results sync failed: {}", e.getMessage());
        }
    }

    // ─── Batch sync ────────────────────────────────────────────────────────────

    public Map<String, Object> syncRecentSessions() {
        Map<String, Object> summary = new LinkedHashMap<>();
        List<String> synced = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        List<Race> races = raceRepo.findAllByOrderBySeasonDescRoundNumberAsc();

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
                sleep(800);
                boolean isSprint = race.getName().toLowerCase().contains("sprint");
                boolean result = syncRaceByRound(race, isSprint);
                if (result) synced.add(label);
                else skipped.add(label + " (no data available)");
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

    // ─── Race Results: OpenF1 first, Jolpica fallback ──────────────────────────

    @Transactional
    public boolean syncRaceByRound(Race race, boolean isSprint) {
        // 1) Try OpenF1 (fast, near-real-time)
        try {
            boolean ok = syncRaceResultsFromOpenF1(race, isSprint);
            if (ok) {
                race.setStatus(RaceStatus.COMPLETED);
                raceRepo.save(race);
                return true;
            }
        } catch (Exception e) {
            log.debug("[Sync] OpenF1 race sync failed for {}: {}", race.getName(), e.getMessage());
        }

        // 2) Fallback to Jolpica (slower, curated)
        return syncRaceByRoundViaJolpica(race, isSprint);
    }

    /**
     * Syncs race results from OpenF1 position + laps data.
     * Matches drivers by car number (driver_number in OpenF1 = carNumber in DB).
     */
    @SuppressWarnings("unchecked")
    @Transactional
    public boolean syncRaceResultsFromOpenF1(Race race, boolean isSprint) {
        String sessionType = isSprint ? "Race" : "Race"; // OpenF1 uses "Race" for both, Sprint has session_name="Sprint"
        Optional<Integer> keyOpt = findSessionKey(race, sessionType, isSprint);
        if (keyOpt.isEmpty()) {
            log.debug("[OpenF1] No session key for {} (sprint={})", race.getName(), isSprint);
            return false;
        }
        int sessionKey = keyOpt.get();

        // ── Position data → finish order ───────────────────────────────────
        String posUrl = OPENF1_BASE + "/position?session_key=" + sessionKey;
        List<Map<String, Object>> positions = restTemplate.getForObject(posUrl, List.class);
        if (positions == null || positions.isEmpty()) {
            log.debug("[OpenF1] No position data for {} (session={})", race.getName(), sessionKey);
            return false;
        }

        // Take the last position entry per driver
        Map<Integer, Integer> finishPositions = new LinkedHashMap<>();
        Map<Integer, String> lastTimestamps = new HashMap<>();
        for (Map<String, Object> p : positions) {
            Integer dn = toInt(p.get("driver_number"));
            Integer pos = toInt(p.get("position"));
            String date = String.valueOf(p.getOrDefault("date", ""));
            if (dn == null || pos == null) continue;
            if (lastTimestamps.get(dn) == null || date.compareTo(lastTimestamps.get(dn)) > 0) {
                lastTimestamps.put(dn, date);
                finishPositions.put(dn, pos);
            }
        }

        if (finishPositions.isEmpty()) return false;

        // ── Lap data → fastest lap per driver ──────────────────────────────
        String lapsUrl = OPENF1_BASE + "/laps?session_key=" + sessionKey;
        List<Map<String, Object>> laps = restTemplate.getForObject(lapsUrl, List.class);
        Map<Integer, Float> bestLaps = new HashMap<>();
        if (laps != null) {
            for (Map<String, Object> lap : laps) {
                Integer dn = toInt(lap.get("driver_number"));
                Object dur = lap.get("lap_duration");
                if (dn == null || dur == null) continue;
                float sec = ((Number) dur).floatValue();
                if (sec <= 0 || sec > 600) continue;
                Float prev = bestLaps.get(dn);
                if (prev == null || sec < prev) bestLaps.put(dn, sec);
            }
        }

        // Determine fastest lap driver (lowest lap time among all classified drivers)
        int fastestLapDriver = -1;
        if (!isSprint && !bestLaps.isEmpty()) {
            fastestLapDriver = bestLaps.entrySet().stream()
                    .filter(e -> {
                        Integer pos = finishPositions.get(e.getKey());
                        return pos != null && pos >= 1 && pos <= 10;
                    })
                    .min(Map.Entry.comparingByValue())
                    .map(Map.Entry::getKey)
                    .orElse(-1);
        }

        // ── Build results ─────────────────────────────────────────────────
        List<Driver> allDrivers = driverRepo.findAll();
        Map<Integer, Driver> driversByCar = new HashMap<>();
        for (Driver d : allDrivers) {
            driversByCar.put(d.getCarNumber(), d);
        }

        int[] pointsSystem = isSprint ? SPRINT_POINTS : RACE_POINTS;
        List<RaceResult> results = new ArrayList<>();

        // Sort by finish position (0 = DNF, goes last)
        List<Map.Entry<Integer, Integer>> sorted = new ArrayList<>(finishPositions.entrySet());
        sorted.sort(Comparator.comparingInt(e -> e.getValue() <= 0 ? 999 : e.getValue()));

        int classifiedPos = 0;
        for (Map.Entry<Integer, Integer> entry : sorted) {
            int carNumber = entry.getKey();
            int rawPos = entry.getValue();
            boolean dnf = rawPos <= 0;

            Driver driver = driversByCar.get(carNumber);
            if (driver == null) {
                log.debug("[OpenF1] No DB driver for car #{} in {}", carNumber, race.getName());
                continue;
            }

            if (!dnf) classifiedPos++;
            int finishPos = dnf ? 0 : classifiedPos;
            float points = 0;
            if (!dnf && finishPos >= 1 && finishPos <= pointsSystem.length) {
                points = pointsSystem[finishPos - 1];
            }

            boolean hasFL = (carNumber == fastestLapDriver);
            float fastestLapTime = bestLaps.getOrDefault(carNumber, 0f);

            results.add(RaceResult.builder()
                    .race(race)
                    .driver(driver)
                    .finishPosition(finishPos)
                    .startPosition(0) // not available from position data alone
                    .points(points)
                    .hasFastestLap(hasFL)
                    .fastestLapTime(fastestLapTime > 0 ? fastestLapTime : 0)
                    .fastestLapNumber(0)
                    .dnfReason(dnf ? "DNF" : null)
                    .build());
        }

        if (results.isEmpty()) return false;

        raceResultRepo.deleteByRaceId(race.getId());
        raceResultRepo.saveAll(results);

        results.stream()
                .filter(r -> r.getFinishPosition() == 1 && r.getDnfReason() == null)
                .findFirst()
                .ifPresent(winner -> notificationService.notifyRaceResult(
                        race.getName() + (isSprint ? " (Sprint)" : ""),
                        winner.getDriver().getName(),
                        winner.getDriver().getTeam() != null ? winner.getDriver().getTeam().getName() : ""
                ));

        log.info("✅ [OpenF1] Synced {} — {} drivers via OpenF1", race.getName(), results.size());
        return true;
    }

    // ─── Jolpica fallback ─────────────────────────────────────────────────────

    @Transactional
    public boolean syncRaceByRoundViaJolpica(Race race, boolean isSprint) {
        int dbRound = race.getRoundNumber();
        if (dbRound <= 0) return false;

        int jolpicaRound = JolpicaRoundMapper.toJolpicaRound(dbRound);
        if (jolpicaRound == JolpicaRoundMapper.CANCELLED) {
            log.debug("[Sync] Skipping cancelled race: {}", race.getName());
            return false;
        }

        int season = race.getSeason() > 0 ? race.getSeason() : 2026;
        String url = JolpicaRoundMapper.buildResultsUrl(dbRound, season, isSprint);
        log.info("[Sync] Fetching {} from Jolpica: {}", race.getName(), url);

        List<Driver> allDrivers = driverRepo.findAll();

        try {
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

            raceResultRepo.deleteByRaceId(race.getId());
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
            log.warn("[Sync] Jolpica failed for {} (DB round={}, Jolpica round={}): {}", race.getName(), dbRound, jolpicaRound, e.getMessage());
            return false;
        }
    }

    // ─── Session-key lookup ────────────────────────────────────────────────────

    @Transactional
    public boolean syncSession(int sessionKey, String countryName, boolean isSprint) {
        List<Race> races = raceRepo.findAllByOrderBySeasonDescRoundNumberAsc();
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

    /**
     * Finds the OpenF1 session key for a race by matching circuit and session type.
     */
    @SuppressWarnings("unchecked")
    public Optional<Integer> findSessionKey(Race race, String sessionType, boolean sprint) {
        if (race.getCircuit() == null) return Optional.empty();

        String dbCircuitName = race.getCircuit().getName();
        int season = race.getSeason() > 0 ? race.getSeason() : 2026;

        // Find which OpenF1 short name maps to this DB circuit
        String openf1Circuit = null;
        for (Map.Entry<String, String> e : OPENF1_CIRCUIT_TO_DB.entrySet()) {
            if (e.getValue().equals(dbCircuitName)) {
                openf1Circuit = e.getKey();
                break;
            }
        }
        if (openf1Circuit == null) {
            log.debug("[OpenF1] No circuit mapping for: {}", dbCircuitName);
            return Optional.empty();
        }

        try {
            String url = OPENF1_BASE + "/sessions?year=" + season
                    + "&session_type=" + sessionType
                    + "&circuit_short_name=" + openf1Circuit;
            List<Map<String, Object>> sessions = restTemplate.getForObject(url, List.class);
            if (sessions == null || sessions.isEmpty()) return Optional.empty();

            for (Map<String, Object> s : sessions) {
                String sessionName = String.valueOf(s.getOrDefault("session_name", ""));
                boolean isSprintSession = sessionName.equalsIgnoreCase("Sprint")
                        || sessionName.equalsIgnoreCase("Sprint Qualifying");
                if (sprint == isSprintSession) {
                    return Optional.of(toInt(s.get("session_key")));
                }
            }
            // If no exact sprint/GP match, return the first one
            if (!sessions.isEmpty()) {
                return Optional.of(toInt(sessions.get(0).get("session_key")));
            }
        } catch (Exception e) {
            log.debug("[OpenF1] Session lookup error for {}: {}", race.getName(), e.getMessage());
        }
        return Optional.empty();
    }

    // ─── Pit Stops from OpenF1 ─────────────────────────────────────────────────

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
                        .durationSec(0f)
                        .tyreOut(tyreOut)
                        .crewSize(0)
                        .underSafetyCar(false)
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

    // ─── Lap Times from OpenF1 ─────────────────────────────────────────────────

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
                        .speedKmh(0f)
                        .rpm(0)
                        .gear(0)
                        .throttlePct(0f)
                        .brakePct(0f)
                        .drsActive(false)
                        .fuelLoad(0f)
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

    // ─── Weather from OpenF1 ───────────────────────────────────────────────────

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

    // ─── Helpers ───────────────────────────────────────────────────────────────

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
