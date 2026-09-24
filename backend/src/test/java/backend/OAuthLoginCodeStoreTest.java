package backend;

import backend.dto.AuthResponse;
import backend.security.OAuthLoginCodeStore;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("OAuthLoginCodeStore")
class OAuthLoginCodeStoreTest {

    private final OAuthLoginCodeStore store = new OAuthLoginCodeStore();

    private static AuthResponse login(String user) {
        return AuthResponse.builder().accessToken("a").refreshToken("r").username(user).role("VIEWER").expiresIn(900).build();
    }

    @Test
    @DisplayName("a code redeems exactly once")
    void singleUse() {
        String code = store.issue(login("alice"));
        assertThat(store.consume(code)).get().extracting(AuthResponse::getUsername).isEqualTo("alice");
        assertThat(store.consume(code)).isEmpty();
    }

    @Test
    @DisplayName("codes are unguessable and distinct")
    void distinctAndLong() {
        String a = store.issue(login("a"));
        String b = store.issue(login("b"));
        assertThat(a).isNotEqualTo(b).hasSizeGreaterThanOrEqualTo(43); // 32 bytes, base64url
    }

    @Test
    @DisplayName("unknown, blank and null codes yield nothing")
    void unknownCodes() {
        assertThat(store.consume("nope")).isEmpty();
        assertThat(store.consume("")).isEmpty();
        assertThat(store.consume(null)).isEmpty();
    }
}
