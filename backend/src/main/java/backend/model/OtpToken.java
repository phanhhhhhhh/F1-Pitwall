package backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "otp_tokens")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OtpToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OtpType type;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    @Column(nullable = false)
    private boolean used;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public enum OtpType {
        FORGOT_PASSWORD, LOGIN_OTP, OAUTH_2FA
    }
}
