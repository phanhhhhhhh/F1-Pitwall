package backend.repository;

import backend.model.Penalty;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface PenaltyRepository extends JpaRepository<Penalty, Long> {

    List<Penalty> findByRaceIdOrderById(Long raceId);

    List<Penalty> findByRaceIdAndDriverId(Long raceId, Long driverId);

    @Modifying
    @Transactional
    @Query("DELETE FROM Penalty p WHERE p.race.id = :raceId")
    void deleteByRaceId(Long raceId);
}
