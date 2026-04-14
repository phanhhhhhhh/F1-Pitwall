package backend.repository;

import backend.model.DriverContract;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DriverContractRepository extends JpaRepository<DriverContract, Long> {}
