package backend.service;

import backend.model.OtpToken;
import backend.repository.OtpTokenRepository;
import backend.security.OtpAttemptService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@DisplayName("OtpService — codes are stored only as keyed digests")
class OtpServiceTest {

    private OtpTokenRepository repo;
    private EmailService email;
    private OtpService service;

    @BeforeEach
    void setUp() {
        repo = mock(OtpTokenRepository.class);
        email = mock(EmailService.class);
        service = new OtpService(repo, email, mock(OtpAttemptService.class));
        ReflectionTestUtils.setField(service, "hmacSecret", "unit-test-secret-of-sufficient-length-1234");
    }

    @Test
    @DisplayName("the persisted token holds a digest, and only the emailed copy holds the real code")
    void storesDigestNotCode() {
        service.sendOtp("a@b.test", OtpToken.OtpType.LOGIN_OTP);

        ArgumentCaptor<String> emailed = ArgumentCaptor.forClass(String.class);
        verify(email).sendOtpEmail(eq("a@b.test"), emailed.capture(), any());
        ArgumentCaptor<OtpToken> saved = ArgumentCaptor.forClass(OtpToken.class);
        verify(repo).save(saved.capture());

        assertThat(emailed.getValue()).matches("\\d{6}");
        assertThat(saved.getValue().getCode()).isNotEqualTo(emailed.getValue()).matches("[0-9a-f]{64}");
        assertThat(saved.getValue().getCode()).isEqualTo(service.digest("a@b.test", OtpToken.OtpType.LOGIN_OTP, emailed.getValue()));
    }

    @Test
    @DisplayName("verification looks the code up by its digest")
    void verifiesByDigest() {
        OtpToken token = OtpToken.builder().email("a@b.test").type(OtpToken.OtpType.LOGIN_OTP).build();
        String digest = service.digest("a@b.test", OtpToken.OtpType.LOGIN_OTP, "123456");
        when(repo.findTopByEmailAndCodeAndTypeAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
                eq("a@b.test"), eq(digest), eq(OtpToken.OtpType.LOGIN_OTP), any(LocalDateTime.class)))
                .thenReturn(Optional.of(token));

        assertThat(service.verifyOtp("a@b.test", "123456", OtpToken.OtpType.LOGIN_OTP)).isTrue();
        assertThat(service.verifyOtp("a@b.test", "654321", OtpToken.OtpType.LOGIN_OTP)).isFalse();
    }

    @Test
    @DisplayName("the digest is bound to the email and the OTP type")
    void digestBinding() {
        String base = service.digest("a@b.test", OtpToken.OtpType.LOGIN_OTP, "123456");
        assertThat(service.digest("c@d.test", OtpToken.OtpType.LOGIN_OTP, "123456")).isNotEqualTo(base);
        assertThat(service.digest("a@b.test", OtpToken.OtpType.FORGOT_PASSWORD, "123456")).isNotEqualTo(base);
    }
}
