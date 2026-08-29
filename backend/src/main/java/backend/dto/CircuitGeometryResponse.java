package backend.dto;

import backend.model.enums.GeometrySource;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * A circuit's racing line ready for 3D rendering.
 *
 * <p>Each entry of {@link #points} is {@code [x, y, z]}: {@code x}/{@code z} are plan-view
 * coordinates normalised to {@code [-1, 1]} with the true aspect ratio kept, and {@code y} is
 * elevation in metres above the lowest point of the lap. Clients scale {@code y} themselves —
 * {@link #spanXM} and {@link #spanZM} give the real size of the plan view so the exaggeration
 * factor can be stated honestly.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CircuitGeometryResponse {
    private Long circuitId;
    private String circuitName;
    private String country;
    private String city;

    private GeometrySource source;
    /** Human-readable provenance, safe to show in the UI. */
    private String sourceLabel;
    /** True when {@code y} carries real measured elevation rather than a flat placeholder. */
    private boolean hasRealElevation;

    private List<List<Double>> points;
    private int pointCount;

    private Float spanXM;
    private Float spanZM;
    private Float elevationMinM;
    private Float elevationMaxM;
    private Float elevationGainM;
    private Float measuredLengthKm;

    private Float lengthKm;
    private int turnCount;
    private int drsZones;
    private int totalLaps;
    private Integer firstGpYear;
    private String direction;
    private Float lapRecordSec;
    private String lapRecordHolder;

    private Integer openf1SessionKey;
    private Integer openf1DriverNumber;
    private Integer openf1LapNumber;
    private Instant fetchedAt;
}
