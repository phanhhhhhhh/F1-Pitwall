package backend.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
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

    public void loginFailed(String username) {
        attempts.compute(username, (key, existing) -> {
            if (existing == null) {
                return new FailedAttempt(1, null);
            }
            int newCount = existing.count() + 1;
            if (newCount >= MAX_ATTEMPTS) {
                return new FailedAttempt(newCount, Instant.now().plus(Duration.ofMinutes(LOCK_DURATION_MINUTES)));
            }
            return new FailedAttempt(newCount, null);
        });
    }

    public void loginSucceeded(String username) {
        attempts.remove(username);
    }

    public boolean isLocked(String username) {
        FailedAttempt fa = attempts.get(username);
        if (fa == null) return false;
        if (fa.lockUntil() != null && Instant.now().isBefore(fa.lockUntil())) {
            return true;
        }
        if (fa.lockUntil() != null && !Instant.now().isBefore(fa.lockUntil())) {
            attempts.remove(username);
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
