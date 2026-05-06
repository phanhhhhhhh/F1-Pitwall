package backend.controller;

import backend.model.Circuit;
import backend.model.Race;
import backend.model.RaceResult;
import backend.model.enums.RaceStatus;
import backend.repository.CircuitRepository;
import backend.repository.RaceRepository;
import backend.repository.RaceResultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/migration")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class DataMigrationController {

    private final RaceRepository raceRepo;
    private final CircuitRepository circuitRepo;
    private final RaceResultRepository raceResultRepo;

    @PostMapping("/add-sprint-races")
    public ResponseEntity<Map<String, Object>> addSprintRaces() {
        List<String> added = new ArrayList<>();
        List<String> skipped = new ArrayList<>();

        List<Map<String, Object>> sprintRaces = List.of(
            Map.of("name", "Chinese Grand Prix Sprint", "round", 2,
                   "date", "2026-03-22", "country", "China", "status", "COMPLETED"),
            Map.of("name", "Miami Grand Prix Sprint", "round", 6,
                   "date", "2026-05-02", "country", "United States", "status", "COMPLETED"),
            Map.of("name", "Belgian Grand Prix Sprint", "round", 13,
                   "date", "2026-07-25", "country", "Belgium", "status", "SCHEDULED"),
            Map.of("name", "São Paulo Grand Prix Sprint", "round", 21,
                   "date", "2026-11-07", "country", "Brazil", "status", "SCHEDULED"),
            Map.of("name", "Qatar Grand Prix Sprint", "round", 23,
                   "date", "2026-11-28", "country", "Qatar", "status", "SCHEDULED")
        );

        for (Map<String, Object> sr : sprintRaces) {
            String name = (String) sr.get("name");
            if (raceRepo.findBySeason(2026).stream()
                    .anyMatch(r -> r.getName().equalsIgnoreCase(name))) {
                skipped.add(name + " (already exists)");
                continue;
            }
            String country = (String) sr.get("country");
            Optional<Circuit> circuit = circuitRepo.findAll().stream()
                    .filter(c -> country.equalsIgnoreCase(c.getCountry()) ||
                                 c.getName().toLowerCase().contains(country.toLowerCase()))
                    .findFirst();
            if (circuit.isEmpty()) {
                skipped.add(name + " (circuit not found for: " + country + ")");
                continue;
            }
            Race race = Race.builder()
                    .name(name).season(2026)
                    .roundNumber((Integer) sr.get("round"))
                    .date(LocalDate.parse((String) sr.get("date")))
                    .circuit(circuit.get())
                    .status(RaceStatus.valueOf((String) sr.get("status")))
                    .build();
            raceRepo.save(race);
            added.add(name);
        }
        return ResponseEntity.ok(Map.of("added", added, "skipped", skipped, "total", added.size()));
    }

    // Fix duplicate race results — xóa bản ghi trùng, chỉ giữ 1 per driver per race
    @PostMapping("/fix-duplicates")
    public ResponseEntity<Map<String, Object>> fixDuplicates() {
        List<String> fixed = new ArrayList<>();
        int totalDeleted = 0;

        List<Race> races = raceRepo.findBySeason(2026);
        for (Race race : races) {
            List<RaceResult> results = raceResultRepo.findByRaceIdOrderByFinishPosition(race.getId());
            if (results.isEmpty()) continue;

            // Group by driverId, keep only the one with lowest id (first inserted)
            Map<Long, List<RaceResult>> byDriver = results.stream()
                .collect(Collectors.groupingBy(r -> r.getDriver().getId()));

            List<Long> toDelete = new ArrayList<>();
            for (Map.Entry<Long, List<RaceResult>> entry : byDriver.entrySet()) {
                List<RaceResult> driverResults = entry.getValue();
                if (driverResults.size() > 1) {
                    driverResults.sort(Comparator.comparing(RaceResult::getId));
                    for (int i = 1; i < driverResults.size(); i++) {
                        toDelete.add(driverResults.get(i).getId());
                    }
                }
            }

            if (!toDelete.isEmpty()) {
                for (Long id : toDelete) {
                    raceResultRepo.deleteById(id);
                }
                totalDeleted += toDelete.size();
                fixed.add(race.getName() + ": deleted " + toDelete.size() + " duplicates");
            }
        }

        return ResponseEntity.ok(Map.of(
            "fixed", fixed,
            "totalDeleted", totalDeleted,
            "message", totalDeleted > 0 ? "Duplicates removed" : "No duplicates found"
        ));
    }

    @PostMapping("/fix-fastest-lap")
    public ResponseEntity<Map<String, Object>> fixFastestLap(
            @RequestParam Long removeFromId,
            @RequestParam Long addToId) {
        try {
            RaceResult wrong = raceResultRepo.findById(removeFromId)
                .orElseThrow(() -> new RuntimeException("Not found: " + removeFromId));
            wrong.setHasFastestLap(false);
            wrong.setPoints(wrong.getPoints() - 1);
            raceResultRepo.save(wrong);

            RaceResult correct = raceResultRepo.findById(addToId)
                .orElseThrow(() -> new RuntimeException("Not found: " + addToId));
            correct.setHasFastestLap(true);
            correct.setPoints(correct.getPoints() + 1);
            raceResultRepo.save(correct);

            return ResponseEntity.ok(Map.of("success", true,
                "removed", wrong.getDriver().getName(),
                "added", correct.getDriver().getName()));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("success", false, "error", e.getMessage()));
        }
    }

    @DeleteMapping("/clear-race/{raceId}")
    public ResponseEntity<Map<String, Object>> clearRaceResults(@PathVariable Long raceId) {
        int count = raceResultRepo.findByRaceIdOrderByFinishPosition(raceId).size();
        raceResultRepo.deleteByRaceId(raceId);
        return ResponseEntity.ok(Map.of("deleted", count, "raceId", raceId));
    }

    @PutMapping("/update-result/{resultId}")
    public ResponseEntity<Map<String, Object>> updateResult(
            @PathVariable Long resultId,
            @RequestParam(required = false) Integer points,
            @RequestParam(required = false) Integer position) {
        try {
            RaceResult result = raceResultRepo.findById(resultId)
                .orElseThrow(() -> new RuntimeException("Not found: " + resultId));

            if (points != null) result.setPoints(points);
            if (position != null) result.setFinishPosition(position);

            raceResultRepo.save(result);

            return ResponseEntity.ok(Map.of("success", true,
                "driver", result.getDriver().getName(),
                "newPoints", result.getPoints(),
                "newPosition", result.getFinishPosition()));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("success", false, "error", e.getMessage()));
        }
    }
}
