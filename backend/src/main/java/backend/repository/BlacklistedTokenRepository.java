package backend.repository;

import backend.model.BlacklistedToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

public interface BlacklistedTokenRepository extends JpaRepository<BlacklistedToken, String> {

    List<BlacklistedToken> findByExpiresAtAfter(Instant now);

    @Transactional
    @Modifying
    @Query("DELETE FROM BlacklistedToken t WHERE t.expiresAt < :now")
    int deleteAllExpired(Instant now);
}
