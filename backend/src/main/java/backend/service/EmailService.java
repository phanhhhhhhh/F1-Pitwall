package backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromAddress;

    public void sendOtpEmail(String to, String code, String purpose) {
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(fromAddress);
            msg.setTo(to);
            msg.setSubject(subject(purpose));
            msg.setText(body(code, purpose));
            mailSender.send(msg);
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
