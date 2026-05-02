package backend.controller;

import backend.model.Circuit;
import backend.model.Race;
import backend.model.enums.RaceStatus;
import backend.repository.CircuitRepository;
import backend.repository.RaceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/admin/migration")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class DataMigrationController {

    private final RaceRepository raceRepo;
    private final CircuitRepository circuitRepo;

    @PostMapping("/add-sprint-races")
    public ResponseEntity<Map<String, Object>> addSprintRaces() {
        List<String> added = new ArrayList<>();
        List<String> skipped = new ArrayList<>();

        // Sprint weekends 2026
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

            // Skip if already exists
            if (raceRepo.findBySeason(2026).stream()
                    .anyMatch(r -> r.getName().equalsIgnoreCase(name))) {
                skipped.add(name + " (already exists)");
                continue;
            }

            // Find circuit by country
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
                    .name(name)
                    .season(2026)
                    .roundNumber((Integer) sr.get("round"))
                    .date(LocalDate.parse((String) sr.get("date")))
                    .circuit(circuit.get())
                    .status(RaceStatus.valueOf((String) sr.get("status")))
                    .build();

            raceRepo.save(race);
            added.add(name);
        }

        return ResponseEntity.ok(Map.of(
            "added", added,
            "skipped", skipped,
            "total", added.size()
        ));
    }
}
