package backend.model;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import jakarta.persistence.*;
import lombok.*;

@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Data @Entity @Builder
@NoArgsConstructor @AllArgsConstructor
@Table(name = "lap_telemetry")
public class LapTelemetry {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private int lapNumber;
    private float lapTimeSec;
    private float speedKmh;
    private int rpm;
    private int gear;
    private float throttlePct;
    private float brakePct;
    private boolean drsActive;
    private float fuelLoad;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "race_result_id")
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private RaceResult raceResult;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tyre_compound_id")
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private TyreCompound tyreCompound;
}
