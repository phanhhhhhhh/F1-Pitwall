package backend.controller;

import backend.model.LapTelemetry;
import backend.service.TelemetryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/telemetry")
@RequiredArgsConstructor
public class TelemetryController {
    private final TelemetryService telemetryService;

    @GetMapping("/race-result/{raceResultId}")
    public List<LapTelemetry> getByRaceResult(@PathVariable Long raceResultId) {
        return telemetryService.getByRaceResult(raceResultId);
    }

    @PostMapping("/race-result/{raceResultId}")
    @PreAuthorize("hasAnyRole('ADMIN','ENGINEER')")
    public ResponseEntity<LapTelemetry> addLap(
            @PathVariable Long raceResultId,
            @RequestBody LapTelemetry lap) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(telemetryService.addLap(raceResultId, lap));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        telemetryService.delete(id);
        return ResponseEntity.ok(Map.of("message", "Lap deleted"));
    }
}
