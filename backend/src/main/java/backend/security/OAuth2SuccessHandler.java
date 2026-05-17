package backend.security;

import backend.model.User;
import backend.repository.UserRepository;
import backend.service.CustomUserDetailsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Slf4j
@Component
@RequiredArgsConstructor
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;

    @Value("${allowed.origins:http://localhost:3000}")
    private String allowedOrigins;

    @Value("${app.jwt.access-token-expiration:900000}")
    private long accessTokenExpiration;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException {

        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();

        String email = oAuth2User.getAttribute("email");
        String name  = oAuth2User.getAttribute("name");

        if (email == null) {
            log.warn("[OAuth2] Google account has no email");
            response.sendRedirect(getFrontendUrl() + "/login?error=no_email");
            return;
        }

        User user = userRepository.findByEmail(email).orElseGet(() -> {
            String baseUsername = email.split("@")[0].replaceAll("[^a-zA-Z0-9_]", "");
            String username = baseUsername;
            int suffix = 1;
            while (userRepository.existsByUsername(username)) {
                username = baseUsername + suffix++;
            }

            User newUser = User.builder()
                    .username(username)
                    .email(email)
                    .password("")
                    .role(User.Role.VIEWER)
                    .build();

            log.info("[OAuth2] Created new user from Google: {} ({})", username, email);
            return userRepository.save(newUser);
        });

        UserDetails userDetails = userDetailsService.loadUserByUsername(user.getUsername());
        String accessToken  = jwtService.generateAccessToken(userDetails, user.getRole().name());
        String refreshToken = jwtService.generateRefreshToken(userDetails);

        log.info("[OAuth2] Google login success: {}", user.getUsername());

        String frontendUrl = getFrontendUrl();
        String redirectUrl = String.format(
                "%s/oauth2/callback?accessToken=%s&refreshToken=%s&username=%s&role=%s&expiresIn=%d",
                frontendUrl,
                URLEncoder.encode(accessToken,  StandardCharsets.UTF_8),
                URLEncoder.encode(refreshToken, StandardCharsets.UTF_8),
                URLEncoder.encode(user.getUsername(), StandardCharsets.UTF_8),
                URLEncoder.encode(user.getRole().name(), StandardCharsets.UTF_8),
                accessTokenExpiration / 1000
        );

        getRedirectStrategy().sendRedirect(request, response, redirectUrl);
    }

    private String getFrontendUrl() {
        String[] origins = allowedOrigins.split(",");
        for (String origin : origins) {
            String o = origin.trim();
            if (o.startsWith("https://")) return o;
        }
        return "http://localhost:3000";
    }
}