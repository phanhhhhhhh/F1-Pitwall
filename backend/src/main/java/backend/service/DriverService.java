package backend.service;

import backend.model.Driver;
import backend.model.Team;
import backend.repository.DriverRepository;
import backend.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DriverService {
    private final DriverRepository driverRepository;
    private final TeamRepository teamRepository;

    public List<Driver> getAll() { return driverRepository.findAll(); }
    public List<Driver> getByTeam(Long teamId) { return driverRepository.findByTeamId(teamId); }
    public List<Driver> getLeaderboard() { return driverRepository.findAllOrderByCareerPoints(); }

    public Driver getById(Long id) {
        return driverRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Driver not found: " + id));
    }

    public Driver create(Driver driver, Long teamId) {
        if (teamId != null) {
            Team team = teamRepository.findById(teamId)
                    .orElseThrow(() -> new RuntimeException("Team not found: " + teamId));
            driver.setTeam(team);
        }
        return driverRepository.save(driver);
    }

    public Driver update(Long id, Driver updated, Long teamId) {
        Driver existing = getById(id);
        existing.setName(updated.getName());
        existing.setCarNumber(updated.getCarNumber());
        existing.setNationality(updated.getNationality());
        existing.setDateOfBirth(updated.getDateOfBirth());
        if (teamId != null) {
            Team team = teamRepository.findById(teamId)
                    .orElseThrow(() -> new RuntimeException("Team not found"));
            existing.setTeam(team);
        }
        return driverRepository.save(existing);
    }

    public void delete(Long id) {
        if (!driverRepository.existsById(id)) throw new RuntimeException("Driver not found: " + id);
        driverRepository.deleteById(id);
    }
}
