package backend.repository;

import backend.model.AdminAuditEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AdminAuditRepository extends JpaRepository<AdminAuditEntry, Long> {

    List<AdminAuditEntry> findTop100ByOrderByIdDesc();
}
