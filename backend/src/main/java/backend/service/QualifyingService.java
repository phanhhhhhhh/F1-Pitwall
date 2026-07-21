package backend.service;

import backend.model.Driver;
import backend.model.QualifyingResult;
import backend.model.Race;
import backend.repository.DriverRepository;
import backend.repository.QualifyingResultRepository;
import backend.repository.RaceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class QualifyingService {

    private final QualifyingResultRepository qualifyingRepo;
    private final RaceRepository raceRepo;
    private final DriverRepository driverRepo;
    private final OpenF1SyncService openF1SyncService;

    private final RestTemplate restTemplate;

    private static final String OPENF1_BASE = "https://api.openf1.org/v1";

    // ─── Auto-sync qualifying (every 30 min, offset from race results sync) ───

    @Scheduled(fixedRate = 1_800_000, initialDelay = 120_000)
    public void autoSyncQualifying() {
        log.info("🔄 [AutoSync Quali] Checking for completed qualifying sessions...");
        int synced = 0;
        List<Race> races = raceRepo.findAllByOrderBySeasonDescRoundNumberAsc();
        for (Race race : races) {
            if (race.getName().toLowerCase().contains("sprint")) continue;
            if (race.getDate() != null && race.getDate().isAfter(LocalDate.now())) continue;
            if (qualifyingRepo.existsByRaceId(race.getId())) continue;
            try {
                sleep();
                Map<String, Object> result = syncQualifying(race.getId());
                if (Boolean.TRUE.equals(result.get("success"))) synced++;
            } catch (Exception e) {
                log.debug("[AutoSync Quali] Failed for {}: {}", race.getName(), e.getMessage());
            }
        }
        if (synced > 0) log.info("✅ [AutoSync Quali] Synced {} qualifying sessions", synced);
    }

    // ─── Read ─────────────────────────────────────────────────────────────────

    public List<Map<String, Object>> getQualifyingResults(Long raceId) {
        List<QualifyingResult> results = qualifyingRepo.findByRaceIdOrderByGridPosition(raceId);
        return results.stream().map(r -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", r.getId());
            map.put("gridPosition", r.getGridPosition());
            map.put("driverName", r.getDriver() != null ? r.getDriver().getName() : "");
            map.put("teamName", r.getDriver() != null && r.getDriver().getTeam() != null
                    ? r.getDriver().getTeam().getName() : "");
            map.put("teamColor", r.getDriver() != null && r.getDriver().getTeam() != null
                    ? r.getDriver().getTeam().getColorHex() : "#888");
            map.put("carNumber", r.getDriver() != null ? r.getDriver().getCarNumber() : 0);
            map.put("q1Time", r.getQ1Time() != null ? formatLapTime(r.getQ1Time()) : null);
            map.put("q2Time", r.getQ2Time() != null ? formatLapTime(r.getQ2Time()) : null);
            map.put("q3Time", r.getQ3Time() != null ? formatLapTime(r.getQ3Time()) : null);
            map.put("bestTime", r.getBestTime() != null ? formatLapTime(r.getBestTime()) : null);
            map.put("eliminatedQ1", r.isEliminatedQ1());
            map.put("eliminatedQ2", r.isEliminatedQ2());
            map.put("q1TimeRaw", r.getQ1Time());
            map.put("q2TimeRaw", r.getQ2Time());
            map.put("q3TimeRaw", r.getQ3Time());
            return map;
        }).collect(Collectors.toList());
    }

    // ─── Sync: OpenF1 first (fast), Jolpica fallback (detailed Q1/Q2/Q3) ─────

    @Transactional
    public Map<String, Object> syncQualifying(Long raceId) {
        Race race = raceRepo.findById(raceId)
                .orElseThrow(() -> new RuntimeException("Race not found: " + raceId));

        if (isSprintRace(race)) {
            return Map.of("success", false, "message", "Sprint races not supported for qualifying sync");
        }

        // 1) Try OpenF1 (near-real-time, grid + best times)
        boolean openF1ok = false;
        try {
            openF1ok = syncQualifyingFromOpenF1(race);
        } catch (Exception e) {
            log.debug("[Qualifying] OpenF1 sync failed for {}: {}", race.getName(), e.getMessage());
        }

        // 2) Try Jolpica for Q1/Q2/Q3 enrichment (or full sync if OpenF1 failed)
        boolean jolpicaOk = false;
        Integer round = race.getRoundNumber() > 0 ? race.getRoundNumber() : null;
        if (round != null) {
            try {
                jolpicaOk = syncFromJolpica(round, race);
            } catch (Exception e) {
                log.debug("[Qualifying] Jolpica sync failed for {}: {}", race.getName(), e.getMessage());
            }
        }

        boolean success = openF1ok || jolpicaOk;
        return Map.of(
                "success", success,
                "raceId", raceId,
                "raceName", race.getName(),
                "source", openF1ok ? (jolpicaOk ? "OpenF1+Jolpica" : "OpenF1") : (jolpicaOk ? "Jolpica" : "none")
        );
    }

    @Transactional
    public Map<String, Object> syncAllQualifying() {
        List<String> synced = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        List<Race> races = raceRepo.findAllByOrderBySeasonDescRoundNumberAsc();
        for (Race race : races) {
            if (isSprintRace(race)) continue;
            if (qualifyingRepo.existsByRaceId(race.getId())) {
                skipped.add(race.getName() + " (already synced)");
                continue;
            }
            try {
                sleep();
                Map<String, Object> result = syncQualifying(race.getId());
                if (Boolean.TRUE.equals(result.get("success"))) {
                    synced.add(race.getName());
                } else {
                    skipped.add(race.getName() + " (" + result.get("message") + ")");
                }
            } catch (Exception e) {
                errors.add(race.getName() + ": " + e.getMessage());
            }
        }

        return Map.of("synced", synced, "skipped", skipped, "errors", errors, "total", synced.size());
    }

    // ─── OpenF1 qualifying sync ───────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    @Transactional
    public boolean syncQualifyingFromOpenF1(Race race) {
        Optional<Integer> keyOpt = openF1SyncService.findSessionKey(race, "Qualifying", false);
        if (keyOpt.isEmpty()) {
            log.debug("[OpenF1 Quali] No session for {}", race.getName());
            return false;
        }
        int sessionKey = keyOpt.get();

        // ── Position data → grid order ────────────────────────────────────
        String posUrl = OPENF1_BASE + "/position?session_key=" + sessionKey;
        List<Map<String, Object>> positions = restTemplate.getForObject(posUrl, List.class);
        if (positions == null || positions.isEmpty()) return false;

        Map<Integer, Integer> gridPositions = new LinkedHashMap<>();
        Map<Integer, String> lastTimestamps = new HashMap<>();
        for (Map<String, Object> p : positions) {
            Integer dn = toInt(p.get("driver_number"));
            Integer pos = toInt(p.get("position"));
            String date = String.valueOf(p.getOrDefault("date", ""));
            if (dn == null || pos == null || pos <= 0) continue;
            if (lastTimestamps.get(dn) == null || date.compareTo(lastTimestamps.get(dn)) > 0) {
                lastTimestamps.put(dn, date);
                gridPositions.put(dn, pos);
            }
        }

        if (gridPositions.isEmpty()) return false;

        // ── Laps data → best times ────────────────────────────────────────
        String lapsUrl = OPENF1_BASE + "/laps?session_key=" + sessionKey;
        List<Map<String, Object>> laps = restTemplate.getForObject(lapsUrl, List.class);
        Map<Integer, Double> bestTimes = new HashMap<>();
        if (laps != null) {
            for (Map<String, Object> lap : laps) {
                Integer dn = toInt(lap.get("driver_number"));
                Object dur = lap.get("lap_duration");
                if (dn == null || dur == null) continue;
                double sec = ((Number) dur).doubleValue();
                if (sec <= 0 || sec > 600) continue;
                Double prev = bestTimes.get(dn);
                if (prev == null || sec < prev) bestTimes.put(dn, sec);
            }
        }

        // ── Match drivers by car number ───────────────────────────────────
        List<Driver> allDrivers = driverRepo.findAll();
        Map<Integer, Driver> driversByCar = new HashMap<>();
        for (Driver d : allDrivers) {
            driversByCar.put(d.getCarNumber(), d);
        }

        // Don't delete if we're enriching (Jolpica may have already saved Q1/Q2/Q3)
        if (!qualifyingRepo.existsByRaceId(race.getId())) {
            // Fresh sync — nothing to preserve
        }

        List<QualifyingResult> results = new ArrayList<>();
        List<Map.Entry<Integer, Integer>> sorted = new ArrayList<>(gridPositions.entrySet());
        sorted.sort(Map.Entry.comparingByValue());

        for (Map.Entry<Integer, Integer> entry : sorted) {
            int carNumber = entry.getKey();
            int gridPos = entry.getValue();

            Driver driver = driversByCar.get(carNumber);
            if (driver == null) {
                log.debug("[OpenF1 Quali] No DB driver for car #{} in {}", carNumber, race.getName());
                continue;
            }

            Double bestTime = bestTimes.get(carNumber);

            results.add(QualifyingResult.builder()
                    .race(race)
                    .driver(driver)
                    .gridPosition(gridPos)
                    .q1Time(null).q2Time(null).q3Time(null) // OpenF1 doesn't split Q segments
                    .bestTime(bestTime)
                    .eliminatedQ1(false).eliminatedQ2(false)
                    .build());
        }

        if (results.isEmpty()) return false;

        // If we have existing richer data from Jolpica, don't overwrite
        List<QualifyingResult> existing = qualifyingRepo.findByRaceIdOrderByGridPosition(race.getId());
        if (!existing.isEmpty() && existing.get(0).getQ1Time() != null) {
            // Already have detailed Q1/Q2/Q3 from Jolpica, keep it
            log.debug("[OpenF1 Quali] {} already has detailed data, skipping", race.getName());
            return true;
        }

        qualifyingRepo.deleteByRaceId(race.getId());
        qualifyingRepo.saveAll(results);
        log.info("✅ [OpenF1 Quali] Synced {} — {} drivers on grid", race.getName(), results.size());
        return true;
    }

    // ─── Jolpica qualifying sync (detailed Q1/Q2/Q3) ──────────────────────────

    @SuppressWarnings("unchecked")
    @Transactional
    public boolean syncFromJolpica(int dbRound, Race race) {
        try {
            int jolpicaRound = JolpicaRoundMapper.toJolpicaRound(dbRound);
            if (jolpicaRound == JolpicaRoundMapper.CANCELLED) {
                log.debug("[Qualifying] Skipping cancelled round {}: {}", dbRound, race.getName());
                return false;
            }

            int season = race.getSeason() > 0 ? race.getSeason() : 2026;
            String url = JolpicaRoundMapper.buildQualifyingUrl(dbRound, season);
            log.info("[Qualifying] Fetching {} from Jolpica: {}", race.getName(), url);

            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response == null) return false;

            Map<String, Object> mrData = (Map<String, Object>) response.get("MRData");
            if (mrData == null) return false;

            Map<String, Object> raceTable = (Map<String, Object>) mrData.get("RaceTable");
            if (raceTable == null) return false;

            List<Map<String, Object>> races = (List<Map<String, Object>>) raceTable.get("Races");
            if (races == null || races.isEmpty()) return false;

            List<Map<String, Object>> qualResults = (List<Map<String, Object>>) races.getFirst().get("QualifyingResults");
            if (qualResults == null || qualResults.isEmpty()) return false;

            // Check if we already have OpenF1 data to enrich instead of replace
            List<QualifyingResult> existing = qualifyingRepo.findByRaceIdOrderByGridPosition(race.getId());
            boolean enrichMode = !existing.isEmpty();

            List<Driver> allDrivers = driverRepo.findAll();

            List<QualifyingResult> results = new ArrayList<>();
            for (Map<String, Object> qr : qualResults) {
                Integer position = toInt(qr.get("position"));
                Map<String, Object> driverMap = (Map<String, Object>) qr.get("Driver");
                if (driverMap == null || position == null) continue;

                String givenName = String.valueOf(driverMap.getOrDefault("givenName", ""));
                String familyName = String.valueOf(driverMap.getOrDefault("familyName", ""));
                String fullName = givenName + " " + familyName;

                Optional<Driver> driverOpt = findDriver(fullName.trim(), allDrivers);
                if (driverOpt.isEmpty()) {
                    log.debug("[Qualifying] Driver not found: {}", fullName);
                    continue;
                }

                Double q1 = parseTimeString(String.valueOf(qr.getOrDefault("Q1", "")));
                Double q2 = parseTimeString(String.valueOf(qr.getOrDefault("Q2", "")));
                Double q3 = parseTimeString(String.valueOf(qr.getOrDefault("Q3", "")));
                Double best = q3 != null ? q3 : (q2 != null ? q2 : q1);

                boolean elQ1 = q2 == null && q1 != null;
                boolean elQ2 = q2 != null && q3 == null;

                results.add(QualifyingResult.builder()
                        .race(race)
                        .driver(driverOpt.get())
                        .gridPosition(position)
                        .q1Time(q1).q2Time(q2).q3Time(q3).bestTime(best)
                        .eliminatedQ1(elQ1).eliminatedQ2(elQ2)
                        .build());
            }

            if (results.isEmpty()) return false;

            if (enrichMode) {
                // Enrich existing OpenF1 data with Q1/Q2/Q3 from Jolpica
                qualifyingRepo.deleteByRaceId(race.getId());
            }
            results.sort(Comparator.comparingInt(QualifyingResult::getGridPosition));
            qualifyingRepo.saveAll(results);
            log.info("✅ [Qualifying] Synced {} (DB R{} → Jolpica R{}) — {} drivers", race.getName(), dbRound, jolpicaRound, results.size());
            return true;

        } catch (Exception e) {
            log.error("[Qualifying] Jolpica sync error for {}: {}", race.getName(), e.getMessage());
            return false;
        }
    }

    @Transactional
    public Map<String, Object> syncSprintQualifying(Long raceId) {
        Race race = raceRepo.findById(raceId)
                .orElseThrow(() -> new RuntimeException("Race not found: " + raceId));

        if (!isSprintRace(race)) {
            return Map.of("success", false, "message", "Only sprint races supported for sprint qualifying sync");
        }
        Integer round = race.getRoundNumber() > 0 ? race.getRoundNumber() : null;
        if (round == null) {
            return Map.of("success", false, "message", "No round number found for " + race.getName());
        }

        boolean success = syncFromJolpica(round, race);
        return Map.of(
                "success", success,
                "raceId", raceId,
                "raceName", race.getName(),
                "round", round
        );
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    private Double parseTimeString(String time) {
        if (time == null || time.isEmpty() || time.equals("null")) return null;
        try {
            if (time.contains(":")) {
                String[] parts = time.split(":");
                int mins = Integer.parseInt(parts[0]);
                double secs = Double.parseDouble(parts[1]);
                return mins * 60.0 + secs;
            }
            return Double.parseDouble(time);
        } catch (Exception e) {
            return null;
        }
    }

    private String formatLapTime(double seconds) {
        int mins = (int) (seconds / 60);
        double secs = seconds % 60;
        return String.format("%d:%06.3f", mins, secs);
    }

    private boolean isSprintRace(Race race) {
        return race.getName().toLowerCase().contains("sprint");
    }

    private Optional<Driver> findDriver(String fullName, List<Driver> allDrivers) {
        String fName = OpenF1SyncService.stripAccents(fullName);
        String[] fParts = fName.split(" ");
        String fLast = fParts.length > 0 ? fParts[fParts.length - 1] : "";

        return allDrivers.stream()
                .filter(d -> {
                    String dName = OpenF1SyncService.stripAccents(d.getName());
                    String[] dParts = dName.split(" ");
                    String dLast = dParts.length > 0 ? dParts[dParts.length - 1] : "";
                    return dName.equals(fName) || dLast.equals(fLast) || dName.contains(fLast) || fName.contains(dLast);
                })
                .findFirst();
    }

    private Integer toInt(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).intValue();
        try { return Integer.parseInt(o.toString()); } catch (Exception e) { return null; }
    }

    private void sleep() {
        try { Thread.sleep(500); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }
}
