package backend.controller;

import backend.dto.CircuitGeometryResponse;
import backend.model.Circuit;
import backend.service.CircuitGeometryService;
import backend.service.CircuitService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
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
    private final CircuitGeometryService geometryService;

    @GetMapping
    public List<Circuit> getAll() { return service.getAll(); }

    /**
     * The circuit's racing line as a 3D poly-line, for the track viewer and the live map.
     * Built from external sources on first request, then served from the database.
     */
    @GetMapping("/{id}/geometry")
    public CircuitGeometryResponse getGeometry(@PathVariable Long id) {
        return geometryService.get(id);
    }

    /** Forces a rebuild of one circuit's geometry from the external sources. */
    @PostMapping("/{id}/geometry/sync")
    @PreAuthorize("hasRole('ADMIN')")
    public CircuitGeometryResponse syncGeometry(@PathVariable Long id) {
        return geometryService.sync(id);
    }

    /**
     * Builds geometry for every circuit that is missing it. Pass {@code force=true} to refresh
     * circuits that already have cached geometry.
     */
    @PostMapping("/geometry/sync-all")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> syncAllGeometry(@RequestParam(defaultValue = "false") boolean force) {
        return geometryService.syncAll(force);
    }

    /**
     * Paginated circuit list.
     * GET /api/circuits/paged?page=0&size=20&sort=name,asc
     */
    @GetMapping("/paged")
    public Page<Circuit> getPaged(
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return service.getPaged(pageable);
    }

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
