package backend.service;

import backend.model.Driver;
import backend.model.QualifyingResult;
import backend.model.Race;
import backend.repository.DriverRepository;
import backend.repository.QualifyingResultRepository;
import backend.repository.RaceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class QualifyingService {

    private final QualifyingResultRepository qualifyingRepo;
    private final RaceRepository raceRepo;
    private final DriverRepository driverRepo;
    private final RestTemplate restTemplate = new RestTemplate();

    private static final String OPENF1_BASE = "https://api.openf1.org/v1";

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

    @Transactional
    public Map<String, Object> syncQualifying(Long raceId) {
        Race race = raceRepo.findById(raceId)
                .orElseThrow(() -> new RuntimeException("Race not found: " + raceId));

        String country = extractCountry(race.getName());
        Integer sessionKey = findQualifyingSession(country, race.getSeason(), isSprintRace(race));
        if (sessionKey == null) {
            return Map.of("success", false, "message", "No qualifying session found for " + race.getName());
        }

        boolean success = syncFromSession(sessionKey, race);
        return Map.of(
            "success", success,
            "raceId", raceId,
            "raceName", race.getName(),
            "sessionKey", sessionKey
        );
    }

    @Transactional
    public Map<String, Object> syncAllQualifying() {
        List<String> synced = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        List<Race> races = raceRepo.findBySeason(2026);
        for (Race race : races) {
            if (isSprintRace(race)) continue;
            if (qualifyingRepo.existsByRaceId(race.getId())) {
                skipped.add(race.getName() + " (already synced)");
                continue;
            }
            try {
                sleep(800);
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

    @SuppressWarnings("unchecked")
    private Integer findQualifyingSession(String country, int season, boolean isSprint) {
        try {
            String sessionType = isSprint ? "Sprint+Qualifying" : "Qualifying";
            String url = OPENF1_BASE + "/sessions?year=" + season + "&session_name=" + sessionType;
            List<Map<String, Object>> sessions = restTemplate.getForObject(url, List.class);
            if (sessions == null || sessions.isEmpty()) return null;

            return sessions.stream()
                .filter(s -> matchCountry(String.valueOf(s.getOrDefault("country_name", "")), country))
                .map(s -> toInt(s.get("session_key")))
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
        } catch (Exception e) {
            log.warn("[Qualifying] Error finding session: {}", e.getMessage());
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    @Transactional
    public boolean syncFromSession(Integer sessionKey, Race race) {
        try {
            if (qualifyingRepo.existsByRaceId(race.getId())) {
                qualifyingRepo.deleteByRaceId(race.getId());
            }

            sleep(400);
            String resultsUrl = OPENF1_BASE + "/results?session_key=" + sessionKey;
            List<Map<String, Object>> openf1Results = restTemplate.getForObject(resultsUrl, List.class);

            if (openf1Results == null || openf1Results.isEmpty()) {
                log.warn("[Qualifying] No results from /results endpoint for session {}, trying laps fallback", sessionKey);
                return syncFromLaps(sessionKey, race);
            }

            sleep(400);
            String driversUrl = OPENF1_BASE + "/drivers?session_key=" + sessionKey;
            List<Map<String, Object>> openf1Drivers = restTemplate.getForObject(driversUrl, List.class);
            if (openf1Drivers == null || openf1Drivers.isEmpty()) return false;

            Map<Integer, Map<String, Object>> driverInfoMap = new HashMap<>();
            for (Map<String, Object> d : openf1Drivers) {
                Integer num = toInt(d.get("driver_number"));
                if (num != null) driverInfoMap.put(num, d);
            }

            List<QualifyingResult> results = new ArrayList<>();
            for (Map<String, Object> r : openf1Results) {
                Integer driverNum = toInt(r.get("driver_number"));
                Integer position = toInt(r.get("position"));
                if (driverNum == null || position == null) continue;

                Map<String, Object> driverInfo = driverInfoMap.get(driverNum);
                if (driverInfo == null) continue;

                String fullName = String.valueOf(driverInfo.getOrDefault("full_name", ""));
                Optional<Driver> driverOpt = findDriver(fullName, driverNum);
                if (driverOpt.isEmpty()) {
                    log.debug("[Qualifying] Driver not found: {} #{}", fullName, driverNum);
                    continue;
                }

                Double q1 = toDouble(r.get("q1"));
                Double q2 = toDouble(r.get("q2"));
                Double q3 = toDouble(r.get("q3"));
                Double best = q3 != null ? q3 : (q2 != null ? q2 : q1);

                boolean elQ1 = q2 == null && q1 != null;
                boolean elQ2 = q2 != null && q3 == null;

                QualifyingResult result = QualifyingResult.builder()
                    .race(race)
                    .driver(driverOpt.get())
                    .gridPosition(position)
                    .q1Time(q1)
                    .q2Time(q2)
                    .q3Time(q3)
                    .bestTime(best)
                    .eliminatedQ1(elQ1)
                    .eliminatedQ2(elQ2)
                    .build();
                results.add(result);
            }

            if (results.isEmpty()) return false;

            results.sort(Comparator.comparingInt(QualifyingResult::getGridPosition));
            qualifyingRepo.saveAll(results);
            log.info("✅ [Qualifying] Synced {} — {} drivers (via /results)", race.getName(), results.size());
            return true;

        } catch (Exception e) {
            log.error("[Qualifying] Sync error for {}: {}", race.getName(), e.getMessage());
            return false;
        }
    }

    @SuppressWarnings("unchecked")
    private boolean syncFromLaps(Integer sessionKey, Race race) {
        try {
            sleep(400);
            String driversUrl = OPENF1_BASE + "/drivers?session_key=" + sessionKey;
            List<Map<String, Object>> openf1Drivers = restTemplate.getForObject(driversUrl, List.class);
            if (openf1Drivers == null || openf1Drivers.isEmpty()) return false;

            sleep(400);
            String lapsUrl = OPENF1_BASE + "/laps?session_key=" + sessionKey;
            List<Map<String, Object>> laps = restTemplate.getForObject(lapsUrl, List.class);
            if (laps == null || laps.isEmpty()) return false;

            Map<Integer, Double> bestTimes = new HashMap<>();
            for (Map<String, Object> lap : laps) {
                Integer driverNum = toInt(lap.get("driver_number"));
                Object durObj = lap.get("lap_duration");
                if (driverNum == null || durObj == null) continue;
                double dur = ((Number) durObj).doubleValue();
                if (dur <= 0) continue;
                bestTimes.merge(driverNum, dur, Math::min);
            }

            Map<Integer, Map<String, Object>> driverInfoMap = new HashMap<>();
            for (Map<String, Object> d : openf1Drivers) {
                Integer num = toInt(d.get("driver_number"));
                if (num != null) driverInfoMap.put(num, d);
            }

            List<Map.Entry<Integer, Double>> sorted = new ArrayList<>(bestTimes.entrySet());
            sorted.sort(Map.Entry.comparingByValue());

            List<QualifyingResult> results = new ArrayList<>();
            for (int i = 0; i < sorted.size(); i++) {
                Integer driverNum = sorted.get(i).getKey();
                Double bestTime = sorted.get(i).getValue();
                Map<String, Object> driverInfo = driverInfoMap.get(driverNum);
                if (driverInfo == null) continue;

                String fullName = String.valueOf(driverInfo.getOrDefault("full_name", ""));
                Optional<Driver> driverOpt = findDriver(fullName, driverNum);
                if (driverOpt.isEmpty()) continue;

                QualifyingResult result = QualifyingResult.builder()
                    .race(race)
                    .driver(driverOpt.get())
                    .gridPosition(i + 1)
                    .q1Time(bestTime)
                    .bestTime(bestTime)
                    .build();
                results.add(result);
            }

            if (results.isEmpty()) return false;
            qualifyingRepo.saveAll(results);
            log.info("✅ [Qualifying] Synced {} — {} drivers (via laps fallback)", race.getName(), results.size());
            return true;

        } catch (Exception e) {
            log.error("[Qualifying] Laps fallback error: {}", e.getMessage());
            return false;
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

    private String extractCountry(String raceName) {
        return raceName.toLowerCase()
            .replace("grand prix", "")
            .replace("sprint", "")
            .trim();
    }

    private boolean matchCountry(String openf1Country, String raceCountry) {
        String c1 = openf1Country.toLowerCase();
        String c2 = raceCountry.toLowerCase();
        return c1.contains(c2) || c2.contains(c1) ||
            (c1.contains("united states") && (c2.contains("miami") || c2.contains("united states"))) ||
            (c1.contains("great britain") && c2.contains("british")) ||
            (c1.contains("china") && c2.contains("chinese")) ||
            (c1.contains("japan") && c2.contains("japanese")) ||
            (c1.contains("australia") && c2.contains("australian"));
    }

    private Optional<Driver> findDriver(String fullName, Integer carNumber) {
        return driverRepo.findAll().stream()
            .filter(d -> {
                String dName = d.getName().toLowerCase();
                String fName = fullName.toLowerCase();
                String[] fParts = fName.split(" ");
                String fLast = fParts.length > 0 ? fParts[fParts.length - 1] : "";
                return dName.equals(fName)
                    || dName.contains(fLast)
                    || fName.contains(dName.split(" ")[dName.split(" ").length - 1])
                    || (carNumber != null && d.getCarNumber() == carNumber);
            })
            .findFirst();
    }

    private Integer toInt(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).intValue();
        try { return Integer.parseInt(o.toString()); } catch (Exception e) { return null; }
    }

    private Double toDouble(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).doubleValue();
        try { return Double.parseDouble(o.toString()); } catch (Exception e) { return null; }
    }

    private void sleep(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }
}
