package backend.repository;

import backend.model.CarSetup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CarSetupRepository extends JpaRepository<CarSetup, Long> {}
