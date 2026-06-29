package backend.repository;

import backend.model.WeatherCondition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WeatherConditionRepository extends JpaRepository<WeatherCondition, Long> {
    List<WeatherCondition> findByRaceIdOrderById(Long raceId);
}
