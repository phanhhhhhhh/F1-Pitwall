package backend.security;

import backend.model.OtpToken;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.TimeUnit;

/** Brute-force guard for OTP verification, scoped per (email, OtpType). Without this,
 *  a 6-digit OTP has no attempt limit of its own and can be brute-forced across the
 *  1,000,000-code space. Same cache/lockout shape as AccountLockoutService. */
@Service
public class OtpAttemptService {

    private static final int MAX_ATTEMPTS = 5;
    private static final long LOCK_DURATION_MINUTES = 15;

    private final Cache<String, FailedAttempt> cache = Caffeine.newBuilder()
            .expireAfterAccess(30, TimeUnit.MINUTES)
            .maximumSize(50_000)
            .build();
    private final ConcurrentMap<String, FailedAttempt> attempts = cache.asMap();

    private static String key(String email, OtpToken.OtpType type) {
        return type + ":" + email;
    }

    public void recordFailure(String email, OtpToken.OtpType type) {
        attempts.compute(key(email, type), (k, existing) -> {
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

    public void reset(String email, OtpToken.OtpType type) {
        attempts.remove(key(email, type));
    }

    public boolean isLocked(String email, OtpToken.OtpType type) {
        FailedAttempt fa = attempts.get(key(email, type));
        if (fa == null) return false;
        if (fa.lockUntil() != null && Instant.now().isBefore(fa.lockUntil())) {
            return true;
        }
        if (fa.lockUntil() != null && !Instant.now().isBefore(fa.lockUntil())) {
            attempts.remove(key(email, type));
        }
        return false;
    }

    private record FailedAttempt(int count, Instant lockUntil) {}
}
