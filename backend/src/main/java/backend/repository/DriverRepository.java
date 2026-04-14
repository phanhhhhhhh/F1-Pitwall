package backend.repository;

import backend.model.Driver;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DriverRepository extends JpaRepository<Driver, Long> {
    List<Driver> findByTeamId(Long teamId);
    Optional<Driver> findByCarNumber(int carNumber);
    List<Driver> findByNationality(String nationality);

    @Query("SELECT d FROM Driver d ORDER BY d.careerPoints DESC")
    List<Driver> findAllOrderByCareerPoints();
}
