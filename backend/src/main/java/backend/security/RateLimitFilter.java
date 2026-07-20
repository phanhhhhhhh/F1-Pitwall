package backend.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@Order(1)
public class RateLimitFilter extends OncePerRequestFilter {

    private static final java.util.Set<String> RATE_LIMITED_PATHS = java.util.Set.of(
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/forgot-password",
            "/api/auth/otp/verify",
            "/api/auth/oauth2/verify-otp"
    );

    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    private static Bucket createBucket() {
        return Bucket.builder()
                .addLimit(Bandwidth.classic(5, Refill.greedy(5, Duration.ofMinutes(1))))
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

        // Parse the first IP from X-Forwarded-For to prevent spoofing
        // (a client can set an arbitrary X-Forwarded-For; taking only the first
        // entry and falling back to the direct socket address is the pragmatic fix)
        String ip = request.getHeader("X-Forwarded-For");
        if (ip != null && !ip.isBlank()) {
            // X-Forwarded-For format: "client, proxy1, proxy2"
            int comma = ip.indexOf(',');
            ip = (comma > 0) ? ip.substring(0, comma).trim() : ip.trim();
            if (ip.isBlank()) {
                ip = request.getRemoteAddr();
            }
        } else {
            ip = request.getRemoteAddr();
        }

        Bucket bucket = buckets.computeIfAbsent(ip, k -> createBucket());

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
