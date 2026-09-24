package backend;

import backend.security.JwtService;
import backend.service.CustomUserDetailsService;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.messaging.converter.StringMessageConverter;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import java.lang.reflect.Type;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Drives the real /ws endpoint (SockJS's raw WebSocket transport) with a STOMP client to
 * prove the CONNECT-time JWT check and the subscribe/send lockdown work end to end,
 * including Spring Security's handling of /ws/**.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class StompSecurityIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private CustomUserDetailsService userDetailsService;

    /** Records the first ERROR frame the server sends, if any. */
    private static class Recorder extends StompSessionHandlerAdapter {
        final CompletableFuture<StompSession> connected = new CompletableFuture<>();
        final CompletableFuture<StompHeaders> error = new CompletableFuture<>();

        @Override
        public void afterConnected(StompSession session, StompHeaders headers) {
            connected.complete(session);
        }

        @Override
        public void handleFrame(StompHeaders headers, Object payload) {
            error.complete(headers);
        }

        @Override
        public void handleTransportError(StompSession session, Throwable exception) {
            error.completeExceptionally(exception);
        }
    }

    // Minted directly: /api/auth/login is rate limited per IP, and this context is shared
    // with other integration tests, so logging in here could trip a 429 elsewhere.
    private String accessToken() {
        var admin = userDetailsService.loadUserByUsername("admin");
        return jwtService.generateAccessToken(admin, "ADMIN");
    }

    private Recorder connect(String authHeader) {
        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        client.setMessageConverter(new StringMessageConverter());
        StompHeaders connectHeaders = new StompHeaders();
        if (authHeader != null) connectHeaders.add("Authorization", authHeader);
        Recorder recorder = new Recorder();
        client.connectAsync("ws://localhost:" + port + "/ws/websocket",
                new org.springframework.web.socket.WebSocketHttpHeaders(), connectHeaders, recorder);
        return recorder;
    }

    private static final StompFrameHandler IGNORE = new StompFrameHandler() {
        @Override public Type getPayloadType(StompHeaders headers) { return String.class; }
        @Override public void handleFrame(StompHeaders headers, Object payload) { }
    };

    @Test
    @DisplayName("CONNECT without a token is refused")
    void connectWithoutTokenRefused() throws Exception {
        Recorder r = connect(null);
        assertThat(r.error.get(5, TimeUnit.SECONDS)).isNotNull();
        assertThat(r.connected).isNotDone();
    }

    @Test
    @DisplayName("CONNECT with a garbage token is refused")
    void connectWithBadTokenRefused() throws Exception {
        Recorder r = connect("Bearer not.a.jwt");
        assertThat(r.error.get(5, TimeUnit.SECONDS)).isNotNull();
        assertThat(r.connected).isNotDone();
    }

    @Test
    @DisplayName("a valid access token connects and may subscribe to /topic/telemetry")
    void validTokenConnectsAndSubscribes() throws Exception {
        Recorder r = connect("Bearer " + accessToken());
        StompSession session = r.connected.get(5, TimeUnit.SECONDS);
        session.subscribe("/topic/telemetry", IGNORE);
        // An accepted subscription produces no ERROR frame and leaves the session open.
        assertThatThrownBy(() -> r.error.get(1, TimeUnit.SECONDS)).isInstanceOf(TimeoutException.class);
        assertThat(session.isConnected()).isTrue();
    }

    @Test
    @DisplayName("subscribing to an unlisted destination is rejected")
    void subscribeToUnknownTopicRejected() throws Exception {
        Recorder r = connect("Bearer " + accessToken());
        StompSession session = r.connected.get(5, TimeUnit.SECONDS);
        session.subscribe("/topic/anything-else", IGNORE);
        assertThat(r.error.get(5, TimeUnit.SECONDS)).isNotNull();
    }

    @Test
    @DisplayName("clients cannot publish into a broker topic")
    void sendRejected() throws Exception {
        Recorder r = connect("Bearer " + accessToken());
        StompSession session = r.connected.get(5, TimeUnit.SECONDS);
        session.send("/topic/telemetry", "spoofed");
        assertThat(r.error.get(5, TimeUnit.SECONDS)).isNotNull();
    }
}
