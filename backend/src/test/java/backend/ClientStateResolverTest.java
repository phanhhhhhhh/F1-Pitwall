package backend;

import backend.security.ClientStateAuthorizationRequestResolver;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("ClientStateAuthorizationRequestResolver.clientStateFrom")
class ClientStateResolverTest {

    @Test
    @DisplayName("extracts the nonce after the last dot")
    void extracts() {
        assertThat(ClientStateAuthorizationRequestResolver.clientStateFrom("AbC-_123.test-nonce-not-a-secret-01"))
                .isEqualTo("test-nonce-not-a-secret-01");
    }

    @Test
    @DisplayName("returns null when there is no valid nonce")
    void none() {
        assertThat(ClientStateAuthorizationRequestResolver.clientStateFrom(null)).isNull();
        assertThat(ClientStateAuthorizationRequestResolver.clientStateFrom("plainstate")).isNull();
        assertThat(ClientStateAuthorizationRequestResolver.clientStateFrom("abc.short")).isNull();
        assertThat(ClientStateAuthorizationRequestResolver.clientStateFrom("abc.<script>alert(1)</script>")).isNull();
    }
}
