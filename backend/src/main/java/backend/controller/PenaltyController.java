package backend.controller;

import backend.service.PenaltyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/penalties")
@RequiredArgsConstructor
public class PenaltyController {

    private final PenaltyService penaltyService;

    @GetMapping("/race/{raceId}")
    public ResponseEntity<List<Map<String, Object>>> getPenalties(@PathVariable Long raceId) {
        return ResponseEntity.ok(penaltyService.getPenaltiesForRace(raceId));
    }

    @PostMapping("/race/{raceId}")
    @PreAuthorize("hasAnyRole('ADMIN','ENGINEER')")
    public ResponseEntity<Map<String, Object>> addPenalty(
            @PathVariable Long raceId,
            @RequestBody Map<String, Object> body) {

        Long driverId = toLong(body.get("driverId"));
        String type = String.valueOf(body.getOrDefault("type", "GRID_DROP"));
        int gridDrop = toInt(body.get("gridDrop"), 0);
        int timeSeconds = toInt(body.get("timeSeconds"), 0);
        String reason = String.valueOf(body.getOrDefault("reason", ""));
        int lap = toInt(body.get("lap"), 0);

        return ResponseEntity.ok(penaltyService.addPenalty(raceId, driverId, type, gridDrop, timeSeconds, reason, lap));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ENGINEER')")
    public ResponseEntity<Map<String, Object>> deletePenalty(@PathVariable Long id) {
        return ResponseEntity.ok(penaltyService.deletePenalty(id));
    }

    @PostMapping("/race/{raceId}/recalculate")
    @PreAuthorize("hasAnyRole('ADMIN','ENGINEER')")
    public ResponseEntity<Map<String, Object>> recalculateGrid(@PathVariable Long raceId) {
        return ResponseEntity.ok(penaltyService.recalculateGrid(raceId));
    }

    @PostMapping("/sync/race/{raceId}")
    @PreAuthorize("hasAnyRole('ADMIN','ENGINEER')")
    public ResponseEntity<Map<String, Object>> syncFromOpenF1(@PathVariable Long raceId) {
        return ResponseEntity.ok(penaltyService.syncPenaltiesFromOpenF1(raceId));
    }

    private static Long toLong(Object o) {
        if (o == null) throw new RuntimeException("driverId is required");
        if (o instanceof Number) return ((Number) o).longValue();
        try { return Long.parseLong(o.toString()); } catch (Exception e) { throw new RuntimeException("Invalid driverId: " + o); }
    }

    private static int toInt(Object o, int defaultVal) {
        if (o == null) return defaultVal;
        if (o instanceof Number) return ((Number) o).intValue();
        try { return Integer.parseInt(o.toString()); } catch (Exception e) { return defaultVal; }
    }
}
