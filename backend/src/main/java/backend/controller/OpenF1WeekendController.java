package backend.controller;

import backend.service.OpenF1SessionService;
import backend.service.OpenF1WeekendService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/openf1")
@RequiredArgsConstructor
public class OpenF1WeekendController {

    private final OpenF1WeekendService weekendService;
    private final OpenF1SessionService sessionService;

    /**
     * GET /api/openf1/weekend
     * Trả về race weekend schedule với trạng thái từng session (LIVE/UPCOMING/COMPLETED)
     * Dùng cho Overview và Race Calendar widget
     */
    @GetMapping("/weekend")
    public ResponseEntity<Map<String, Object>> getWeekend() {
        return ResponseEntity.ok(weekendService.getWeekend());
    }

    /**
     * POST /api/openf1/weekend/refresh
     * Force refresh cache
     */
    @PostMapping("/weekend/refresh")
    public ResponseEntity<Map<String, Object>> refreshWeekend() {
        weekendService.refreshCache();
        return ResponseEntity.ok(weekendService.getWeekend());
    }

    /**
     * POST /api/openf1/sessions/cache/clear
     * Clear session results cache (use when data seems stale for live sessions)
     */
    @PostMapping("/sessions/cache/clear")
    public ResponseEntity<Map<String, Object>> clearSessionCache() {
        sessionService.clearCache();
        return ResponseEntity.ok(Map.of("status", "cleared"));
    }

    /**
     * GET /api/openf1/race/{raceId}/sessions
     * Trả về danh sách sessions (FP1/FP2/FP3/Quali/Race) cho một race weekend cụ thể.
     */
    @GetMapping("/race/{raceId}/sessions")
    public ResponseEntity<List<Map<String, Object>>> getRaceSessions(@PathVariable Long raceId) {
        return ResponseEntity.ok(sessionService.getSessionsForRace(raceId));
    }

    /**
     * GET /api/openf1/session/{sessionKey}/results
     * Trả về fastest lap của từng driver trong session (FP1/FP2/FP3/Quali).
     */
    @GetMapping("/session/{sessionKey}/results")
    public ResponseEntity<List<Map<String, Object>>> getSessionResults(@PathVariable Long sessionKey) {
        return ResponseEntity.ok(sessionService.getSessionResults(sessionKey));
    }
}
