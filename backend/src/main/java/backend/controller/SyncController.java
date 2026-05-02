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

    // Sync tất cả races đã hoàn thành
    @PostMapping("/all")
    @PreAuthorize("hasAnyRole('ADMIN', 'ENGINEER')")
    public ResponseEntity<Map<String, Object>> syncAll() {
        Map<String, Object> result = syncService.syncRecentSessions();
        return ResponseEntity.ok(result);
    }

    // Sync một session cụ thể bằng session key
    @PostMapping("/session/{sessionKey}")
    @PreAuthorize("hasAnyRole('ADMIN', 'ENGINEER')")
    public ResponseEntity<Map<String, Object>> syncSession(
            @PathVariable int sessionKey,
            @RequestParam(defaultValue = "false") boolean sprint,
            @RequestParam(defaultValue = "") String countryName) {
        boolean success = syncService.syncSession(sessionKey, countryName, sprint);
        return ResponseEntity.ok(Map.of(
            "success", success,
            "sessionKey", sessionKey,
            "type", sprint ? "Sprint" : "Race"
        ));
    }
}
