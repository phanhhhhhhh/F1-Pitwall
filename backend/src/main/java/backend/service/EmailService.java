package backend.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class EmailService {

    @Value("${resend.api-key:}")
    private String apiKey;

    @Value("${resend.from:onboarding@resend.dev}")
    private String fromAddress;

    private final RestClient restClient = RestClient.create();

    public void sendOtpEmail(String to, String code, String purpose) {
        if (apiKey == null || apiKey.isBlank()) {
            log.error("[Email] RESEND_API_KEY not configured");
            throw new RuntimeException("Email service not configured. Contact administrator.");
        }
        try {
            Map<String, Object> payload = Map.of(
                "from", fromAddress,
                "to", List.of(to),
                "subject", subject(purpose),
                "text", body(code, purpose)
            );
            restClient.post()
                .uri("https://api.resend.com/emails")
                .header("Authorization", "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .toBodilessEntity();
            log.info("[Email] OTP sent to {} for {}", to, purpose);
        } catch (Exception e) {
            log.error("[Email] Failed to send OTP to {}: {}", to, e.getMessage());
            throw new RuntimeException("Failed to send email. Please try again.");
        }
    }

    private String subject(String purpose) {
        return switch (purpose) {
            case "FORGOT_PASSWORD" -> "[F1 Pitwall] Password Reset Code";
            case "LOGIN_OTP"       -> "[F1 Pitwall] Login Verification Code";
            case "OAUTH_2FA"       -> "[F1 Pitwall] Google Login Verification";
            default                -> "[F1 Pitwall] Verification Code";
        };
    }

    private String body(String code, String purpose) {
        String action = switch (purpose) {
            case "FORGOT_PASSWORD" -> "reset your password";
            case "LOGIN_OTP"       -> "log in to your account";
            case "OAUTH_2FA"       -> "complete your Google login";
            default                -> "verify your identity";
        };
        return """
                F1 Pitwall — Verification Code
                ─────────────────────────────────

                Your one-time code to %s:

                        %s

                This code expires in 5 minutes.
                Do not share this code with anyone.

                If you did not request this, please ignore this email.
                """.formatted(action, code);
    }
}
