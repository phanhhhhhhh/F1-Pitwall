package backend.service;

import backend.model.OtpToken;
import backend.repository.OtpTokenRepository;
import backend.security.OtpAttemptService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

@Slf4j
@Service
@RequiredArgsConstructor
public class OtpService {

    private final OtpTokenRepository otpTokenRepository;
    private final EmailService emailService;
    private final OtpAttemptService otpAttemptService;
    private static final SecureRandom RANDOM = new SecureRandom();

    /** Keys the OTP digest so a leaked otp_tokens table can't be reversed by enumerating 10^6 codes. */
    @Value("${app.jwt.secret}")
    private String hmacSecret;

    /** Only this digest is stored; the plaintext code exists just long enough to be emailed. */
    String digest(String email, OtpToken.OtpType type, String code) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(hmacSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] out = mac.doFinal((email + "|" + type + "|" + code).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(out);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HMAC-SHA256 unavailable", e);
        }
    }

    @Transactional
    public void sendOtp(String email, OtpToken.OtpType type) {
        otpTokenRepository.deleteByEmailAndTypeAndUsedFalse(email, type);
        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        otpTokenRepository.save(OtpToken.builder()
                .email(email)
                .code(digest(email, type, code))
                .type(type)
                .expiresAt(LocalDateTime.now().plusMinutes(5))
                .used(false)
                .build());
        emailService.sendOtpEmail(email, code, type.name());
        log.info("[OTP] Sent {} OTP to {}", type, email);
    }

    @Transactional
    public boolean verifyOtp(String email, String code, OtpToken.OtpType type) {
        if (otpAttemptService.isLocked(email, type)) {
            log.warn("[OTP] {} verification locked out for {} — too many failed attempts", type, email);
            return false;
        }
        return otpTokenRepository
                .findTopByEmailAndCodeAndTypeAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
                        email, digest(email, type, code), type, LocalDateTime.now())
                .map(otp -> {
                    otp.setUsed(true);
                    otpTokenRepository.save(otp);
                    otpAttemptService.reset(email, type);
                    log.info("[OTP] Verified {} OTP for {}", type, email);
                    return true;
                })
                .orElseGet(() -> {
                    otpAttemptService.recordFailure(email, type);
                    log.warn("[OTP] Invalid/expired {} OTP attempt for {}", type, email);
                    return false;
                });
    }
}
