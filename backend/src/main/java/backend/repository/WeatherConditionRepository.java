package backend.repository;

import backend.model.WeatherCondition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WeatherConditionRepository extends JpaRepository<WeatherCondition, Long> {
    List<WeatherCondition> findByRaceIdOrderById(Long raceId);

    /** All weather rows of a season, used to classify races as wet or dry. */
    @Query("SELECT w FROM WeatherCondition w JOIN FETCH w.race r WHERE r.season = :season")
    List<WeatherCondition> findBySeason(@Param("season") int season);
}
