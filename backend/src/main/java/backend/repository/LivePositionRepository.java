package backend.repository;

import backend.model.LivePosition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LivePositionRepository extends JpaRepository<LivePosition, Long> {
    List<LivePosition> findBySessionKey(int sessionKey);
    void deleteBySessionKey(int sessionKey);
}
