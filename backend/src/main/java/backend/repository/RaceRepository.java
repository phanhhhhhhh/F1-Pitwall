package backend.repository;

import backend.model.Race;
import backend.model.enums.RaceStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RaceRepository extends JpaRepository<Race, Long> {
    List<Race> findBySeason(int season);
    List<Race> findByStatus(RaceStatus status);
    List<Race> findBySeasonOrderByRoundNumber(int season);

    List<Race> findAllByOrderBySeasonDescRoundNumberAsc();

    @Query("SELECT r FROM Race r LEFT JOIN FETCH r.circuit WHERE r.season = :season ORDER BY r.roundNumber")
    List<Race> findBySeasonWithCircuit(@Param("season") int season);

    @Query("SELECT r FROM Race r LEFT JOIN FETCH r.circuit WHERE r.circuit.id = :circuitId ORDER BY r.season DESC, r.roundNumber DESC")
    List<Race> findByCircuitIdWithCircuit(@Param("circuitId") Long circuitId);

    @Query("SELECT r FROM Race r LEFT JOIN FETCH r.circuit ORDER BY r.season DESC, r.roundNumber")
    List<Race> findAllWithCircuit();

    @Query("SELECT r FROM Race r LEFT JOIN FETCH r.circuit WHERE r.id = :id")
    Optional<Race> findByIdWithCircuit(@Param("id") Long id);
}
