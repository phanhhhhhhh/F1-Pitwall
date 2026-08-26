package backend.repository;

import backend.model.RaceNews;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RaceNewsRepository extends JpaRepository<RaceNews, Long> {

    @Query("SELECT n FROM RaceNews n JOIN FETCH n.race WHERE n.race.season = :season ORDER BY n.race.date DESC, n.id DESC")
    List<RaceNews> findByRaceSeasonOrderByRaceDateDescIdDesc(int season);

    @Query("SELECT n FROM RaceNews n JOIN FETCH n.race WHERE n.id = :id")
    Optional<RaceNews> findByIdWithRace(Long id);

    Optional<RaceNews> findByRaceIdAndTag(Long raceId, String tag);

    boolean existsByTitle(String title);
}
