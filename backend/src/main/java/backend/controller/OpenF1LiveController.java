package backend.controller;

import backend.service.OpenF1LiveService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/openf1")
@RequiredArgsConstructor
public class OpenF1LiveController {

    private final OpenF1LiveService openF1LiveService;

    // Status — includes session info
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        return ResponseEntity.ok(Map.of(
            "isLive", openF1LiveService.isSessionLive(),
            "sessionKey", openF1LiveService.getSessionKey() != null ? openF1LiveService.getSessionKey() : "none",
            "sessionName", openF1LiveService.getSessionName() != null ? openF1LiveService.getSessionName() : "",
            "sessionType", openF1LiveService.getSessionType() != null ? openF1LiveService.getSessionType() : "",
            "circuitName", openF1LiveService.getCircuitName() != null ? openF1LiveService.getCircuitName() : "",
            "countryName", openF1LiveService.getCountryName() != null ? openF1LiveService.getCountryName() : "",
            "sessionEmoji", openF1LiveService.getSessionEmoji(),
            "driversCount", openF1LiveService.getLiveData().size()
        ));
    }

    // Live tyre data
    @GetMapping("/tyres")
    public ResponseEntity<List<Map<String, Object>>> getLiveTyres() {
        return ResponseEntity.ok(openF1LiveService.getLiveData());
    }

    // Force fetch
    @PostMapping("/fetch")
    public ResponseEntity<Map<String, Object>> forceFetch() {
        return ResponseEntity.ok(openF1LiveService.forceFetch());
    }
}
