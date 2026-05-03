package backend.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "qualifying_results")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class QualifyingResult {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private int gridPosition;
    private int q1Position;
    private int q2Position;
    private int q3Position;

    private Double q1Time;
    private Double q2Time;
    private Double q3Time;
    private Double bestTime;

    private boolean eliminatedQ1;
    private boolean eliminatedQ2;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "race_id")
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Race race;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "driver_id")
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Driver driver;
}
