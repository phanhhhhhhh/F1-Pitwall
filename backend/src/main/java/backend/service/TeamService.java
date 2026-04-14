package backend.service;

import backend.model.Team;
import backend.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TeamService {
    private final TeamRepository teamRepository;

    public List<Team> getAll() { return teamRepository.findAll(); }

    public Team getById(Long id) {
        return teamRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Team not found: " + id));
    }

    public Team create(Team team) {
        if (teamRepository.existsByName(team.getName()))
            throw new RuntimeException("Team already exists: " + team.getName());
        return teamRepository.save(team);
    }

    public Team update(Long id, Team updated) {
        Team existing = getById(id);
        existing.setName(updated.getName());
        existing.setCountry(updated.getCountry());
        existing.setColorHex(updated.getColorHex());
        existing.setAnnualBudgetM(updated.getAnnualBudgetM());
        existing.setChampionships(updated.getChampionships());
        return teamRepository.save(existing);
    }

    public void delete(Long id) {
        if (!teamRepository.existsById(id)) throw new RuntimeException("Team not found: " + id);
        teamRepository.deleteById(id);
    }
}
