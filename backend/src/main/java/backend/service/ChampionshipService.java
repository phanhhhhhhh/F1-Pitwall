package backend.service;

import backend.model.Championship;
import backend.repository.ChampionshipRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ChampionshipService {
    private final ChampionshipRepository repository;

    public List<Championship> getAll() { return repository.findAll(); }

    public Championship getById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Championship not found: " + id));
    }

    public Championship create(Championship entity) { return repository.save(entity); }

    public Championship update(Long id, Championship updated) {
        getById(id);
        updated.setId(id);
        return repository.save(updated);
    }

    public void delete(Long id) {
        if (!repository.existsById(id)) throw new RuntimeException("Championship not found: " + id);
        repository.deleteById(id);
    }
}
