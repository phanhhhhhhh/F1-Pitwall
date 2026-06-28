package backend.security;

import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AccountLockoutService {

    private static final int MAX_ATTEMPTS = 5;
    private static final long LOCK_DURATION_MINUTES = 15;

    private final ConcurrentHashMap<String, FailedAttempt> attempts = new ConcurrentHashMap<>();

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

    private record FailedAttempt(int count, Instant lockUntil) {}
}
