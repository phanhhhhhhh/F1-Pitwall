package backend.repository;

import backend.model.WeatherCondition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface WeatherConditionRepository extends JpaRepository<WeatherCondition, Long> {}
