package backend.controller;

import backend.service.OpenF1SyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/sync")
@RequiredArgsConstructor
public class SyncController {

    private final OpenF1SyncService syncService;

    // Sync all past races without results
    @PostMapping("/all")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> syncAll() {
        return ResponseEntity.ok(syncService.manualSync());
    }

    // Sync a specific race
    @PostMapping("/race/{raceId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> syncRace(@PathVariable Long raceId) {
        return ResponseEntity.ok(syncService.syncRace(raceId));
    }
}
