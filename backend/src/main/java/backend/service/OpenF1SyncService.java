package backend.service;

import backend.dto.RaceResultRequest;
import backend.model.Driver;
import backend.model.Race;
import backend.model.enums.RaceStatus;
import backend.repository.DriverRepository;
import backend.repository.RaceRepository;
import backend.repository.RaceResultRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class OpenF1SyncService {

    private final RaceRepository raceRepo;
    private final DriverRepository driverRepo;
    private final RaceResultRepository raceResultRepo;
    private final RaceResultService raceResultService;

    private static final String OPENF1_BASE = "https://api.openf1.org/v1";

    private static final Map<Integer, String> DRIVER_NUMBER_MAP = new HashMap<>() {{
        put(1, "Lando Norris");
        put(81, "Oscar Piastri");
        put(44, "Lewis Hamilton");
        put(16, "Charles Leclerc");
        put(3, "Max Verstappen");
        put(6, "Isack Hadjar");
        put(63, "George Russell");
        put(12, "Kimi Antonelli");
        put(14, "Fernando Alonso");
        put(18, "Lance Stroll");
        put(55, "Carlos Sainz");
        put(23, "Alexander Albon");
        put(31, "Esteban Ocon");
        put(87, "Oliver Bearman");
        put(30, "Liam Lawson");
        put(41, "Arvid Lindblad");
        put(10, "Pierre Gasly");
        put(43, "Franco Colapinto");
        put(27, "Nico Hulkenberg");
        put(5, "Gabriel Bortoleto");
        put(11, "Sergio Perez");
        put(77, "Valtteri Bottas");
    }};


    @Scheduled(cron = "0 0 * * * *")
    public void autoSyncCompletedRaces() {
        log.info("🔄 [OpenF1] Auto-sync checking for completed races...");
        syncAllPendingRaces();
    }

    public Map<String, Object> manualSync() {
        log.info("🔄 [OpenF1] Manual sync triggered");
        return syncAllPendingRaces();
    }

    public Map<String, Object> syncRace(Long raceId) {
        Race race = raceRepo.findById(raceId)
                .orElseThrow(() -> new RuntimeException("Race not found: " + raceId));
        return syncSingleRace(race);
    }



    private Map<String, Object> syncAllPendingRaces() {

        List<Race> races = raceRepo.findAll();
        List<String> synced = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        List<String> failed = new ArrayList<>();

        for (Race race : races) {
            if (race.getSeason() != 2026) continue;
            if (race.getStatus() == RaceStatus.CANCELLED) continue;


            if (raceResultRepo.existsByRaceId(race.getId())) {
                skipped.add(race.getName());
                continue;
            }


            if (race.getDate().isAfter(LocalDate.now())) {
                skipped.add(race.getName() + " (future)");
                continue;
            }

            Map<String, Object> result = syncSingleRace(race);
            if ((Boolean) result.getOrDefault("success", false)) {
                synced.add(race.getName());
            } else {
                failed.add(race.getName() + ": " + result.get("error"));
            }
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("synced", synced);
        summary.put("skipped", skipped);
        summary.put("failed", failed);
        summary.put("total_synced", synced.size());
        return summary;
    }


    private Map<String, Object> syncSingleRace(Race race) {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            log.info("🔄 [OpenF1] Syncing: {}", race.getName());

            RestTemplate restTemplate = new RestTemplate();

            String sessionUrl = String.format(
                "%s/sessions?year=%d&session_name=Race&country_name=%s",
                OPENF1_BASE, race.getSeason(),
                race.getCircuit() != null && race.getCircuit().getCountry() != null ?
                        race.getCircuit().getCountry().replace(" ", "%20") : ""
            );

            Map[] sessions = restTemplate.getForObject(sessionUrl, Map[].class);

            if (sessions == null || sessions.length == 0) {
                result.put("success", false);
                result.put("error", "No session found for " + race.getName());
                return result;
            }

            Integer sessionKey = (Integer) sessions[0].get("session_key");
            log.info("✅ [OpenF1] Found session key: {} for {}", sessionKey, race.getName());


            String positionUrl = String.format("%s/position?session_key=%d", OPENF1_BASE, sessionKey);
            Map[] positions = restTemplate.getForObject(positionUrl, Map[].class);

            if (positions == null || positions.length == 0) {
                result.put("success", false);
                result.put("error", "No position data for session " + sessionKey);
                return result;
            }


            Map<Integer, Integer> finalPositions = new LinkedHashMap<>();
            for (Map pos : positions) {
                Integer driverNum = (Integer) pos.get("driver_number");
                Integer position = (Integer) pos.get("position");
                if (driverNum != null && position != null) {
                    finalPositions.put(driverNum, position);
                }
            }


            String lapsUrl = String.format("%s/laps?session_key=%d&is_pit_out_lap=false", OPENF1_BASE, sessionKey);
            Map[] laps = restTemplate.getForObject(lapsUrl, Map[].class);

            Integer fastestLapDriver = null;
            Float fastestLapTime = null;
            if (laps != null) {
                for (Map lap : laps) {
                    Object duration = lap.get("lap_duration");
                    if (duration == null) continue;
                    float lapTime = ((Number) duration).floatValue();
                    if (fastestLapTime == null || lapTime < fastestLapTime) {
                        fastestLapTime = lapTime;
                        fastestLapDriver = (Integer) lap.get("driver_number");
                    }
                }
            }


            List<RaceResultRequest> requests = new ArrayList<>();
            List<Driver> ourDrivers = driverRepo.findAll();

            for (Map.Entry<Integer, Integer> entry : finalPositions.entrySet()) {
                int driverNumber = entry.getKey();
                int position = entry.getValue();

                String driverName = DRIVER_NUMBER_MAP.get(driverNumber);
                if (driverName == null) continue;


                Optional<Driver> driverOpt = ourDrivers.stream()
                        .filter(d -> d.getCarNumber() == driverNumber)
                        .findFirst();

                if (driverOpt.isEmpty()) {
                    log.warn("⚠️ Driver #{} not found in DB", driverNumber);
                    continue;
                }

                RaceResultRequest req = new RaceResultRequest();
                req.setDriverId(driverOpt.get().getId());
                req.setStartPosition(position);
                req.setFinishPosition(position);
                req.setHasFastestLap(fastestLapDriver != null && fastestLapDriver.equals(driverNumber));
                req.setFastestLapTime(fastestLapTime != null ? fastestLapTime : 0f);
                req.setFastestLapNumber(0);
                req.setDnfReason(null);
                requests.add(req);
            }

            if (requests.isEmpty()) {
                result.put("success", false);
                result.put("error", "No matching drivers found");
                return result;
            }


            raceResultService.submitResults(race.getId(), requests);
            log.info("✅ [OpenF1] Successfully synced {} results for {}", requests.size(), race.getName());

            result.put("success", true);
            result.put("race", race.getName());
            result.put("results_count", requests.size());
            result.put("fastest_lap_driver", fastestLapDriver);

        } catch (Exception e) {
            log.error("❌ [OpenF1] Sync failed for {}: {}", race.getName(), e.getMessage());
            result.put("success", false);
            result.put("error", e.getMessage());
        }

        return result;
    }
}
