package backend.controller;

import backend.model.Circuit;
import backend.service.CircuitService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/circuits")
@RequiredArgsConstructor
public class CircuitController {
    private final CircuitService service;

    @GetMapping
    public List<Circuit> getAll() { return service.getAll(); }

    @GetMapping("/{id}")
    public Circuit getById(@PathVariable Long id) { return service.getById(id); }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Circuit> create(@RequestBody Circuit entity) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(entity));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public Circuit update(@PathVariable Long id, @RequestBody Circuit entity) {
        return service.update(id, entity);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.ok(Map.of("message", "Deleted successfully"));
    }
}
