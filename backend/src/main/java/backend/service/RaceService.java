package backend.service;

import backend.model.Race;
import backend.model.Circuit;
import backend.model.enums.RaceStatus;
import backend.repository.RaceRepository;
import backend.repository.CircuitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RaceService {
    private final RaceRepository raceRepository;
    private final CircuitRepository circuitRepository;

    public List<Race> getAll() { return raceRepository.findAll(); }
    public List<Race> getBySeason(int season) { return raceRepository.findBySeasonOrderByRoundNumber(season); }
    public List<Race> getByStatus(RaceStatus status) { return raceRepository.findByStatus(status); }

    public Race getById(Long id) {
        return raceRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Race not found: " + id));
    }

    public Race create(Race race, Long circuitId) {
        Circuit circuit = circuitRepository.findById(circuitId)
                .orElseThrow(() -> new RuntimeException("Circuit not found: " + circuitId));
        race.setCircuit(circuit);
        return raceRepository.save(race);
    }

    public Race updateStatus(Long id, RaceStatus status) {
        Race race = getById(id);
        race.setStatus(status);
        return raceRepository.save(race);
    }

    public void delete(Long id) {
        if (!raceRepository.existsById(id)) throw new RuntimeException("Race not found: " + id);
        raceRepository.deleteById(id);
    }
}
