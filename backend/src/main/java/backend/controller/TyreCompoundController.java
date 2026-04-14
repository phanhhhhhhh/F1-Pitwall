package backend.controller;

import backend.model.TyreCompound;
import backend.service.TyreCompoundService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tyrecompounds")
@RequiredArgsConstructor
public class TyreCompoundController {
    private final TyreCompoundService service;

    @GetMapping
    public List<TyreCompound> getAll() { return service.getAll(); }

    @GetMapping("/{id}")
    public TyreCompound getById(@PathVariable Long id) { return service.getById(id); }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<TyreCompound> create(@RequestBody TyreCompound entity) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(entity));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public TyreCompound update(@PathVariable Long id, @RequestBody TyreCompound entity) {
        return service.update(id, entity);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.ok(Map.of("message", "Deleted successfully"));
    }
}
