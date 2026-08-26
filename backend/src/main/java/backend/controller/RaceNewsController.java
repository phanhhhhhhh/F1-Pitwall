package backend.controller;

import backend.dto.RaceNewsRequest;
import backend.dto.RaceNewsResponse;
import backend.service.RaceNewsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/news")
@RequiredArgsConstructor
public class RaceNewsController {

    private final RaceNewsService raceNewsService;

    @GetMapping
    public ResponseEntity<List<RaceNewsResponse>> listBySeason(@RequestParam int season) {
        return ResponseEntity.ok(raceNewsService.listBySeason(season));
    }

    @GetMapping("/{id}")
    public ResponseEntity<RaceNewsResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(raceNewsService.getById(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<RaceNewsResponse> create(@RequestBody RaceNewsRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(raceNewsService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<RaceNewsResponse> update(@PathVariable Long id, @RequestBody RaceNewsRequest request) {
        return ResponseEntity.ok(raceNewsService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> delete(@PathVariable Long id) {
        raceNewsService.delete(id);
        return ResponseEntity.ok(Map.of("message", "Race news deleted"));
    }
}
