package backend.service;

import backend.model.TyreCompound;
import backend.repository.TyreCompoundRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TyreCompoundService {
    private final TyreCompoundRepository repository;

    public List<TyreCompound> getAll() { return repository.findAll(); }

    public TyreCompound getById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new RuntimeException("TyreCompound not found: " + id));
    }

    public TyreCompound create(TyreCompound entity) { return repository.save(entity); }

    public TyreCompound update(Long id, TyreCompound updated) {
        getById(id);
        updated.setId(id);
        return repository.save(updated);
    }

    public void delete(Long id) {
        if (!repository.existsById(id)) throw new RuntimeException("TyreCompound not found: " + id);
        repository.deleteById(id);
    }
}
