package backend.repository;

import backend.model.StrategyPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StrategyPlanRepository extends JpaRepository<StrategyPlan, Long> {
    List<StrategyPlan> findByRaceIdOrderByIdDesc(Long raceId);
}
