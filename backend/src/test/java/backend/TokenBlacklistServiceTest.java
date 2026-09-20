package backend;

import backend.repository.BlacklistedTokenRepository;
import backend.security.TokenBlacklistService;
import org.junit.jupiter.api.AfterEach;
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

    @AfterEach
    void clean() { repository.deleteAll(); }

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
    void expiredEntriesAreNotRestoredAndArePurged() throws InterruptedException {
        service.blacklist("token-expired", 20);
        service.blacklist("token-live", 60_000);
        Thread.sleep(50);
        assertThat(service.isBlacklisted("token-expired")).isFalse();

        TokenBlacklistService restarted = new TokenBlacklistService(repository);
        restarted.loadPersisted();
        assertThat(restarted.isBlacklisted("token-expired")).isFalse();
        assertThat(restarted.isBlacklisted("token-live")).isTrue();

        assertThat(repository.count()).isEqualTo(2);
        service.cleanup();
        assertThat(repository.count()).isEqualTo(1);
    }
}
