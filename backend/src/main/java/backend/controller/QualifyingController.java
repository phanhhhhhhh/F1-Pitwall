package backend.controller;

import backend.model.QualifyingResult;
import backend.service.QualifyingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/qualifying")
@RequiredArgsConstructor
public class QualifyingController {

    private final QualifyingService qualifyingService;

    @GetMapping("/race/{raceId}")
    public ResponseEntity<List<Map<String, Object>>> getQualifying(@PathVariable Long raceId) {
        return ResponseEntity.ok(qualifyingService.getQualifyingResults(raceId));
    }

    @PostMapping("/sync/race/{raceId}")
    public ResponseEntity<Map<String, Object>> syncQualifying(@PathVariable Long raceId) {
        return ResponseEntity.ok(qualifyingService.syncQualifying(raceId));
    }

    @PostMapping("/sync/all")
    public ResponseEntity<Map<String, Object>> syncAll() {
        return ResponseEntity.ok(qualifyingService.syncAllQualifying());
    }
}
