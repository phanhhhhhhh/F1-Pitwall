package backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Per-round news item shown on the frontend home page.
 * RACE_REPORT entries are auto-generated when a race is synced;
 * DRIVER_NEWS entries are curated (e.g. mid-season driver changes).
 */
@Entity
@Table(name = "race_news")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class RaceNews {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "race_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Race race;

    @Column(nullable = false)
    private String title;

    /** "RACE_REPORT" | "DRIVER_NEWS" */
    private String tag;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
