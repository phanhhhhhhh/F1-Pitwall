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

    @Column(name = "pit_laps_json")
    private String pitLapsJson;

    /**
     * Full ordered stint list (compound + lap count per stint) as JSON, e.g.
     * {@code [{"tyre":"SOFT","laps":20},{"tyre":"MEDIUM","laps":32}]}. plannedCompounds and
     * pitLap1..3/pitLapsJson are derived summaries of this and can't alone reconstruct a
     * strategy with more than 3 stops in the simulator UI, so this is the field responses
     * round-trip through.
     */
    @Column(name = "stints_json", columnDefinition = "TEXT")
    private String stintsJson;

    private boolean executed;
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "race_id")
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Race race;
}