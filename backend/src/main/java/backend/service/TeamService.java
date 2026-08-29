package backend.service;

import backend.dto.TeamLiveryResponse;
import backend.model.Driver;
import backend.model.Team;
import backend.repository.DriverRepository;
import backend.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TeamService {
    private final TeamRepository teamRepository;
    private final DriverRepository driverRepository;

    public List<Team> getAll() { return teamRepository.findAll(); }

    /**
     * Teams with both livery colours and their current line-up, for the 3D car inspector. Teams with
     * no driver assigned are still returned — an empty line-up is a data gap worth showing, not a
     * reason to hide the team.
     */
    @Transactional(readOnly = true)
    public List<TeamLiveryResponse> getLiveries() {
        Map<Long, List<Driver>> driversByTeam = driverRepository.findAllWithTeam().stream()
                .filter(d -> d.getTeam() != null)
                .collect(Collectors.groupingBy(d -> d.getTeam().getId()));

        return teamRepository.findAll().stream()
                .sorted(Comparator.comparing(Team::getName))
                .map(team -> TeamLiveryResponse.builder()
                        .id(team.getId())
                        .name(team.getName())
                        .country(team.getCountry())
                        .colorHex(team.getColorHex())
                        .accentHex(team.getAccentHex())
                        .engineSupplier(team.getEngineSupplier())
                        .carName(team.getCarName())
                        .teamPrincipal(team.getTeamPrincipal())
                        .base(team.getBase())
                        .championships(team.getChampionships())
                        .foundedYear(team.getFoundedYear())
                        .annualBudgetM(team.getAnnualBudgetM())
                        .drivers(driversByTeam.getOrDefault(team.getId(), List.of()).stream()
                                .sorted(Comparator.comparingInt(Driver::getCarNumber))
                                .map(d -> TeamLiveryResponse.LiveryDriver.builder()
                                        .id(d.getId())
                                        .name(d.getName())
                                        .carNumber(d.getCarNumber())
                                        .nationality(d.getNationality())
                                        .build())
                                .toList())
                        .build())
                .toList();
    }

    public Team getById(Long id) {
        return teamRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Team not found: " + id));
    }

    public Team create(Team team) {
        if (teamRepository.existsByName(team.getName()))
            throw new RuntimeException("Team already exists: " + team.getName());
        return teamRepository.save(team);
    }

    @Transactional
    public Team update(Long id, Team updated) {
        Team existing = getById(id);
        existing.setName(updated.getName());
        existing.setCountry(updated.getCountry());
        existing.setColorHex(updated.getColorHex());
        existing.setAccentHex(updated.getAccentHex());
        existing.setEngineSupplier(updated.getEngineSupplier());
        existing.setCarName(updated.getCarName());
        existing.setTeamPrincipal(updated.getTeamPrincipal());
        existing.setAnnualBudgetM(updated.getAnnualBudgetM());
        existing.setChampionships(updated.getChampionships());
        return teamRepository.save(existing);
    }

    public void delete(Long id) {
        if (!teamRepository.existsById(id)) throw new RuntimeException("Team not found: " + id);
        teamRepository.deleteById(id);
    }
}
