package backend.security;

import backend.model.OtpToken;
import backend.dto.AuthResponse;
import backend.model.User;
import backend.repository.UserRepository;
import backend.service.EmailOwnershipService;
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
    private final EmailOwnershipService emailOwnershipService;
    private final OAuthLoginCodeStore loginCodeStore;

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

        // Only a mailbox Google has verified may claim or create an account.
        if (!Boolean.TRUE.equals(oAuth2User.getAttribute("email_verified"))) {
            log.warn("[OAuth2] Google email not verified for {}", email);
            response.sendRedirect(getFrontendUrl() + "/login?error=email_unverified");
            return;
        }

        User user = userRepository.findByEmail(email).map(emailOwnershipService::claim).orElseGet(() -> {
            String baseUsername = email.split("@")[0].replaceAll("[^a-zA-Z0-9_]", "");
            String username = baseUsername;
            int suffix = 1;
            while (userRepository.existsByUsername(username)) username = baseUsername + suffix++;
            User newUser = User.builder()
                    .username(username).email(email).password("").role(User.Role.VIEWER).emailVerified(true)
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

        // Echo back the browser nonce the SPA sent when starting the flow (carried inside the OAuth
        // state), so /oauth2/callback can verify this browser initiated the login — the login-CSRF /
        // session-fixation guard. See ClientStateAuthorizationRequestResolver.
        String state = ClientStateAuthorizationRequestResolver.clientStateFrom(request.getParameter("state"));

        // Tokens never travel in the URL: the SPA swaps this one-time code for them via POST
        // /api/auth/oauth2/exchange.
        String code = loginCodeStore.issue(AuthResponse.builder()
                .accessToken(accessToken).refreshToken(refreshToken)
                .username(user.getUsername()).role(user.getRole().name())
                .expiresIn(accessTokenExpiration / 1000).build());

        String redirectUrl = getFrontendUrl() + "/oauth2/callback"
                + "?code=" + URLEncoder.encode(code, StandardCharsets.UTF_8)
                + (state != null ? "&state=" + URLEncoder.encode(state, StandardCharsets.UTF_8) : "");

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
