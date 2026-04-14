package backend.model;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import jakarta.persistence.*;
import lombok.*;

@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Data @Entity @Builder
@NoArgsConstructor @AllArgsConstructor
@Table(name = "car_setups")
public class CarSetup {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private float frontWingAngle;
    private float rearWingAngle;
    private float suspensionStiffness;
    private float brakeBias;
    private float tyrePressureFront;
    private float tyrePressureRear;
    private int diffOnThrottle;
    private int diffOffThrottle;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id")
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Team team;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "race_id")
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Race race;
}
