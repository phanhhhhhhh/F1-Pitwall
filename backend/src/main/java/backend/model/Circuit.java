package backend.model;

import backend.model.enums.CircuitType;
import backend.model.enums.TrackDirection;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

import java.util.List;

@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Data @Entity @Builder
@NoArgsConstructor @AllArgsConstructor
@Table(name = "circuits")
public class Circuit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String country;

    private String city;

    @Enumerated(EnumType.STRING)
    private CircuitType type;

    private int totalLaps;
    private float lengthKm;
    private float lapRecordSec;
    private String lapRecordHolder;
    private int turnCount;

    /** Number of DRS activation zones on the lap. */
    private int drsZones;

    /** Year this circuit first hosted a championship Grand Prix. */
    private int firstGpYear;

    /** Elevation delta (highest minus lowest point) in metres, from real track geometry. */
    private Float elevationGainM;

    /** Circuit centre coordinates — used to match external map datasets. */
    private Double latitude;
    private Double longitude;

    /** Racing direction around the lap. */
    @Enumerated(EnumType.STRING)
    private TrackDirection direction;

    @JsonIgnore
    @OneToMany(mappedBy = "circuit", cascade = CascadeType.ALL)
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private List<Race> races;
}