package backend.service;

import backend.model.Driver;
import backend.model.QualifyingResult;
import backend.model.Race;
import backend.repository.DriverRepository;
import backend.repository.QualifyingResultRepository;
import backend.repository.RaceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
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

    private final RestTemplate restTemplate = createRestTemplate();

    private static RestTemplate createRestTemplate() {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(10000);
        return new RestTemplate(factory);
    }

    private static final String JOLPICA_BASE = "https://api.jolpi.ca/ergast/f1";


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

        if (isSprintRace(race)) {
            return Map.of("success", false, "message", "Sprint races not supported for qualifying sync");
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

    @Transactional
    public Map<String, Object> syncAllQualifying() {
        List<String> synced = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        List<Race> races = raceRepo.findBySeasonOrderByRoundNumber(2026);
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

    @SuppressWarnings("unchecked")
    @Transactional
    public boolean syncFromJolpica(int round, Race race) {
        try {
            if (qualifyingRepo.existsByRaceId(race.getId())) {
                qualifyingRepo.deleteByRaceId(race.getId());
            }

            String url = JOLPICA_BASE + "/2026/" + round + "/qualifying.json";
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
            results.sort(Comparator.comparingInt(QualifyingResult::getGridPosition));
            qualifyingRepo.saveAll(results);
            log.info("✅ [Qualifying] Synced {} round {} — {} drivers", race.getName(), round, results.size());
            return true;

        } catch (Exception e) {
            log.error("[Qualifying] Jolpica sync error for {}: {}", race.getName(), e.getMessage());
            return false;
        }
    }

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
        // Normalize diacritics so Jolpica names (Hülkenberg, Pérez) match DB names without accents
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
        try { Thread.sleep((long) 500); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }
}