package backend.security;

import backend.dto.AuthResponse;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

/**
 * Short-lived, single-use codes that stand in for tokens in the OAuth redirect. The browser is
 * sent to the frontend with only the opaque code in the URL; the frontend swaps it for the real
 * tokens over a POST, so tokens never land in browser history, Referer headers or access logs.
 * In-memory: fine for one instance, and a lost code just means the user retries the login.
 */
@Component
public class OAuthLoginCodeStore {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final Cache<String, AuthResponse> codes = Caffeine.newBuilder()
            .expireAfterWrite(60, TimeUnit.SECONDS)
            .maximumSize(10_000)
            .build();

    public String issue(AuthResponse response) {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String code = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        codes.put(code, response);
        return code;
    }

    /** Returns the stored login at most once; a second call with the same code gets nothing. */
    public Optional<AuthResponse> consume(String code) {
        if (code == null || code.isBlank()) return Optional.empty();
        return Optional.ofNullable(codes.asMap().remove(code));
    }
}
