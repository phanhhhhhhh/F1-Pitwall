package backend.security;

import backend.model.OtpToken;
import backend.model.User;
import backend.repository.UserRepository;
import backend.service.OtpService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
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
    private final OtpService otpService;
    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    @Value("${allowed.origins:http://localhost:3000}")
    private String allowedOrigins;

    @Value("${resend.api-key:}")
    private String resendApiKey;

    @Value("${app.jwt.access-token-expiration:900000}")
    private long accessTokenExpiration;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException {

        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();
        String email = oAuth2User.getAttribute("email");

        if (email == null) {
            log.warn("[OAuth2] Google account has no email");
            response.sendRedirect(getFrontendUrl() + "/login?error=no_email");
            return;
        }

        User user = userRepository.findByEmail(email).orElseGet(() -> {
            String baseUsername = email.split("@")[0].replaceAll("[^a-zA-Z0-9_]", "");
            String username = baseUsername;
            int suffix = 1;
            while (userRepository.existsByUsername(username)) username = baseUsername + suffix++;
            User newUser = User.builder()
                    .username(username).email(email).password("").role(User.Role.VIEWER)
                    .build();
            log.info("[OAuth2] Created new user from Google: {} ({})", username, email);
            return userRepository.save(newUser);
        });

        // Email service configured → 2FA flow
        if (resendApiKey != null && !resendApiKey.isBlank()) {
            try {
                otpService.sendOtp(email, OtpToken.OtpType.OAUTH_2FA);
                log.info("[OAuth2] 2FA OTP sent for {}", email);
                String redirectUrl = getFrontendUrl() + "/oauth2/pending?email="
                        + URLEncoder.encode(email, StandardCharsets.UTF_8);
                getRedirectStrategy().sendRedirect(request, response, redirectUrl);
                return;
            } catch (Exception e) {
                log.warn("[OAuth2] OTP send failed for {}, falling back to direct login: {}", email, e.getMessage());
            }
        } else {
            log.info("[OAuth2] Email service not configured, skipping 2FA for {}", email);
        }

        // Fallback: issue JWT directly (no 2FA)
        UserDetails userDetails = userDetailsService.loadUserByUsername(user.getUsername());
        String accessToken  = jwtService.generateAccessToken(userDetails, user.getRole().name());
        String refreshToken = jwtService.generateRefreshToken(userDetails);

        String redirectUrl = getFrontendUrl() + "/oauth2/callback"
                + "?accessToken="  + URLEncoder.encode(accessToken,  StandardCharsets.UTF_8)
                + "&refreshToken=" + URLEncoder.encode(refreshToken, StandardCharsets.UTF_8)
                + "&username="     + URLEncoder.encode(user.getUsername(), StandardCharsets.UTF_8)
                + "&role="         + URLEncoder.encode(user.getRole().name(), StandardCharsets.UTF_8);

        getRedirectStrategy().sendRedirect(request, response, redirectUrl);
    }

    private String getFrontendUrl() {
        for (String origin : allowedOrigins.split(",")) {
            String o = origin.trim();
            if (o.startsWith("https://")) return o;
        }
        return "http://localhost:3000";
    }
}
