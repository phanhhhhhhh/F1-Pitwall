package backend.controller;

import backend.dto.DriverProfileResponse;
import backend.model.Driver;
import backend.service.DriverRatingService;
import backend.service.DriverService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
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
    private final DriverRatingService ratingService;

    @GetMapping
    public List<Driver> getAll() { return driverService.getAll(); }

    /**
     * Ability ratings for the whole grid, derived from the season's race data, ordered best first.
     * Each profile carries the measurements behind it so the UI can show why a driver is rated
     * where they are.
     */
    @GetMapping("/profiles")
    public List<DriverProfileResponse> getProfiles(@RequestParam(required = false) Integer season) {
        return ratingService.getProfiles(resolveSeason(season));
    }

    /** Ability ratings for one driver. */
    @GetMapping("/{id}/profile")
    public DriverProfileResponse getProfile(
            @PathVariable Long id,
            @RequestParam(required = false) Integer season) {
        return ratingService.getProfile(id, resolveSeason(season));
    }

    private int resolveSeason(Integer season) {
        return season != null ? season : java.time.Year.now().getValue();
    }

    /**
     * Paginated driver list.
     * GET /api/drivers/paged?page=0&size=20&sort=carNumber,asc
     */
    @GetMapping("/paged")
    public Page<Driver> getPaged(
            @PageableDefault(size = 20, sort = "carNumber") Pageable pageable) {
        return driverService.getPaged(pageable);
    }

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
