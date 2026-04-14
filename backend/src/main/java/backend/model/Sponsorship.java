package backend.model;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Data @Entity @Builder
@NoArgsConstructor @AllArgsConstructor
@Table(name = "sponsorships")
public class Sponsorship {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String sponsorName;
    private float valueM;
    private LocalDate startDate;
    private LocalDate endDate;
    private String category;
    private String logoUrl;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id")
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Team team;
}
