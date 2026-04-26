package backend.repository;

import backend.model.RaceResult;
import backend.model.enums.RaceStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface RaceResultRepository extends JpaRepository<RaceResult, Long> {

    List<RaceResult> findByRaceIdOrderByFinishPosition(Long raceId);

    @Query("SELECT r FROM RaceResult r JOIN FETCH r.driver d JOIN FETCH d.team t JOIN FETCH r.race rc WHERE rc.season = :season AND rc.status = :status")
    List<RaceResult> findByRaceSeasonAndRaceStatus(int season, RaceStatus status);

    @Modifying
    @Transactional
    @Query("DELETE FROM RaceResult r WHERE r.race.id = :raceId")
    void deleteByRaceId(Long raceId);

    boolean existsByRaceId(Long raceId);
}
