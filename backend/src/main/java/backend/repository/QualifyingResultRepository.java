package backend.repository;

import backend.model.QualifyingResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface QualifyingResultRepository extends JpaRepository<QualifyingResult, Long> {

    List<QualifyingResult> findByRaceIdOrderByGridPosition(Long raceId);

    boolean existsByRaceId(Long raceId);

    @Modifying
    @Transactional
    @Query("DELETE FROM QualifyingResult q WHERE q.race.id = :raceId")
    void deleteByRaceId(Long raceId);
}
