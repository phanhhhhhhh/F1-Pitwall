package backend.controller;

import backend.model.Race;
import backend.model.enums.RaceStatus;
import backend.service.RaceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/races")
@RequiredArgsConstructor
public class RaceController {
    private final RaceService raceService;

    @GetMapping
    public List<Race> getAll() { return raceService.getAll(); }

    @GetMapping("/{id}")
    public Race getById(@PathVariable Long id) { return raceService.getById(id); }

    @GetMapping("/season/{season}")
    public List<Race> getBySeason(@PathVariable int season) { return raceService.getBySeason(season); }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Race> create(
            @RequestBody Race race,
            @RequestParam Long circuitId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(raceService.create(race, circuitId));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','ENGINEER')")
    public Race updateStatus(@PathVariable Long id, @RequestParam RaceStatus status) {
        return raceService.updateStatus(id, status);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        raceService.delete(id);
        return ResponseEntity.ok(Map.of("message", "Race deleted"));
    }
}
