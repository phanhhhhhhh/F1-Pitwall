package backend.websocket;

import backend.security.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Date;
import java.util.Map;

@Component
public class AuthHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtService jwtService;
    private final backend.security.TokenBlacklistService tokenBlacklistService;

    public AuthHandshakeInterceptor(JwtService jwtService,
                                     backend.security.TokenBlacklistService tokenBlacklistService) {
        this.jwtService = jwtService;
        this.tokenBlacklistService = tokenBlacklistService;
    }

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes
    ) {
        String token = extractToken(request);

        if (token != null && !token.isBlank()) {
            try {
                // Check blacklist first (logged-out tokens)
                if (tokenBlacklistService.isBlacklisted(token)) {
                    response.setStatusCode(HttpStatus.UNAUTHORIZED);
                    return false;
                }
                String username = jwtService.extractUsername(token);
                if (username != null) {
                    Date expiration = jwtService.extractExpiration(token);
                    if (expiration.after(new Date())) {
                        return true;
                    }
                }
            } catch (Exception e) {
                // Invalid token — reject
            }
        }

        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        return false;
    }

    private String extractToken(ServerHttpRequest request) {
        // Try Authorization header first
        if (request instanceof ServletServerHttpRequest servletRequest) {
            String authHeader = servletRequest.getServletRequest().getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                return authHeader.substring(7);
            }
        }

        // Fallback to query parameter "token" (for SockJS)
        String query = request.getURI().getQuery();
        if (query != null) {
            for (String param : query.split("&")) {
                String[] pair = param.split("=", 2);
                if (pair.length == 2 && "token".equals(pair[0])) {
                    return pair[1];
                }
            }
        }

        return null;
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Exception exception
    ) {
        // No-op
    }
}
