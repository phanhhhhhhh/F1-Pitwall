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

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        return ResponseEntity.ok(Map.of(
            "isLive", openF1LiveService.isRaceLive(),
            "sessionKey", openF1LiveService.getSessionKey() != null
                ? openF1LiveService.getSessionKey() : "none",
            "driversCount", openF1LiveService.getLiveData().size()
        ));
    }
    
    @GetMapping("/tyres")
    public ResponseEntity<List<Map<String, Object>>> getLiveTyres() {
        return ResponseEntity.ok(openF1LiveService.getLiveData());
    }

    @PostMapping("/fetch")
    public ResponseEntity<Map<String, Object>> forceFetch() {
        return ResponseEntity.ok(openF1LiveService.forceFetch());
    }
}
