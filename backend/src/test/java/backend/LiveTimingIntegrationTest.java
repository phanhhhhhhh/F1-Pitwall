package backend;

import backend.service.LiveTimingService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Integration test for the Live Timing endpoint — hermetic (no OpenF1 network dependency).
 * Uses @TestConfiguration with a @Primary mock LiveTimingService so the controller
 * returns stubbed data instead of hitting the real OpenF1 API.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class LiveTimingIntegrationTest {

    @TestConfiguration
    static class MockConfig {
        @Bean @Primary
        LiveTimingService liveTimingService() {
            return mock(LiveTimingService.class);
        }
    }

    @LocalServerPort
    private int port;

    @Autowired
    private LiveTimingService liveTimingService;

    private final RestTemplate rest = new RestTemplate();
    private String jwtToken;

    private String url(String path) {
        return "http://localhost:" + port + path;
    }

    private HttpHeaders authHeaders() {
        if (jwtToken == null) {
            @SuppressWarnings("rawtypes")
            ResponseEntity<Map> resp = rest.postForEntity(
                    url("/api/auth/login"),
                    Map.of("username", "admin", "password", "pitwall2024"),
                    Map.class);
            jwtToken = (String) resp.getBody().get("accessToken");
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwtToken);
        return headers;
    }

    /** Returns a realistic stubbed live-timing response with 2 drivers. */
    private static List<Map<String, Object>> stubTiming() {
        Map<String, Object> d1 = new LinkedHashMap<>();
        d1.put("position", 1);
        d1.put("driverNumber", 1);
        d1.put("driverName", "Lando Norris");
        d1.put("firstName", "Lando");
        d1.put("lastName", "Norris");
        d1.put("nameAcronym", "NOR");
        d1.put("teamName", "McLaren");
        d1.put("teamColor", "#FF8000");
        d1.put("headshotUrl", "https://example.com/norris.png");
        d1.put("gapToLeader", null);
        d1.put("interval", null);
        d1.put("lastLapTime", 87.123);
        d1.put("sector1", 27.1);
        d1.put("sector2", 33.4);
        d1.put("sector3", 26.6);
        d1.put("tyreCompound", "SOFT");
        d1.put("tyreAge", 3);
        d1.put("pitStopCount", 0);
        d1.put("lapsCompleted", 12);

        Map<String, Object> d2 = new LinkedHashMap<>();
        d2.put("position", 2);
        d2.put("driverNumber", 44);
        d2.put("driverName", "Lewis Hamilton");
        d2.put("firstName", "Lewis");
        d2.put("lastName", "Hamilton");
        d2.put("nameAcronym", "HAM");
        d2.put("teamName", "Ferrari");
        d2.put("teamColor", "#E8002D");
        d2.put("headshotUrl", "https://example.com/hamilton.png");
        d2.put("gapToLeader", 1.234);
        d2.put("interval", 0.567);
        d2.put("lastLapTime", 87.890);
        d2.put("sector1", 27.5);
        d2.put("sector2", 33.8);
        d2.put("sector3", 26.5);
        d2.put("tyreCompound", "MEDIUM");
        d2.put("tyreAge", 8);
        d2.put("pitStopCount", 1);
        d2.put("lapsCompleted", 12);

        return List.of(d1, d2);
    }

    @Test
    @Order(1)
    void liveTimingEndpointReturns200() {
        when(liveTimingService.getLiveTiming(anyInt())).thenReturn(stubTiming());

        HttpEntity<Void> request = new HttpEntity<>(authHeaders());
        ResponseEntity<List> response = rest.exchange(
                url("/api/openf1/session/9590/live-timing"),
                HttpMethod.GET, request, List.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
    }

    @Test
    @Order(2)
    void liveTimingResponseIsArray() {
        when(liveTimingService.getLiveTiming(anyInt())).thenReturn(stubTiming());

        HttpEntity<Void> request = new HttpEntity<>(authHeaders());
        ResponseEntity<List> response = rest.exchange(
                url("/api/openf1/session/9590/live-timing"),
                HttpMethod.GET, request, List.class);

        assertThat(response.getBody()).isInstanceOf(List.class);
    }

    @Test
    @Order(3)
    void liveTimingEntriesHaveRequiredFieldsWhenDataPresent() {
        when(liveTimingService.getLiveTiming(anyInt())).thenReturn(stubTiming());

        HttpEntity<Void> request = new HttpEntity<>(authHeaders());
        ResponseEntity<List> response = rest.exchange(
                url("/api/openf1/session/9590/live-timing"),
                HttpMethod.GET, request, List.class);

        @SuppressWarnings("unchecked")
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

        assertThat(entry.get("driverName")).isEqualTo("Lando Norris");
        assertThat(entry.get("teamName")).isEqualTo("McLaren");
        assertThat(entry.get("position")).isEqualTo(1);
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
