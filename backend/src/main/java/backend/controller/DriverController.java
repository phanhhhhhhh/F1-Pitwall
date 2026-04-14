package backend.controller;

import backend.model.Driver;
import backend.service.DriverService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/drivers")
@RequiredArgsConstructor
public class DriverController {
    private final DriverService driverService;

    @GetMapping
    public List<Driver> getAll() { return driverService.getAll(); }

    @GetMapping("/{id}")
    public Driver getById(@PathVariable Long id) { return driverService.getById(id); }

    @GetMapping("/team/{teamId}")
    public List<Driver> getByTeam(@PathVariable Long teamId) { return driverService.getByTeam(teamId); }

    @GetMapping("/leaderboard")
    public List<Driver> getLeaderboard() { return driverService.getLeaderboard(); }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Driver> create(
            @Valid @RequestBody Driver driver,
            @RequestParam(required = false) Long teamId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(driverService.create(driver, teamId));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public Driver update(
            @PathVariable Long id,
            @RequestBody Driver driver,
            @RequestParam(required = false) Long teamId) {
        return driverService.update(id, driver, teamId);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        driverService.delete(id);
        return ResponseEntity.ok(Map.of("message", "Driver deleted"));
    }
}
