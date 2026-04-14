package backend.model;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import jakarta.persistence.*;
import lombok.*;

@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Data @Entity @Builder
@NoArgsConstructor @AllArgsConstructor
@Table(name = "strategy_plans")
public class StrategyPlan {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String planName;
    private int plannedStops;
    private String plannedCompounds;
    private int pitLap1;
    private int pitLap2;
    private int pitLap3;
    private boolean executed;
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "race_id")
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Race race;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "engineer_id")
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Engineer engineer;
}
