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
        assertThat(ClientStateAuthorizationRequestResolver.clientStateFrom("AbC-_123.0f8fad5b-d9cb-469f-a165-70867728950e"))
                .isEqualTo("0f8fad5b-d9cb-469f-a165-70867728950e");
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
