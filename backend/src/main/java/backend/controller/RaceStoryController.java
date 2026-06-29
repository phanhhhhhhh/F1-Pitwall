package backend.controller;

import backend.service.RaceStoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Exposes the "story" of a race — pit stops, weather, and incidents —
 * data that is already synced from OpenF1 but had no REST surface.
 */
@RestController
@RequestMapping("/api/races")
@RequiredArgsConstructor
public class RaceStoryController {

    private final RaceStoryService raceStoryService;

    @GetMapping("/{raceId}/pit-stops")
    @PreAuthorize("hasAnyRole('ADMIN', 'ENGINEER', 'VIEWER')")
    public ResponseEntity<List<Map<String, Object>>> getPitStops(@PathVariable Long raceId) {
        return ResponseEntity.ok(raceStoryService.getPitStops(raceId));
    }

    @GetMapping("/{raceId}/weather")
    @PreAuthorize("hasAnyRole('ADMIN', 'ENGINEER', 'VIEWER')")
    public ResponseEntity<List<Map<String, Object>>> getWeather(@PathVariable Long raceId) {
        return ResponseEntity.ok(raceStoryService.getWeather(raceId));
    }

    @GetMapping("/{raceId}/incidents")
    @PreAuthorize("hasAnyRole('ADMIN', 'ENGINEER', 'VIEWER')")
    public ResponseEntity<List<Map<String, Object>>> getIncidents(@PathVariable Long raceId) {
        return ResponseEntity.ok(raceStoryService.getIncidents(raceId));
    }
}
