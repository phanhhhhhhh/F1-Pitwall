package backend.controller;

import backend.dto.StrategyPlanRequest;
import backend.dto.StrategyPlanResponse;
import backend.service.StrategyPlanService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/strategy")
@RequiredArgsConstructor
public class StrategyPlanController {

    private final StrategyPlanService service;

    @GetMapping("/circuit/{circuitId}")
    public ResponseEntity<List<StrategyPlanResponse>> listForCircuit(@PathVariable Long circuitId) {
        return ResponseEntity.ok(service.listForCircuit(circuitId));
    }

    @PostMapping("/circuit/{circuitId}")
    @PreAuthorize("hasAnyRole('ADMIN','ENGINEER')")
    public ResponseEntity<StrategyPlanResponse> create(
            @PathVariable Long circuitId,
            @Valid @RequestBody StrategyPlanRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(circuitId, request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ENGINEER')")
    public ResponseEntity<StrategyPlanResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody StrategyPlanRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ENGINEER')")
    public ResponseEntity<Map<String, String>> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.ok(Map.of("message", "Deleted successfully"));
    }
}
