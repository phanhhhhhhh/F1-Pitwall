package backend;

import org.junit.jupiter.api.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Permanent regression guard: every endpoint that returns entity-derived JSON
 * with lazy-loaded @ManyToOne / @OneToMany relationships (driver, team, race,
 * circuit) must return HTTP 200 under spring.jpa.open-in-view=false.
 *
 * <p>If any test here fails with a 500 containing "LazyInitializationException"
 * or "could not initialize proxy", a developer removed @Transactional or
 * dropped a JOIN FETCH that this safety net was designed to catch.</p>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({ "test", "ci" })
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("OSIV=false Regression Safety Net")
class OpenInViewRegressionTest {

    @LocalServerPort
    private int port;

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

    private void assert200(String path) {
        HttpEntity<Void> request = new HttpEntity<>(authHeaders());
        ResponseEntity<String> response = rest.exchange(
                url(path), HttpMethod.GET, request, String.class);
        assertThat(response.getStatusCode())
                .as("GET %s → expected 200 OK (OSIV=false)", path)
                .isEqualTo(HttpStatus.OK);
    }

    /** Like assert200 but also proves lazy chain was walked by checking
     *  the response body contains the given substring. */
    private void assert200AndContains(String path, String expectedSubstring) {
        HttpEntity<Void> request = new HttpEntity<>(authHeaders());
        ResponseEntity<String> response = rest.exchange(
                url(path), HttpMethod.GET, request, String.class);
        assertThat(response.getStatusCode())
                .as("GET %s → expected 200 OK (OSIV=false)", path)
                .isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .as("GET %s → response must contain '%s' to prove lazy-loading was exercised",
                        path, expectedSubstring)
                .isNotNull()
                .contains(expectedSubstring);
    }

    // ── Race results / standings (driver + team lazy chain) ──────────────

    @Test @Order(1)
    @DisplayName("GET /api/race-results/standings/drivers/2026")
    void driverStandings() { assert200AndContains("/api/race-results/standings/drivers/2026", "Lando Norris"); }

    @Test @Order(2)
    @DisplayName("GET /api/race-results/standings/constructors/2026")
    void constructorStandings() { assert200AndContains("/api/race-results/standings/constructors/2026", "McLaren"); }

    @Test @Order(3)
    @DisplayName("GET /api/race-results/winners/2026")
    void seasonWinners() { assert200AndContains("/api/race-results/winners/2026", "Lando Norris"); }

    @Test @Order(4)
    @DisplayName("GET /api/race-results/race/1")
    void resultsByRace() { assert200AndContains("/api/race-results/race/1", "Lando Norris"); }

    // ── Sprint standings (driver + team lazy chain) ──────────────────────

    @Test @Order(5)
    @DisplayName("GET /api/standings/sprint/drivers/2026")
    void sprintDriverStandings() { assert200AndContains("/api/standings/sprint/drivers/2026", "Lando Norris"); }

    @Test @Order(6)
    @DisplayName("GET /api/standings/sprint/constructors/2026")
    void sprintConstructorStandings() { assert200AndContains("/api/standings/sprint/constructors/2026", "McLaren"); }

    // ── Qualifying (driver + team lazy chain) ────────────────────────────

    @Test @Order(7)
    @DisplayName("GET /api/qualifying/race/1")
    void qualifyingResults() { assert200AndContains("/api/qualifying/race/1", "Lando Norris"); }

    // ── Races (circuit lazy) ─────────────────────────────────────────────

    @Test @Order(8)
    @DisplayName("GET /api/races")
    void raceList() { assert200("/api/races"); }

    @Test @Order(9)
    @DisplayName("GET /api/races/1")
    void raceById() { assert200("/api/races/1"); }

    // ── Drivers (team lazy) ──────────────────────────────────────────────

    @Test @Order(10)
    @DisplayName("GET /api/drivers")
    void driverList() { assert200("/api/drivers"); }

    @Test @Order(11)
    @DisplayName("GET /api/drivers/paged")
    void driversPaged() { assert200("/api/drivers/paged"); }

    @Test @Order(12)
    @DisplayName("GET /api/drivers/1")
    void driverById() { assert200("/api/drivers/1"); }

    @Test @Order(13)
    @DisplayName("GET /api/drivers/team/1")
    void driversByTeam() { assert200("/api/drivers/team/1"); }

    @Test @Order(14)
    @DisplayName("GET /api/drivers/leaderboard")
    void driverLeaderboard() { assert200("/api/drivers/leaderboard"); }

    // ── Pit stops (raceResult → driver → team lazy chain) ────────────────

    @Test @Order(15)
    @DisplayName("GET /api/races/1/pit-stops")
    void pitStops() { assert200AndContains("/api/races/1/pit-stops", "Lando Norris"); }

    // ── Circuits (races collection is @JsonIgnore — safe, but test anyway)

    @Test @Order(16)
    @DisplayName("GET /api/circuits")
    void circuitList() { assert200("/api/circuits"); }
}
