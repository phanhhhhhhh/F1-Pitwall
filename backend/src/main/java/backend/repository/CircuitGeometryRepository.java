package backend.repository;

import backend.model.CircuitGeometry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CircuitGeometryRepository extends JpaRepository<CircuitGeometry, Long> {
    Optional<CircuitGeometry> findByCircuitId(Long circuitId);
    boolean existsByCircuitId(Long circuitId);
}
