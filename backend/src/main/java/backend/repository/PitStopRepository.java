package backend.repository;

import backend.model.PitStop;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PitStopRepository extends JpaRepository<PitStop, Long> {
    @Query("SELECT ps FROM PitStop ps JOIN FETCH ps.raceResult rr JOIN FETCH rr.driver d JOIN FETCH d.team WHERE rr.race.id = :raceId ORDER BY ps.lapNumber, rr.finishPosition")
    List<PitStop> findByRaceIdWithDriver(@Param("raceId") Long raceId);
}
