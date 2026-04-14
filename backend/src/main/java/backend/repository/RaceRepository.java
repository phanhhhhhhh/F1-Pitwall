package backend.repository;

import backend.model.Race;
import backend.model.enums.RaceStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RaceRepository extends JpaRepository<Race, Long> {
    List<Race> findBySeason(int season);
    List<Race> findByStatus(RaceStatus status);
    List<Race> findBySeasonOrderByRoundNumber(int season);
}
