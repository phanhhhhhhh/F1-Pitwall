package backend.controller;

import backend.repository.QualifyingResultRepository;
import backend.repository.RaceResultRepository;
import backend.service.OpenF1SyncService;
import backend.service.QualifyingService;
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
    private final QualifyingService qualifyingService;
    private final RaceResultRepository raceResultRepo;
    private final QualifyingResultRepository qualifyingRepo;

    // Sync tất cả races đã hoàn thành
    @PostMapping("/all")
    @PreAuthorize("hasAnyRole('ADMIN', 'ENGINEER')")
    public ResponseEntity<Map<String, Object>> syncAll() {
        Map<String, Object> result = syncService.syncRecentSessions();
        return ResponseEntity.ok(result);
    }

    // Re-sync race results (xóa cũ, sync lại — dùng khi có penalty)
    @PostMapping("/race/{raceId}/results")
    @PreAuthorize("hasAnyRole('ADMIN', 'ENGINEER')")
    public ResponseEntity<Map<String, Object>> resyncRaceResults(@PathVariable Long raceId) {
        try {
            raceResultRepo.deleteByRaceId(raceId);
            Map<String, Object> result = syncService.syncRecentSessions();
            return ResponseEntity.ok(Map.of("success", true, "raceId", raceId, "message", "Re-synced successfully"));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("success", false, "error", e.getMessage()));
        }
    }

    // Re-sync qualifying (xóa cũ, sync lại)
    @PostMapping("/race/{raceId}/qualifying")
    @PreAuthorize("hasAnyRole('ADMIN', 'ENGINEER')")
    public ResponseEntity<Map<String, Object>> resyncQualifying(@PathVariable Long raceId) {
        try {
            qualifyingRepo.deleteByRaceId(raceId);
            Map<String, Object> result = qualifyingService.syncQualifying(raceId);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("success", false, "error", e.getMessage()));
        }
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
