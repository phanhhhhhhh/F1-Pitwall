package backend.service;

import backend.model.Driver;
import backend.model.Team;
import backend.repository.DriverRepository;
import backend.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DriverService {
    private final DriverRepository driverRepository;
    private final TeamRepository teamRepository;

    public List<Driver> getAll() { return driverRepository.findAllWithTeam(); }

    public Page<Driver> getPaged(Pageable pageable) { return driverRepository.findAllWithTeam(pageable); }
    public List<Driver> getByTeam(Long teamId) { return driverRepository.findByTeamIdWithTeam(teamId); }
    public List<Driver> getLeaderboard() { return driverRepository.findAllOrderByCareerPointsWithTeam(); }

    public Driver getById(Long id) {
        return driverRepository.findByIdWithTeam(id)
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

    @Transactional
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
