package backend.security;

import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class TokenBlacklistService {

    private final ConcurrentHashMap<String, Instant> blacklist = new ConcurrentHashMap<>();

    public void blacklist(String token, long expirationMs) {
        String hash = hashToken(token);
        Instant expiry = Instant.now().plusMillis(expirationMs);
        blacklist.put(hash, expiry);
    }

    public boolean isBlacklisted(String token) {
        cleanup();
        String hash = hashToken(token);
        return blacklist.containsKey(hash);
    }

    public void cleanup() {
        Instant now = Instant.now();
        blacklist.values().removeIf(expiry -> now.isAfter(expiry));
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
