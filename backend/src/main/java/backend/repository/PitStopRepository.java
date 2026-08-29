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

    /** All pit stops of a season, keyed back to their race result. */
    @Query("SELECT ps FROM PitStop ps JOIN FETCH ps.raceResult rr JOIN rr.race r WHERE r.season = :season")
    List<PitStop> findBySeason(@Param("season") int season);

    /** Season pit stops with driver, team snapshot and race attached — for the benchmark leaderboard. */
    @Query("SELECT ps FROM PitStop ps JOIN FETCH ps.raceResult rr JOIN FETCH rr.driver d LEFT JOIN FETCH d.team LEFT JOIN FETCH rr.team JOIN FETCH rr.race r WHERE r.season = :season")
    List<PitStop> findBySeasonWithDriver(@Param("season") int season);
}
