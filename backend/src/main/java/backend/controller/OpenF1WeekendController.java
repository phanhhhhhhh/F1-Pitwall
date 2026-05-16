package backend.controller;

import backend.service.OpenF1WeekendService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/openf1")
@RequiredArgsConstructor
public class OpenF1WeekendController {

    private final OpenF1WeekendService weekendService;

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
}
