package backend;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The real security chain: starting Google login carries the SPA's nonce inside OAuth state. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OAuthStartIntegrationTest {

    @Autowired MockMvc mvc;

    private String stateOf(String location) {
        return location.replaceAll(".*[?&]state=([^&]+).*", "$1");
    }

    @Test
    @DisplayName("client_state is appended to the OAuth state sent to Google")
    void nonceRidesInState() throws Exception {
        String nonce = "test-nonce-not-a-secret-01";
        String location = mvc.perform(get("/oauth2/authorize/google").param("client_state", nonce))
                .andExpect(status().is3xxRedirection())
                .andReturn().getResponse().getHeader("Location");

        assertThat(location).contains("accounts.google.com");
        assertThat(stateOf(location)).endsWith("." + nonce);
    }

    @Test
    @DisplayName("an invalid or missing client_state leaves the state untouched")
    void badNonceIgnored() throws Exception {
        String withBad = mvc.perform(get("/oauth2/authorize/google").param("client_state", "x;<script>"))
                .andReturn().getResponse().getHeader("Location");
        String without = mvc.perform(get("/oauth2/authorize/google"))
                .andReturn().getResponse().getHeader("Location");

        assertThat(stateOf(withBad)).doesNotContain(".").doesNotContain("script");
        assertThat(stateOf(without)).doesNotContain(".");
    }
}
