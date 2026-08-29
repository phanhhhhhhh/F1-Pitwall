package backend.repository;

import backend.model.QualifyingResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface QualifyingResultRepository extends JpaRepository<QualifyingResult, Long> {

    List<QualifyingResult> findByRaceIdOrderByGridPosition(Long raceId);

    /** All qualifying results of a season in one query — driver ratings need the whole set at once. */
    @Query("SELECT q FROM QualifyingResult q JOIN FETCH q.driver d LEFT JOIN FETCH d.team JOIN FETCH q.race r WHERE r.season = :season")
    List<QualifyingResult> findBySeasonWithDriver(@Param("season") int season);

    boolean existsByRaceId(Long raceId);

    @Modifying
    @Transactional
    @Query("DELETE FROM QualifyingResult q WHERE q.race.id = :raceId")
    void deleteByRaceId(Long raceId);
}