package backend;

import org.junit.jupiter.api.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;

/**
 * Integration tests for the race news endpoints.
 * Authenticates once lazily to avoid rate-limiting (same pattern as
 * RaceStoryIntegrationTest).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class RaceNewsIntegrationTest {

    @LocalServerPort
    private int port;

    private final RestTemplate rest = new RestTemplate();
    private String adminToken;
    private String engineerToken;
    private Long createdNewsId;

    private String url(String path) {
        return "http://localhost:" + port + path;
    }

    private String login(String username, String password) {
        Map<String, String> body = Map.of("username", username, "password", password);
        ResponseEntity<Map> resp = rest.postForEntity(url("/api/auth/login"), body, Map.class);
        return (String) resp.getBody().get("accessToken");
    }

    private HttpHeaders authHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return headers;
    }

    @Test
    @Order(1)
    void listRequiresAuth() {
        try {
            rest.getForEntity(url("/api/news?season=2026"), String.class);
            fail("Expected 401");
        } catch (HttpClientErrorException e) {
            assertThat(e.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        }
    }

    @Test
    @Order(2)
    void listReturns200() {
        if (adminToken == null) adminToken = login("admin", "pitwall2024");
        HttpEntity<Void> request = new HttpEntity<>(authHeaders(adminToken));
        ResponseEntity<List> response = rest.exchange(
                url("/api/news?season=2026"), HttpMethod.GET, request, List.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
    }

    @Test
    @Order(3)
    void nonAdminCannotCreate() {
        if (engineerToken == null) engineerToken = login("engineer", "telemetry2024");
        Map<String, Object> body = Map.of(
                "title", "x", "content", "x", "tag", "DRIVER_NEWS", "raceId", 1);
        try {
            rest.exchange(url("/api/news"), HttpMethod.POST,
                    new HttpEntity<>(body, authHeaders(engineerToken)), Map.class);
            fail("Expected 403");
        } catch (HttpClientErrorException e) {
            assertThat(e.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        }
    }

    @Test
    @Order(4)
    void adminCreateGetDeleteFlow() {
        if (adminToken == null) adminToken = login("admin", "pitwall2024");
        Map<String, Object> body = Map.of(
                "title", "Integration test news", "content", "Test content",
                "tag", "DRIVER_NEWS", "raceId", 1);
        ResponseEntity<Map> created = rest.exchange(url("/api/news"), HttpMethod.POST,
                new HttpEntity<>(body, authHeaders(adminToken)), Map.class);

        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        createdNewsId = ((Number) created.getBody().get("id")).longValue();

        ResponseEntity<Map> fetched = rest.exchange(url("/api/news/" + createdNewsId),
                HttpMethod.GET, new HttpEntity<>(authHeaders(adminToken)), Map.class);
        assertThat(fetched.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(fetched.getBody().get("title")).isEqualTo("Integration test news");
        assertThat(fetched.getBody().get("raceName")).isNotNull();

        ResponseEntity<Map> deleted = rest.exchange(url("/api/news/" + createdNewsId),
                HttpMethod.DELETE, new HttpEntity<>(authHeaders(adminToken)), Map.class);
        assertThat(deleted.getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
