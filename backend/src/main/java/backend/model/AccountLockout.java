package backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "account_lockouts")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class AccountLockout {

    @Id
    @Column(length = 255)
    private String username;

    @Column(name = "locked_until", nullable = false)
    private Instant lockedUntil;
}
