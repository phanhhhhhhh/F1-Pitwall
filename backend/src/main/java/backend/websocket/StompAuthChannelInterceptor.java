package backend.websocket;

import backend.security.JwtService;
import backend.security.TokenBlacklistService;
import backend.service.CustomUserDetailsService;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Authenticates STOMP sessions at CONNECT using the access token in the frame's
 * {@code Authorization} header — a browser cannot set headers on the SockJS/WebSocket
 * upgrade, and putting the token in the URL would leak it into proxy access logs.
 *
 * Also locks the broker down: clients may only subscribe to the known read-only topics
 * and may never SEND. Without the SEND rule, any client could publish to
 * {@code /topic/telemetry} and the simple broker would relay it to every subscriber.
 */
@Component
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    static final Set<String> SUBSCRIBABLE = Set.of("/topic/telemetry", "/topic/notifications");

    private final JwtService jwtService;
    private final TokenBlacklistService tokenBlacklistService;
    private final CustomUserDetailsService userDetailsService;

    public StompAuthChannelInterceptor(JwtService jwtService,
                                       TokenBlacklistService tokenBlacklistService,
                                       CustomUserDetailsService userDetailsService) {
        this.jwtService = jwtService;
        this.tokenBlacklistService = tokenBlacklistService;
        this.userDetailsService = userDetailsService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        StompCommand command = accessor == null ? null : accessor.getCommand();
        if (command == null) return message;

        switch (command) {
            case CONNECT, STOMP -> accessor.setUser(authenticate(accessor.getFirstNativeHeader("Authorization")));
            case SUBSCRIBE -> {
                if (accessor.getUser() == null) throw new MessagingException("Not authenticated");
                if (!SUBSCRIBABLE.contains(accessor.getDestination())) {
                    throw new MessagingException("Subscription not allowed");
                }
            }
            case SEND -> throw new MessagingException("Clients may not send messages");
            default -> { }
        }
        return message;
    }

    private UsernamePasswordAuthenticationToken authenticate(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new MessagingException("Missing bearer token");
        }
        String token = authHeader.substring(7);
        try {
            if (tokenBlacklistService.isBlacklisted(token)) {
                throw new MessagingException("Token revoked");
            }
            UserDetails user = userDetailsService.loadUserByUsername(jwtService.extractUsername(token));
            if (!jwtService.isTokenValid(token, user)) {
                throw new MessagingException("Invalid token");
            }
            return new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
        } catch (MessagingException e) {
            throw e;
        } catch (Exception e) {
            // Expired, malformed, wrong signature, unknown user — all the same to the client.
            throw new MessagingException("Invalid token");
        }
    }
}
