package backend.security;

import backend.model.BlacklistedToken;
import backend.repository.BlacklistedTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Revoked-token store. Lookups are served from memory (this runs on every authenticated
 * request); every revocation is written through to the database and reloaded on startup,
 * so logouts survive a restart or redeploy.
 */
@Service
public class TokenBlacklistService {

    private static final Logger log = LoggerFactory.getLogger(TokenBlacklistService.class);

    private final ConcurrentHashMap<String, Instant> blacklist = new ConcurrentHashMap<>();
    private final BlacklistedTokenRepository repository;

    public TokenBlacklistService(BlacklistedTokenRepository repository) {
        this.repository = repository;
    }

    // @PostConstruct: must finish before the web server binds, or revoked/locked state is
    // ignored while the seeders run.
    @jakarta.annotation.PostConstruct
    public void loadPersisted() {
        try {
            repository.findByExpiresAtAfter(Instant.now())
                    .forEach(t -> blacklist.put(t.getTokenHash(), t.getExpiresAt()));
            log.info("[Auth] Restored {} revoked tokens", blacklist.size());
        } catch (RuntimeException e) {
            log.error("[Auth] Could not restore revoked tokens: {}", e.getMessage());
        }
    }

    public void blacklist(String token, long expirationMs) {
        String hash = hashToken(token);
        Instant expiry = Instant.now().plusMillis(expirationMs);
        blacklist.put(hash, expiry);
        try {
            repository.save(new BlacklistedToken(hash, expiry));
        } catch (RuntimeException e) {
            // Still revoked in memory for this run; persistence is best-effort.
            log.error("[Auth] Could not persist revoked token: {}", e.getMessage());
        }
    }

    public boolean isBlacklisted(String token) {
        Instant expiry = blacklist.get(hashToken(token));
        return expiry != null && Instant.now().isBefore(expiry);
    }

    @Scheduled(fixedDelay = 3_600_000, initialDelay = 3_600_000)
    public void cleanup() {
        Instant now = Instant.now();
        blacklist.values().removeIf(now::isAfter);
        try {
            repository.deleteAllExpired(now);
        } catch (RuntimeException e) {
            log.warn("[Auth] Could not purge expired revoked tokens: {}", e.getMessage());
        }
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashBytes);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }
}
