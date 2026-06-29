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
 * Integration tests for race story endpoints — pit stops, weather, incidents.
 * Authenticates once lazily to avoid rate-limiting.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("local")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class RaceStoryIntegrationTest {

    @LocalServerPort
    private int port;

    private final RestTemplate rest = new RestTemplate();
    private String jwtToken;

    private String url(String path) {
        return "http://localhost:" + port + path;
    }

    private HttpHeaders authHeaders() {
        if (jwtToken == null) {
            Map<String, String> body = Map.of(
                    "username", "admin",
                    "password", "pitwall2024"
            );
            ResponseEntity<Map> resp = rest.postForEntity(
                    url("/api/auth/login"), body, Map.class);
            jwtToken = (String) resp.getBody().get("accessToken");
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwtToken);
        return headers;
    }

    @Test
    @Order(1)
    void pitStopsEndpointReturns200() {
        HttpEntity<Void> request = new HttpEntity<>(authHeaders());
        ResponseEntity<List> response = rest.exchange(
                url("/api/races/1/pit-stops"),
                HttpMethod.GET, request, List.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
    }

    @Test
    @Order(2)
    void weatherEndpointReturns200() {
        HttpEntity<Void> request = new HttpEntity<>(authHeaders());
        ResponseEntity<List> response = rest.exchange(
                url("/api/races/1/weather"),
                HttpMethod.GET, request, List.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
    }

    @Test
    @Order(3)
    void incidentsEndpointReturns200() {
        HttpEntity<Void> request = new HttpEntity<>(authHeaders());
        ResponseEntity<List> response = rest.exchange(
                url("/api/races/1/incidents"),
                HttpMethod.GET, request, List.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
    }

    @Test
    @Order(4)
    void raceStoryEndpointsRequireAuth() {
        try {
            rest.getForEntity(url("/api/races/1/pit-stops"), String.class);
            fail("Expected 401");
        } catch (HttpClientErrorException e) {
            assertThat(e.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        }
    }
}
