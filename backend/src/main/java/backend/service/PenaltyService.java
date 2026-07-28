package backend.service;

import backend.model.Driver;
import backend.model.Penalty;
import backend.model.QualifyingResult;
import backend.model.Race;
import backend.model.enums.PenaltyType;
import backend.repository.DriverRepository;
import backend.repository.PenaltyRepository;
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
public class PenaltyService {

    private final PenaltyRepository penaltyRepo;
    private final QualifyingResultRepository qualifyingRepo;
    private final RaceRepository raceRepo;
    private final DriverRepository driverRepo;
    private final OpenF1SyncService openF1SyncService;
    private final RestTemplate restTemplate;

    private static final String OPENF1_BASE = "https://api.openf1.org/v1";

    // ─── Read ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getPenaltiesForRace(Long raceId) {
        List<Penalty> penalties = penaltyRepo.findByRaceIdOrderById(raceId);
        return penalties.stream().map(p -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", p.getId());
            map.put("type", p.getType().name());
            map.put("timeSeconds", p.getTimeSeconds());
            map.put("gridDrop", p.getGridDrop());
            map.put("reason", p.getReason());
            map.put("lap", p.getLap());
            map.put("driverId", p.getDriver() != null ? p.getDriver().getId() : null);
            map.put("driverName", p.getDriver() != null ? p.getDriver().getName() : "");
            map.put("carNumber", p.getDriver() != null ? p.getDriver().getCarNumber() : 0);
            map.put("teamName", p.getDriver() != null && p.getDriver().getTeam() != null
                    ? p.getDriver().getTeam().getName() : "");
            return map;
        }).collect(Collectors.toList());
    }

    // ─── Create ───────────────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> addPenalty(Long raceId, Long driverId, String typeStr,
                                           int gridDrop, int timeSeconds, String reason, int lap) {
        Race race = raceRepo.findById(raceId)
                .orElseThrow(() -> new RuntimeException("Race not found: " + raceId));
        Driver driver = driverRepo.findById(driverId)
                .orElseThrow(() -> new RuntimeException("Driver not found: " + driverId));

        PenaltyType type;
        try {
            type = PenaltyType.valueOf(typeStr.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Invalid penalty type: " + typeStr
                    + ". Valid: " + Arrays.toString(PenaltyType.values()));
        }

        Penalty penalty = Penalty.builder()
                .race(race)
                .driver(driver)
                .type(type)
                .gridDrop(gridDrop)
                .timeSeconds(timeSeconds)
                .reason(reason)
                .lap(lap)
                .build();

        penalty = penaltyRepo.save(penalty);
        log.info("⚖️ [Penalty] Added {} penalty for {} ({}): {} grid drop — {}",
                type, driver.getName(), race.getName(), gridDrop, reason);

        // Recalculate grid positions if there are grid drops
        if (gridDrop > 0 || type == PenaltyType.DISQUALIFIED || type == PenaltyType.GRID_DROP) {
            recalculateGrid(raceId);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", penalty.getId());
        result.put("type", type.name());
        result.put("gridDrop", gridDrop);
        result.put("reason", reason);
        result.put("driverName", driver.getName());
        result.put("success", true);
        return result;
    }

    // ─── Delete ──────────────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> deletePenalty(Long penaltyId) {
        Penalty penalty = penaltyRepo.findById(penaltyId)
                .orElseThrow(() -> new RuntimeException("Penalty not found: " + penaltyId));

        Long raceId = penalty.getRace().getId();
        penaltyRepo.delete(penalty);
        log.info("🗑 [Penalty] Deleted penalty #{} for {} at {}",
                penaltyId, penalty.getDriver().getName(), penalty.getRace().getName());

        // Recalculate grid after removal
        recalculateGrid(raceId);

        return Map.of("success", true, "message", "Penalty deleted and grid recalculated");
    }

    // ─── Grid Recalculation ──────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> recalculateGrid(Long raceId) {
        List<QualifyingResult> results = qualifyingRepo.findByRaceIdOrderByGridPosition(raceId);
        if (results.isEmpty()) {
            return Map.of("success", false, "message", "No qualifying results for this race");
        }

        // Ensure qualifyingPosition is set (migration for existing data)
        for (QualifyingResult qr : results) {
            if (qr.getQualifyingPosition() == 0) {
                qr.setQualifyingPosition(qr.getGridPosition());
            }
        }

        // Sort by qualifying position for consistent processing
        results.sort(Comparator.comparingInt(QualifyingResult::getQualifyingPosition));

        // Collect grid drop totals per driver
        List<Penalty> penalties = penaltyRepo.findByRaceIdOrderById(raceId);
        Map<Long, Integer> gridDrops = new HashMap<>(); // driverId → total grid drop
        Map<Long, Boolean> disqualified = new HashMap<>();

        for (Penalty p : penalties) {
            if (p.getDriver() == null) continue;
            Long dId = p.getDriver().getId();

            if (p.getType() == PenaltyType.DISQUALIFIED) {
                disqualified.put(dId, true);
            }

            if (p.getGridDrop() > 0 || p.getType() == PenaltyType.GRID_DROP) {
                gridDrops.merge(dId, p.getGridDrop(), Integer::sum);
            }
        }

        int totalDrivers = results.size();

        // Build list of (QualifyingResult, effectiveDrop)
        record GridEntry(QualifyingResult qr, int qualiPos, int drop) {}
        List<GridEntry> entries = new ArrayList<>();

        for (QualifyingResult qr : results) {
            Long dId = qr.getDriver() != null ? qr.getDriver().getId() : null;
            int drop = dId != null ? gridDrops.getOrDefault(dId, 0) : 0;

            // Disqualified drivers go to the back
            if (dId != null && disqualified.getOrDefault(dId, false)) {
                drop = totalDrivers; // effectivly push to back
            }

            entries.add(new GridEntry(qr, qr.getQualifyingPosition(), drop));
        }

        // Apply grid drops: simulate a grid where penalized drivers move back
        // Algorithm: assign grid positions 1..N in order of (qualiPos + effective penalty offset)
        // Drivers without penalties fill the gaps left by penalized drivers

        // Step 1: Build a list where each driver is mapped to their target slot
        // We use a "staggered" approach — penalized drivers move back by their drop,
        // others move up to fill vacancies

        // Simple approach: sort drivers by a penalty-aware ranking
        // The "target" for a driver = qualiPos + drop, capped at totalDrivers
        // Then re-number to resolve collisions

        record Slot(int driverIdx, int qualiPos, int rawTarget) {}

        List<Slot> slots = new ArrayList<>();
        for (int i = 0; i < entries.size(); i++) {
            GridEntry e = entries.get(i);
            int rawTarget = e.qualiPos + e.drop;
            if (rawTarget > totalDrivers) rawTarget = totalDrivers;
            slots.add(new Slot(i, e.qualiPos, rawTarget));
        }

        // Sort by: rawTarget asc, then qualiPos asc (for tie-breaking)
        slots.sort(Comparator.comparingInt((Slot s) -> s.rawTarget).thenComparingInt(s -> s.qualiPos));

        // Assign final grid positions 1..N
        for (int pos = 0; pos < slots.size(); pos++) {
            Slot slot = slots.get(pos);
            GridEntry entry = entries.get(slot.driverIdx);
            entry.qr.setGridPosition(pos + 1);
        }

        qualifyingRepo.saveAll(results);

        int affected = (int) results.stream().filter(qr -> qr.getGridPosition() != qr.getQualifyingPosition()).count();

        log.info("🏁 [Grid] Recalculated grid for race {}: {} drivers, {} position changes from penalties",
                raceId, totalDrivers, affected);

        return Map.of(
                "success", true,
                "raceId", raceId,
                "totalDrivers", totalDrivers,
                "positionChanges", affected,
                "penaltiesApplied", penalties.size()
        );
    }

    // ─── Auto-Sync Penalties from OpenF1 Starting Grid ────────────────────────

    /**
     * Fetches the starting grid from OpenF1 after qualifying and compares it
     * with the qualifying classification to auto-detect grid penalties.
     * If positions differ, creates penalty records automatically.
     */
    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> syncPenaltiesFromOpenF1(Long raceId) {
        Race race = raceRepo.findById(raceId)
                .orElseThrow(() -> new RuntimeException("Race not found: " + raceId));

        // Get qualifying session key
        Optional<Integer> sessionKeyOpt = openF1SyncService.findSessionKey(race, "Qualifying", false);
        if (sessionKeyOpt.isEmpty()) {
            return Map.of("success", false, "message", "No qualifying session found in OpenF1 for " + race.getName());
        }
        int sessionKey = sessionKeyOpt.get();

        // Fetch starting grid from OpenF1 (this reflects penalties already applied)
        String url = OPENF1_BASE + "/starting_grid?session_key=" + sessionKey;
        List<Map<String, Object>> gridData;
        try {
            gridData = restTemplate.getForObject(url, List.class);
        } catch (Exception e) {
            log.warn("[Penalty Sync] Failed to fetch starting_grid for {}: {}", race.getName(), e.getMessage());
            return Map.of("success", false, "message", "OpenF1 API error: " + e.getMessage());
        }

        if (gridData == null || gridData.isEmpty()) {
            return Map.of("success", false, "message", "No starting grid data available — session may not be complete yet");
        }

        // Get current qualifying results from DB
        List<QualifyingResult> qualiResults = qualifyingRepo.findByRaceIdOrderByGridPosition(raceId);
        if (qualiResults.isEmpty()) {
            return Map.of("success", false, "message", "Sync qualifying first — no qualifying results in DB");
        }

        // Map: car_number → actual grid position from OpenF1
        Map<Integer, Integer> actualGrid = new HashMap<>();
        for (Map<String, Object> entry : gridData) {
            Integer carNumber = toInt(entry.get("driver_number"));
            Integer gridPos = toInt(entry.get("position"));
            if (carNumber != null && gridPos != null && gridPos > 0) {
                actualGrid.put(carNumber, gridPos);
            }
        }

        if (actualGrid.isEmpty()) {
            return Map.of("success", false, "message", "Could not parse grid positions from OpenF1 data");
        }

        log.info("[Penalty Sync] Fetched starting grid for {} — {} drivers", race.getName(), actualGrid.size());

        // Compare DB qualifying positions with actual grid positions
        // Map carNumber → driverId for penalty creation
        Map<Integer, Long> carToDriverId = new HashMap<>();
        for (QualifyingResult qr : qualiResults) {
            if (qr.getDriver() != null) {
                carToDriverId.put(qr.getDriver().getCarNumber(), qr.getDriver().getId());
            }
        }

        int detected = 0;
        int updated = 0;

        for (QualifyingResult qr : qualiResults) {
            if (qr.getDriver() == null) continue;
            int carNumber = qr.getDriver().getCarNumber();
            Integer actualPos = actualGrid.get(carNumber);
            if (actualPos == null) continue;

            int qualiPos = qr.getQualifyingPosition() > 0 ? qr.getQualifyingPosition() : qr.getGridPosition();

            if (actualPos != qualiPos) {
                int drop = actualPos - qualiPos;

                if (drop > 0) {
                    // Driver was moved back → grid drop penalty detected
                    // Check if a grid drop penalty already exists
                    List<Penalty> existing = penaltyRepo.findByRaceIdAndDriverId(raceId, qr.getDriver().getId());
                    boolean alreadyHasGridDrop = existing.stream()
                            .anyMatch(p -> p.getType() == PenaltyType.GRID_DROP && p.getGridDrop() == drop);

                    if (!alreadyHasGridDrop) {
                        Penalty autoPenalty = Penalty.builder()
                                .race(race)
                                .driver(qr.getDriver())
                                .type(PenaltyType.GRID_DROP)
                                .gridDrop(drop)
                                .reason("Auto-detected: Qualified P" + qualiPos + " → Grid P" + actualPos)
                                .build();
                        penaltyRepo.save(autoPenalty);
                        detected++;
                        log.info("⚖️ [Auto-Detect] {} {}: P{} → P{} ({} position drop)",
                                race.getName(), qr.getDriver().getName(), qualiPos, actualPos, drop);
                    }

                    // Update grid position
                    qr.setGridPosition(actualPos);
                    updated++;
                } else if (drop < 0) {
                    // Driver moved UP — another driver's penalty pushed them forward
                    // Just update the position, don't create a penalty
                    qr.setGridPosition(actualPos);
                    updated++;
                }
            } else {
                // Position matches — update grid to match actual
                if (qr.getGridPosition() != actualPos) {
                    qr.setGridPosition(actualPos);
                    updated++;
                }
            }
        }

        if (updated > 0) {
            qualifyingRepo.saveAll(qualiResults);
        }

        log.info("✅ [Penalty Sync] {}: {} auto-detected penalties, {} positions updated",
                race.getName(), detected, updated);

        return Map.of(
                "success", true,
                "raceId", raceId,
                "raceName", race.getName(),
                "sessionKey", sessionKey,
                "driversOnGrid", actualGrid.size(),
                "penaltiesDetected", detected,
                "positionsUpdated", updated
        );
    }

    private static Integer toInt(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).intValue();
        try { return Integer.parseInt(o.toString()); } catch (Exception e) { return null; }
    }
}
