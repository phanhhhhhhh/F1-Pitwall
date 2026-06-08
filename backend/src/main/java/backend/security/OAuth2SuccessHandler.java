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

    @Value("${allowed.origins:http://localhost:3000}")
    private String allowedOrigins;

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

        // Create user if first time
        userRepository.findByEmail(email).orElseGet(() -> {
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

        // Send 2FA OTP then redirect to pending page
        try {
            otpService.sendOtp(email, OtpToken.OtpType.OAUTH_2FA);
            log.info("[OAuth2] 2FA OTP sent for {}", email);
        } catch (Exception e) {
            log.error("[OAuth2] Failed to send 2FA OTP to {}: {}", email, e.getMessage());
            response.sendRedirect(getFrontendUrl() + "/login?error=otp_failed");
            return;
        }

        String redirectUrl = getFrontendUrl() + "/oauth2/pending?email="
                + URLEncoder.encode(email, StandardCharsets.UTF_8);
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