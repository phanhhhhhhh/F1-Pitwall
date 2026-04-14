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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "race_id")
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Race race;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "championship_id")
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Championship championship;

    @JsonIgnore
    @OneToMany(mappedBy = "raceResult", cascade = CascadeType.ALL)
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private List<LapTelemetry> lapTelemetries;

    @JsonIgnore
    @OneToMany(mappedBy = "raceResult", cascade = CascadeType.ALL)
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private List<PitStop> pitStops;
}
