package backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "admin_audit_log")
public class AdminAuditEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String actor;

    @Column(nullable = false, length = 64)
    private String action;

    @Column(length = 255)
    private String target;

    @Column(length = 500)
    private String detail;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
