package backend.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import backend.model.AccountLockout;
import backend.repository.AccountLockoutRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.TimeUnit;

@Service
public class AccountLockoutService {

    private static final int MAX_ATTEMPTS = 5;
    private static final long LOCK_DURATION_MINUTES = 15;

    /** Bounded cache — evicts entries 30 min after last access (2× lockout window),
     *  max 50 000 entries. Prevents unbounded memory growth from fake-username
     *  lockout tracking. Same pattern as RateLimitFilter (Fix #4). */
    private final Cache<String, FailedAttempt> cache = Caffeine.newBuilder()
            .expireAfterAccess(30, TimeUnit.MINUTES)
            .maximumSize(50_000)
            .build();
    private final ConcurrentMap<String, FailedAttempt> attempts = cache.asMap();

    private static final Logger log = LoggerFactory.getLogger(AccountLockoutService.class);

    /** Only active lockouts are persisted (sub-threshold counters stay in memory) so a
     *  restart can't be used to shed a lock that is already in force. */
    private final AccountLockoutRepository repository;

    public AccountLockoutService(AccountLockoutRepository repository) {
        this.repository = repository;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void loadPersisted() {
        try {
            repository.findByLockedUntilAfter(Instant.now()).forEach(l ->
                    attempts.put(l.getUsername(), new FailedAttempt(MAX_ATTEMPTS, l.getLockedUntil())));
        } catch (RuntimeException e) {
            log.warn("[Auth] Could not restore account lockouts: {}", e.getMessage());
        }
    }

    private void persistLock(String username, Instant until) {
        try {
            repository.save(new AccountLockout(username, until));
        } catch (RuntimeException e) {
            log.warn("[Auth] Could not persist lockout: {}", e.getMessage());
        }
    }

    private void clearPersisted(String username) {
        try {
            repository.deleteById(username);
        } catch (RuntimeException e) {
            // no row, or DB unavailable — memory state is already cleared
            log.debug("[Auth] Could not clear persisted lockout: {}", e.getMessage());
        }
    }

    public void loginFailed(String username) {
        attempts.compute(username, (key, existing) -> {
            if (existing == null) {
                return new FailedAttempt(1, null);
            }
            int newCount = existing.count() + 1;
            if (newCount >= MAX_ATTEMPTS) {
                Instant until = Instant.now().plus(Duration.ofMinutes(LOCK_DURATION_MINUTES));
                persistLock(username, until);
                return new FailedAttempt(newCount, until);
            }
            return new FailedAttempt(newCount, null);
        });
    }

    public void loginSucceeded(String username) {
        FailedAttempt removed = attempts.remove(username);
        if (removed != null && removed.lockUntil() != null) clearPersisted(username);
    }

    public boolean isLocked(String username) {
        FailedAttempt fa = attempts.get(username);
        if (fa == null) return false;
        if (fa.lockUntil() != null && Instant.now().isBefore(fa.lockUntil())) {
            return true;
        }
        if (fa.lockUntil() != null && !Instant.now().isBefore(fa.lockUntil())) {
            attempts.remove(username);
            clearPersisted(username);
        }
        return false;
    }

    public long getUnlockSeconds(String username) {
        FailedAttempt fa = attempts.get(username);
        if (fa != null && fa.lockUntil() != null) {
            long seconds = Duration.between(Instant.now(), fa.lockUntil()).getSeconds();
            return Math.max(0, seconds);
        }
        return 0;
    }

    public int getRemainingAttempts(String username) {
        FailedAttempt fa = attempts.get(username);
        if (fa == null) return MAX_ATTEMPTS;
        return Math.max(0, MAX_ATTEMPTS - fa.count());
    }

    /** Exposed for diagnostic / verification. */
    public long getAttemptCount() { return cache.estimatedSize(); }

    private record FailedAttempt(int count, Instant lockUntil) {}
}
