package backend.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.jspecify.annotations.NonNull;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.TimeUnit;

@Component
@Order(1)
public class RateLimitFilter extends OncePerRequestFilter {

    private static final java.util.Set<String> RATE_LIMITED_PATHS = java.util.Set.of(
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/forgot-password",
            "/api/auth/otp/send",
            "/api/auth/otp/verify",
            "/api/auth/oauth2/resend-otp",
            "/api/auth/oauth2/verify-otp"
    );

    /** Bounded cache — evicts IP entries 10 min after last access, max 50 000 entries. */
    private final Cache<String, Bucket> buckets = Caffeine.newBuilder()
            .expireAfterAccess(10, TimeUnit.MINUTES)
            .maximumSize(50_000)
            .build();

    private static Bucket createBucket() {
        return Bucket.builder()
                .addLimit(Bandwidth.builder().capacity(5).refillGreedy(5, Duration.ofMinutes(1)).build())
                .build();
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        String path = request.getRequestURI();

        if (!RATE_LIMITED_PATHS.contains(path)) {
            filterChain.doFilter(request, response);
            return;
        }

        // X-Forwarded-For is fully client-controlled unless server.forward-headers-strategy
        // is configured to trust a specific reverse proxy (it isn't here) — keying the
        // bucket on it lets an attacker mint a fresh rate-limit bucket per request by
        // sending a new header value each time. request.getRemoteAddr() is the actual
        // TCP peer and can't be spoofed by the client.
        String ip = request.getRemoteAddr();

        Bucket bucket = buckets.get(ip, k -> createBucket());

        if (bucket.tryConsume(1)) {
            filterChain.doFilter(request, response);
        } else {
            long retryAfterSeconds = bucket.getAvailableTokens() == 0
                    ? Duration.ofMinutes(1).toSeconds()
                    : 0;

            response.setContentType("application/json");
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.getWriter().write(
                    "{\"error\":\"Too many requests\"," +
                    "\"message\":\"Rate limit exceeded. Try again in " + retryAfterSeconds + " seconds.\"," +
                    "\"retryAfterSeconds\":" + retryAfterSeconds + "}"
            );
        }
    }
}
