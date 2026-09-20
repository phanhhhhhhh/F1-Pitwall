package backend;

import backend.repository.AccountLockoutRepository;
import backend.security.AccountLockoutService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles({ "test", "ci" })
class AccountLockoutServiceTest {

    @Autowired AccountLockoutService service;
    @Autowired AccountLockoutRepository repository;

    @Test
    void locksAfterFiveFailuresAndSurvivesRestart() {
        String user = "lock-restart-user";
        for (int i = 0; i < 4; i++) service.loginFailed(user);
        assertThat(service.isLocked(user)).isFalse();
        service.loginFailed(user);
        assertThat(service.isLocked(user)).isTrue();

        AccountLockoutService restarted = new AccountLockoutService(repository);
        assertThat(restarted.isLocked(user)).isFalse();
        restarted.loadPersisted();
        assertThat(restarted.isLocked(user)).isTrue();
    }

    @Test
    void successfulLoginClearsPersistedLock() {
        String user = "lock-clear-user";
        for (int i = 0; i < 5; i++) service.loginFailed(user);
        assertThat(repository.existsById(user)).isTrue();

        service.loginSucceeded(user);
        assertThat(service.isLocked(user)).isFalse();
        assertThat(repository.existsById(user)).isFalse();
    }
}
