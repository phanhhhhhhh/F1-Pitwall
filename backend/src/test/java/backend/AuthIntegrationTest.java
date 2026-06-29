package backend;

import org.junit.jupiter.api.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;

/**
 * Integration tests for auth endpoints.
 * Verifies correct HTTP status codes for login, register, and protected endpoints.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("local")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AuthIntegrationTest {

    @LocalServerPort
    private int port;

    private final RestTemplate rest = new RestTemplate();

    private String url(String path) {
        return "http://localhost:" + port + path;
    }

    @Test
    @Order(1)
    void loginWithValidCredentialsReturns200AndJwtTokens() {
        Map<String, String> body = Map.of(
                "username", "admin",
                "password", "pitwall2024"
        );

        ResponseEntity<Map> response = rest.postForEntity(
                url("/api/auth/login"), body, Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("accessToken")).isNotNull();
        assertThat(response.getBody().get("refreshToken")).isNotNull();
        assertThat(response.getBody().get("username")).isEqualTo("admin");
        assertThat(response.getBody().get("role")).isEqualTo("ADMIN");
    }

    @Test
    @Order(2)
    void loginWithInvalidCredentialsReturns401() {
        Map<String, String> body = Map.of(
                "username", "admin",
                "password", "wrongpassword"
        );

        try {
            rest.postForEntity(url("/api/auth/login"), body, Map.class);
            fail("Expected 401 Unauthorized");
        } catch (HttpClientErrorException e) {
            assertThat(e.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        }
    }

    @Test
    @Order(3)
    void registerWithValidDataReturns201() {
        String uniqueUser = "testuser_" + System.currentTimeMillis();
        Map<String, String> body = Map.of(
                "username", uniqueUser,
                "password", "testpass123",
                "email", uniqueUser + "@test.com"
        );

        ResponseEntity<Map> response = rest.postForEntity(
                url("/api/auth/register"), body, Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().get("accessToken")).isNotNull();
        assertThat(response.getBody().get("role")).isEqualTo("VIEWER");
    }

    @Test
    @Order(4)
    void protectedEndpointWithoutTokenReturns401() {
        try {
            rest.getForEntity(url("/api/drivers"), String.class);
            fail("Expected 401 Unauthorized");
        } catch (HttpClientErrorException e) {
            assertThat(e.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        }
    }

    @Test
    @Order(5)
    void healthEndpointIsPublic() {
        ResponseEntity<Map> response = rest.getForEntity(
                url("/api/health"), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get("status")).isEqualTo("UP");
    }
}
