package backend.repository;

import backend.model.RaceResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RaceResultRepository extends JpaRepository<RaceResult, Long> {
    List<RaceResult> findByDriverId(Long driverId);
    List<RaceResult> findByRaceId(Long raceId);

    @Query("SELECT r FROM RaceResult r WHERE r.race.season = :season ORDER BY r.points DESC")
    List<RaceResult> findBySeasonOrderByPoints(int season);
}
