package backend.repository;

import backend.model.Driver;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DriverRepository extends JpaRepository<Driver, Long> {
    List<Driver> findByTeamId(Long teamId);
    Optional<Driver> findByCarNumber(int carNumber);
    Optional<Driver> findByNameAndCarNumber(String name, int carNumber);
    List<Driver> findByNationality(String nationality);

    @Query("SELECT d FROM Driver d ORDER BY d.careerPoints DESC")
    List<Driver> findAllOrderByCareerPoints();

    @Query("SELECT d FROM Driver d LEFT JOIN FETCH d.team ORDER BY d.carNumber")
    List<Driver> findAllWithTeam();

    @Query(value = "SELECT d FROM Driver d LEFT JOIN FETCH d.team",
           countQuery = "SELECT count(d) FROM Driver d")
    Page<Driver> findAllWithTeam(Pageable pageable);

    @Query("SELECT d FROM Driver d LEFT JOIN FETCH d.team WHERE d.id = :id")
    Optional<Driver> findByIdWithTeam(@Param("id") Long id);

    @Query("SELECT d FROM Driver d LEFT JOIN FETCH d.team WHERE d.team.id = :teamId")
    List<Driver> findByTeamIdWithTeam(@Param("teamId") Long teamId);

    @Query("SELECT d FROM Driver d LEFT JOIN FETCH d.team ORDER BY d.careerPoints DESC")
    List<Driver> findAllOrderByCareerPointsWithTeam();
}
