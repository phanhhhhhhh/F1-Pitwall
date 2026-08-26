package backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

import java.util.List;

@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Data @Entity @Builder
@NoArgsConstructor @AllArgsConstructor
@Table(name = "race_results")
public class RaceResult {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private int startPosition;
    private int finishPosition;
    private float points;
    private int fastestLapNumber;
    private float fastestLapTime;
    private boolean hasFastestLap;
    private String dnfReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "driver_id")
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Driver driver;

    /**
     * Snapshot of the team the driver raced for in this race. Drivers can move
     * mid-season, so constructor standings must use this per-result team (with
     * driver.team as fallback for legacy rows), never the driver's current team.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id")
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Team team;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "race_id")
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Race race;

    @JsonIgnore
    @OneToMany(mappedBy = "raceResult", cascade = CascadeType.ALL)
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private List<LapTelemetry> lapTelemetries;

    @JsonIgnore
    @OneToMany(mappedBy = "raceResult", cascade = CascadeType.ALL)
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private List<PitStop> pitStops;
}