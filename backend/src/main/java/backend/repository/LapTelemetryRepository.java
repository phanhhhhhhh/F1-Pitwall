package backend.repository;

import backend.model.LapTelemetry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LapTelemetryRepository extends JpaRepository<LapTelemetry, Long> {
    List<LapTelemetry> findByRaceResultId(Long raceResultId);
    List<LapTelemetry> findByRaceResultIdOrderByLapNumber(Long raceResultId);

    /** All lap telemetry of a season, ordered so stints can be walked per race result. */
    @Query("SELECT t FROM LapTelemetry t JOIN FETCH t.raceResult rr JOIN rr.race r WHERE r.season = :season ORDER BY rr.id, t.lapNumber")
    List<LapTelemetry> findBySeason(@Param("season") int season);
}
