package backend;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Integration test for Live Timing — hermetic (mocks OpenF1 at the RestTemplate layer).
 * The REAL LiveTimingService merge logic runs; only HTTP calls are intercepted
 * by a Mockito mock RestTemplate returning static JSON fixtures.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class LiveTimingIntegrationTest {

    @TestConfiguration
    static class RestTemplateOverride {
        @Bean @Primary
        RestTemplate testRestTemplate() {
            return mock(RestTemplate.class);
        }
    }

    @LocalServerPort
    private int port;

    @Autowired
    private RestTemplate restTemplate;

    private final RestTemplate testClient = new RestTemplate();
    private String jwtToken;

    private String url(String path) {
        return "http://localhost:" + port + path;
    }

    private HttpHeaders authHeaders() {
        if (jwtToken == null) {
            @SuppressWarnings("rawtypes")
            ResponseEntity<Map> resp = testClient.postForEntity(
                    url("/api/auth/login"),
                    Map.of("username", "admin", "password", "pitwall2024"),
                    Map.class);
            jwtToken = (String) resp.getBody().get("accessToken");
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwtToken);
        return headers;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> fixture(String name) {
        try {
            String json = new ClassPathResource("openf1-fixtures/" + name + ".json")
                    .getContentAsString(StandardCharsets.UTF_8);
            // Use Jackson via RestTemplate's own converters, or just parse inline
            return List.of((Map<String, Object>[]) new com.fasterxml.jackson.databind.ObjectMapper()
                    .readValue(json, Map[].class));
        } catch (Exception e) {
            throw new RuntimeException("Fixture not found: " + name, e);
        }
    }

    @BeforeAll
    @SuppressWarnings("unchecked")
    void stubRestTemplate() {
        int sk = 9590;
        String base = "https://api.openf1.org/v1";
        List<Map<String, Object>> empty = new ArrayList<>();

        // Catch-all first: any OpenF1 URL defaults to empty list
        // (later-specific stubs override this for the LiveTiming URLs)
        when(restTemplate.getForObject(startsWith(base), any()))
                .thenReturn((List) empty);

        // Specific overrides for LiveTimingService's 5 endpoints
        when(restTemplate.getForObject(eq(base + "/position?session_key=" + sk), eq(List.class)))
                .thenReturn((List) fixture("positions"));
        when(restTemplate.getForObject(eq(base + "/intervals?session_key=" + sk), eq(List.class)))
                .thenReturn((List) fixture("intervals"));
        when(restTemplate.getForObject(eq(base + "/laps?session_key=" + sk + "&is_pit_out_lap=false"), eq(List.class)))
                .thenReturn((List) fixture("laps"));
        when(restTemplate.getForObject(eq(base + "/stints?session_key=" + sk), eq(List.class)))
                .thenReturn((List) fixture("stints"));
        when(restTemplate.getForObject(eq(base + "/drivers?session_key=" + sk), eq(List.class)))
                .thenReturn((List) fixture("drivers"));
    }

    @Test
    @Order(1)
    void liveTimingEndpointReturns200() {
        HttpEntity<Void> request = new HttpEntity<>(authHeaders());
        ResponseEntity<List> response = testClient.exchange(
                url("/api/openf1/session/9590/live-timing"),
                HttpMethod.GET, request, List.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
    }

    @Test
    @Order(2)
    void liveTimingResponseIsArray() {
        HttpEntity<Void> request = new HttpEntity<>(authHeaders());
        ResponseEntity<List> response = testClient.exchange(
                url("/api/openf1/session/9590/live-timing"),
                HttpMethod.GET, request, List.class);

        assertThat(response.getBody()).isInstanceOf(List.class);
    }

    @Test
    @Order(3)
    @SuppressWarnings("unchecked")
    void liveTimingEntriesHaveRequiredFieldsWhenDataPresent() {
        HttpEntity<Void> request = new HttpEntity<>(authHeaders());
        ResponseEntity<List> response = testClient.exchange(
                url("/api/openf1/session/9590/live-timing"),
                HttpMethod.GET, request, List.class);

        List<Map<String, Object>> body = response.getBody();
        assertThat(body).isNotNull().isNotEmpty();

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

        // Verify merge logic: values come from our fixtures
        assertThat(entry.get("driverName")).isEqualTo("Lando Norris");
        assertThat(entry.get("teamName")).isEqualTo("McLaren");
        assertThat(entry.get("position")).isEqualTo(1);
        assertThat(entry.get("tyreCompound")).isEqualTo("SOFT");
        assertThat(entry.get("pitStopCount")).isEqualTo(0);
        assertThat(entry.get("lapsCompleted")).isEqualTo(12);
        assertThat(entry.get("gapToLeader")).isNull();

        Map<String, Object> entry2 = body.get(1);
        assertThat(entry2.get("driverName")).isEqualTo("Lewis Hamilton");
        assertThat(entry2.get("position")).isEqualTo(2);
        assertThat(entry2.get("gapToLeader")).isEqualTo(1.234);
        assertThat(entry2.get("interval")).isEqualTo(0.567);
        assertThat(entry2.get("pitStopCount")).isEqualTo(1);
    }

    @Test
    @Order(4)
    void liveTimingEndpointRequiresAuth() {
        try {
            testClient.getForEntity(
                    url("/api/openf1/session/9590/live-timing"), String.class);
            fail("Expected 401");
        } catch (HttpClientErrorException e) {
            assertThat(e.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        }
    }
}
