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
 * Integration test for the Live Timing endpoint.
 * Verifies response structure — each driver entry must contain:
 * position, driverNumber, driverName, teamName, teamColor,
 * gapToLeader, interval, lastLapTime, sector1/2/3,
 * tyreCompound, tyreAge, pitStopCount, lapsCompleted.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class LiveTimingIntegrationTest {

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
    void liveTimingEndpointReturns200() {
        int sessionKey = 9590;
        HttpEntity<Void> request = new HttpEntity<>(authHeaders());

        ResponseEntity<List> response = rest.exchange(
                url("/api/openf1/session/" + sessionKey + "/live-timing"),
                HttpMethod.GET, request, List.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
    }

    @Test
    @Order(2)
    void liveTimingResponseIsArray() {
        int sessionKey = 9590;
        HttpEntity<Void> request = new HttpEntity<>(authHeaders());

        ResponseEntity<List> response = rest.exchange(
                url("/api/openf1/session/" + sessionKey + "/live-timing"),
                HttpMethod.GET, request, List.class);

        assertThat(response.getBody()).isInstanceOf(List.class);
    }

    @Test
    @Order(3)
    void liveTimingEntriesHaveRequiredFieldsWhenDataPresent() {
        int sessionKey = 9590;
        HttpEntity<Void> request = new HttpEntity<>(authHeaders());

        ResponseEntity<List> response = rest.exchange(
                url("/api/openf1/session/" + sessionKey + "/live-timing"),
                HttpMethod.GET, request, List.class);

        List<Map<String, Object>> body = response.getBody();
        assertThat(body).isNotNull();

        if (!body.isEmpty()) {
            Map<String, Object> entry = body.get(0);
            assertThat(entry).containsKeys(
                    "position", "driverNumber", "driverName",
                    "teamName", "teamColor"
            );
            assertThat(entry).containsKeys(
                    "gapToLeader", "interval",
                    "lastLapTime", "sector1", "sector2", "sector3"
            );
            assertThat(entry).containsKeys(
                    "tyreCompound", "tyreAge",
                    "pitStopCount", "lapsCompleted"
            );
        }
    }

    @Test
    @Order(4)
    void liveTimingEndpointRequiresAuth() {
        try {
            rest.getForEntity(
                    url("/api/openf1/session/9590/live-timing"), String.class);
            fail("Expected 401");
        } catch (HttpClientErrorException e) {
            assertThat(e.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        }
    }
}
