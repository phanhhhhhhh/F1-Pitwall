package backend.model;

import backend.model.enums.GeometrySource;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * A circuit's racing line as a 3D poly-line, cached from an external source.
 *
 * <p>{@link #points} is a JSON array of {@code [x, y, z]} triples where {@code x}/{@code z} are the
 * plan-view coordinates normalised into {@code [-1, 1]} with the real aspect ratio preserved, and
 * {@code y} is elevation in metres above the lowest point on the lap. Keeping elevation unscaled
 * lets the client exaggerate it independently of the plan view.
 */
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Data @Entity @Builder
@NoArgsConstructor @AllArgsConstructor
@Table(name = "circuit_geometry")
public class CircuitGeometry {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "circuit_id", unique = true)
    @ToString.Exclude @EqualsAndHashCode.Exclude
    private Circuit circuit;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private GeometrySource source;

    /** JSON array of [x, y, z] triples — see class javadoc for the coordinate contract. */
    @Lob
    @Column(columnDefinition = "TEXT")
    private String points;

    private int pointCount;

    /** Real-world bounding box of the plan view, in metres. */
    private Float spanXM;
    private Float spanZM;

    private Float elevationMinM;
    private Float elevationMaxM;
    private Float elevationGainM;

    /** Lap length measured along the stored poly-line, in kilometres. */
    private Float measuredLengthKm;

    /** Provenance for OPENF1-sourced geometry, so a stale sample can be traced back. */
    private Integer openf1SessionKey;
    private Integer openf1DriverNumber;
    private Integer openf1LapNumber;

    private Instant fetchedAt;
}
