package backend;

import backend.security.JwtService;
import backend.service.CustomUserDetailsService;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.client.DefaultResponseErrorHandler;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pins the role matrix on the security-sensitive endpoints: who gets 401 (no/invalid
 * credentials), who gets 403 (authenticated but wrong role) and who gets through.
 * Tokens for the seeded admin/engineer are minted directly rather than via /api/auth/login,
 * which is rate limited per IP and shares a Spring context with other integration tests.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class RoleAuthorizationIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private CustomUserDetailsService userDetailsService;

    // The JDK client (unlike HttpURLConnection) can read 401/403 responses to a POST body.
    private static final RestTemplate rest = new RestTemplate(new JdkClientHttpRequestFactory());

    private static String viewerToken;

    @BeforeAll
    static void configureClient() {
        rest.setErrorHandler(new DefaultResponseErrorHandler() {
            @Override
            public boolean hasError(org.springframework.http.client.ClientHttpResponse response) {
                return false;
            }
        });
    }

    private String token(String username, String role) {
        return jwtService.generateAccessToken(userDetailsService.loadUserByUsername(username), role);
    }

    private String viewer() {
        if (viewerToken == null) {
            String name = "viewer_" + System.nanoTime();
            var res = rest.postForEntity(url("/api/auth/register"),
                    Map.of("username", name, "password", "viewerpass1", "email", name + "@test.com"), Map.class);
            viewerToken = (String) res.getBody().get("accessToken");
        }
        return viewerToken;
    }

    private String url(String path) {
        return "http://localhost:" + port + path;
    }

    private int status(HttpMethod method, String path, String token, Object body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) headers.setBearerAuth(token);
        return rest.exchange(url(path), method, new HttpEntity<>(body, headers), String.class)
                .getStatusCode().value();
    }

    @Test
    @DisplayName("requests without a token are rejected with 401")
    void anonymousIs401() {
        assertThat(status(HttpMethod.GET, "/api/drivers", null, null)).isEqualTo(401);
        assertThat(status(HttpMethod.GET, "/api/admin/stats", null, null)).isEqualTo(401);
        assertThat(status(HttpMethod.POST, "/api/sync/all", null, null)).isEqualTo(401);
    }

    @Test
    @DisplayName("a garbage bearer token is treated as anonymous")
    void garbageTokenIs401() {
        assertThat(status(HttpMethod.GET, "/api/drivers", "not.a.jwt", null)).isEqualTo(401);
    }

    @Test
    @DisplayName("a refresh token cannot be used as an access token")
    void refreshTokenIsNotAnAccessToken() {
        String refresh = jwtService.generateRefreshToken(userDetailsService.loadUserByUsername("admin"));
        assertThat(status(HttpMethod.GET, "/api/admin/stats", refresh, null)).isEqualTo(401);
    }

    @Test
    @DisplayName("admin-only endpoints: admin passes, engineer and viewer get 403")
    void adminOnly() {
        assertThat(status(HttpMethod.GET, "/api/admin/stats", token("admin", "ADMIN"), null)).isEqualTo(200);
        assertThat(status(HttpMethod.GET, "/api/admin/stats", token("engineer", "ENGINEER"), null)).isEqualTo(403);
        assertThat(status(HttpMethod.GET, "/api/admin/stats", viewer(), null)).isEqualTo(403);
        assertThat(status(HttpMethod.DELETE, "/api/admin/users/1", viewer(), null)).isEqualTo(403);
        assertThat(status(HttpMethod.POST, "/api/admin/migration/fix-duplicates", token("engineer", "ENGINEER"), null)).isEqualTo(403);
    }

    @Test
    @DisplayName("driver writes are admin-only; reads are open to any signed-in role")
    void driverAccess() {
        assertThat(status(HttpMethod.GET, "/api/drivers", viewer(), null)).isEqualTo(200);
        assertThat(status(HttpMethod.POST, "/api/drivers", viewer(), Map.of())).isEqualTo(403);
        assertThat(status(HttpMethod.POST, "/api/drivers", token("engineer", "ENGINEER"), Map.of())).isEqualTo(403);
        // Admin is authorised, so the empty body fails validation instead of authorisation.
        assertThat(status(HttpMethod.POST, "/api/drivers", token("admin", "ADMIN"), Map.of()))
                .isNotIn(401, 403);
    }

    @Test
    @DisplayName("sync triggers are closed to viewers")
    void syncClosedToViewers() {
        assertThat(status(HttpMethod.POST, "/api/sync/all", viewer(), null)).isEqualTo(403);
    }

    @Test
    @DisplayName("swagger and api-docs are admin-only")
    void swaggerAdminOnly() {
        assertThat(status(HttpMethod.GET, "/v3/api-docs", viewer(), null)).isEqualTo(403);
        assertThat(status(HttpMethod.GET, "/v3/api-docs", token("admin", "ADMIN"), null)).isEqualTo(200);
    }
}
