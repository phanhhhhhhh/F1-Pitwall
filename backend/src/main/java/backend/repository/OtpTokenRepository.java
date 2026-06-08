package backend.repository;

import backend.model.OtpToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.Optional;

public interface OtpTokenRepository extends JpaRepository<OtpToken, Long> {

    Optional<OtpToken> findTopByEmailAndCodeAndTypeAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
            String email, String code, OtpToken.OtpType type, LocalDateTime now);

    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM OtpToken o WHERE o.email = :email AND o.type = :type AND o.used = false")
    void deleteByEmailAndTypeAndUsedFalse(String email, OtpToken.OtpType type);

    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM OtpToken o WHERE o.expiresAt < :now")
    void deleteAllExpired(LocalDateTime now);
}
