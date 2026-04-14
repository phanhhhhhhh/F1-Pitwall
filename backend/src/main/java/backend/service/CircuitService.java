package backend.service;

import backend.model.Circuit;
import backend.repository.CircuitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CircuitService {
    private final CircuitRepository repository;

    public List<Circuit> getAll() { return repository.findAll(); }

    public Circuit getById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Circuit not found: " + id));
    }

    public Circuit create(Circuit entity) { return repository.save(entity); }

    public Circuit update(Long id, Circuit updated) {
        getById(id);
        updated.setId(id);
        return repository.save(updated);
    }

    public void delete(Long id) {
        if (!repository.existsById(id)) throw new RuntimeException("Circuit not found: " + id);
        repository.deleteById(id);
    }
}
