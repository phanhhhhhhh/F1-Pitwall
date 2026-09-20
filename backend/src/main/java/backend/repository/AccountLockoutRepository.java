package backend.repository;

import backend.model.AccountLockout;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface AccountLockoutRepository extends JpaRepository<AccountLockout, String> {

    List<AccountLockout> findByLockedUntilAfter(Instant now);
}
