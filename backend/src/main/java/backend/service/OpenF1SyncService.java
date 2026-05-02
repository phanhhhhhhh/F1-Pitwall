package backend.service;

import backend.model.Driver;
import backend.model.Race;
import backend.model.RaceResult;
import backend.model.enums.RaceStatus;
import backend.repository.DriverRepository;
import backend.repository.RaceRepository;
import backend.repository.RaceResultRepository;
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
    private final RestTemplate restTemplate = new RestTemplate();

    private static final String OPENF1_BASE = "https://api.openf1.org/v1";

    private static final int[] SPRINT_POINTS = {8, 7, 6, 5, 4, 3, 2, 1};
    private static final int[] RACE_POINTS = {25, 18, 15, 12, 10, 8, 6, 4, 2, 1};

    @Scheduled(fixedRate = 3600000)
    public void autoSyncCompletedRaces() {
        log.info("🔄 [OpenF1] Auto-sync checking for completed races...");
        try {
            syncRecentSessions();
        } catch (Exception e) {
            log.error("[OpenF1] Auto-sync failed: {}", e.getMessage());
        }
    }

    @Transactional
    public Map<String, Object> syncRecentSessions() {
        Map<String, Object> summary = new LinkedHashMap<>();
        List<String> synced = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        try {
            int year = LocalDate.now().getYear();
            String url = OPENF1_BASE + "/sessions?year=" + year;
            List<Map<String, Object>> sessions = restTemplate.getForObject(url, List.class);

            if (sessions == null || sessions.isEmpty()) {
                summary.put("message", "No sessions found");
                return summary;
            }

            for (Map<String, Object> session : sessions) {
                String sessionName = String.valueOf(session.getOrDefault("session_name", ""));
                String countryName = String.valueOf(session.getOrDefault("country_name", ""));
                String dateEnd = String.valueOf(session.getOrDefault("date_end", ""));

                if (!sessionName.equals("Race") && !sessionName.equals("Sprint")) continue;

                if (dateEnd.isEmpty() || dateEnd.equals("null")) continue;
                LocalDate sessionDate = LocalDate.parse(dateEnd.substring(0, 10));
                if (!sessionDate.isBefore(LocalDate.now())) continue;

                Integer sessionKey = toInt(session.get("session_key"));
                if (sessionKey == null) continue;

                String label = countryName + " " + sessionName;
                try {
                    boolean isSprint = sessionName.equals("Sprint");
                    boolean result = syncSession(sessionKey, countryName, isSprint);
                    sleep(1000); 
                    if (result) synced.add(label);
                    else skipped.add(label + " (already synced or no data)");
                } catch (Exception e) {
                    errors.add(label + ": " + e.getMessage());
                    log.warn("[OpenF1] Failed to sync {}: {}", label, e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("[OpenF1] Sync error: {}", e.getMessage());
            errors.add("Global error: " + e.getMessage());
        }

        summary.put("synced", synced);
        summary.put("skipped", skipped);
        summary.put("errors", errors);
        summary.put("total", synced.size());
        return summary;
    }


    @Transactional
    public boolean syncSession(int sessionKey, String countryName, boolean isSprint) {
        String posUrl = OPENF1_BASE + "/position?session_key=" + sessionKey;
        List<Map<String, Object>> positions = restTemplate.getForObject(posUrl, List.class);
        sleep(400); // 400ms delay
        if (positions == null || positions.isEmpty()) return false;

        String driversUrl = OPENF1_BASE + "/drivers?session_key=" + sessionKey;
        List<Map<String, Object>> openf1Drivers = restTemplate.getForObject(driversUrl, List.class);
        sleep(400);
        if (openf1Drivers == null || openf1Drivers.isEmpty()) return false;

        Map<Integer, Boolean> fastestLapByDriver = new HashMap<>();
        if (!isSprint) {
            try {
                String lapUrl = OPENF1_BASE + "/laps?session_key=" + sessionKey + "&is_pit_out_lap=false";
                List<Map<String, Object>> laps = restTemplate.getForObject(lapUrl, List.class);
                if (laps != null && !laps.isEmpty()) {
                    Map<String, Object> fastestLap = laps.stream()
                        .filter(l -> l.get("lap_duration") != null)
                        .min(Comparator.comparingDouble(l -> ((Number) l.get("lap_duration")).doubleValue()))
                        .orElse(null);
                    if (fastestLap != null) {
                        Integer driverNum = toInt(fastestLap.get("driver_number"));
                        if (driverNum != null) fastestLapByDriver.put(driverNum, true);
                      }
                }
            } catch (Exception e) {
                log.debug("[OpenF1] Could not fetch fastest lap: {}", e.getMessage());
            }
        }

        Map<Integer, Integer> finalPositions = new HashMap<>();
        for (Map<String, Object> pos : positions) {
            Integer driverNum = toInt(pos.get("driver_number"));
            Integer position = toInt(pos.get("position"));
            if (driverNum != null && position != null) {
                finalPositions.put(driverNum, position);
            }
        }

        if (finalPositions.isEmpty()) return false;

        Map<Integer, Map<String, Object>> driverInfoMap = new HashMap<>();
        for (Map<String, Object> d : openf1Drivers) {
            Integer num = toInt(d.get("driver_number"));
            if (num != null) driverInfoMap.put(num, d);
        }

        String sessionType = isSprint ? "Sprint" : "Race";
        Optional<Race> raceOpt = findMatchingRace(countryName, isSprint);
        if (raceOpt.isEmpty()) {
            log.warn("[OpenF1] No matching race found for {} {}", countryName, sessionType);
            return false;
        }

        Race race = raceOpt.get();

        if (raceResultRepo.existsByRaceId(race.getId())) {
            log.debug("[OpenF1] {} {} already has results, skipping", countryName, sessionType);
            return false;
        }

        List<RaceResult> results = new ArrayList<>();
        int[] pointsSystem = isSprint ? SPRINT_POINTS : RACE_POINTS;

        for (Map.Entry<Integer, Integer> entry : finalPositions.entrySet()) {
            Integer driverNum = entry.getKey();
            Integer position = entry.getValue();
            Map<String, Object> driverInfo = driverInfoMap.get(driverNum);
            if (driverInfo == null) continue;

            String fullName = String.valueOf(driverInfo.getOrDefault("full_name", ""));
            Optional<Driver> driverOpt = findDriver(fullName, driverNum);
            if (driverOpt.isEmpty()) continue;

            float points = 0;
            if (position != null && position >= 1 && position <= pointsSystem.length) {
                points = pointsSystem[position - 1];
            }

            boolean hasFastestLap = false;
            if (!isSprint && fastestLapByDriver.getOrDefault(driverNum, false)) {
                if (position != null && position <= 10) {
                    points += 1;
                    hasFastestLap = true;
                }
            }

            RaceResult result = RaceResult.builder()
                .race(race)
                .driver(driverOpt.get())
                .finishPosition(position != null ? position : 0)
                .points(points)
                .hasFastestLap(hasFastestLap)
                .build();
            results.add(result);
        }

        if (results.isEmpty()) return false;

        raceResultRepo.saveAll(results);

        race.setStatus(RaceStatus.COMPLETED);
        raceRepo.save(race);

        results.stream()
            .filter(r -> r.getFinishPosition() == 1)
            .findFirst()
            .ifPresent(winner -> {
                notificationService.notifyRaceResult(
                    race.getName() + (isSprint ? " (Sprint)" : ""),
                    winner.getDriver().getName(),
                    winner.getDriver().getTeam() != null ? winner.getDriver().getTeam().getName() : ""
                );
            });

        log.info("✅ [OpenF1] Synced {} {} — {} results", countryName, sessionType, results.size());
        return true;
    }

    private Optional<Race> findMatchingRace(String countryName, boolean isSprint) {
        List<Race> races = raceRepo.findBySeason(2026);
        return races.stream()
            .filter(r -> {
                String name = r.getName().toLowerCase();
                String country = countryName.toLowerCase();
                boolean nameMatch = name.contains(country) ||
                    country.contains("united states") && name.contains("miami") ||
                    country.contains("great britain") && name.contains("british") ||
                    country.contains("united arab") && name.contains("abu dhabi");
                boolean typeMatch = isSprint
                    ? name.contains("sprint")
                    : !name.contains("sprint");
                return nameMatch && typeMatch;
            })
            .findFirst();
    }

    private Optional<Driver> findDriver(String fullName, Integer carNumber) {
        List<Driver> drivers = driverRepo.findAll();

        return drivers.stream()
            .filter(d -> {
                String dName = d.getName().toLowerCase();
                String fName = fullName.toLowerCase();
                return dName.equals(fName) ||
                    fName.contains(dName.split(" ")[dName.split(" ").length - 1].toLowerCase()) ||
                    dName.contains(fName.split(" ")[fName.split(" ").length - 1].toLowerCase()) ||
                    (carNumber != null && d.getCarNumber() == carNumber);
            })
            .findFirst();
    }

    private Integer toInt(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).intValue();
        try { return Integer.parseInt(o.toString()); } catch (Exception e) { return null; }
    }

    private void sleep(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }
}
