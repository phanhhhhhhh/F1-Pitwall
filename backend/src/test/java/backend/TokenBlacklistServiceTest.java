package backend;

import backend.repository.BlacklistedTokenRepository;
import backend.security.TokenBlacklistService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles({ "test", "ci" })
class TokenBlacklistServiceTest {

    @Autowired TokenBlacklistService service;
    @Autowired BlacklistedTokenRepository repository;

    @Test
    void blacklistedTokenIsRejectedAndUnknownIsNot() {
        service.blacklist("token-a", 60_000);
        assertThat(service.isBlacklisted("token-a")).isTrue();
        assertThat(service.isBlacklisted("token-b")).isFalse();
    }

    @Test
    void revocationSurvivesRestart() {
        service.blacklist("token-persist", 60_000);
        // A fresh instance over the same database models a process restart.
        TokenBlacklistService restarted = new TokenBlacklistService(repository);
        assertThat(restarted.isBlacklisted("token-persist")).isFalse();
        restarted.loadPersisted();
        assertThat(restarted.isBlacklisted("token-persist")).isTrue();
    }

    @Test
    void expiredEntriesAreNotRestoredAndArePurged() {
        service.blacklist("token-expired", -1_000);
        assertThat(service.isBlacklisted("token-expired")).isFalse();

        TokenBlacklistService restarted = new TokenBlacklistService(repository);
        restarted.loadPersisted();
        assertThat(restarted.isBlacklisted("token-expired")).isFalse();

        service.cleanup();
        assertThat(repository.count()).isEqualTo(
                repository.findByExpiresAtAfter(java.time.Instant.now()).size());
    }
}
