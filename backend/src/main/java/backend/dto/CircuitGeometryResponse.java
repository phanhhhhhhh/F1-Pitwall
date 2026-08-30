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

    /**
     * True when the racing line is backed by car telemetry from the same lap, so {@link #samples},
     * {@link #corners} and {@link #drsRanges} are measurements rather than empty lists.
     */
    private boolean hasLapTelemetry;

    /** What the car was doing at each entry of {@link #points}, empty without lap telemetry. */
    private List<TrackSample> samples;

    /** Corners read off the traced lap's speed trace, numbered in track order from the finish line. */
    private List<TrackCorner> corners;

    /** Stretches where the traced driver actually had DRS open. Empty is a real answer, not a gap. */
    private List<DrsRange> drsRanges;

    /**
     * One point of the traced lap.
     *
     * <p>The two G figures are derived from the line and the speed rather than measured: lateral
     * from the curvature of the racing line, longitudinal from how the speed changes along it.
     * Point spacing averages the curvature, so lateral load reads low through the tightest corners.
     */
    public record TrackSample(
            float speedKmh,
            int gear,
            float throttlePct,
            float brakePct,
            boolean drsOpen,
            float lateralG,
            float longitudinalG
    ) {}

    /** A corner as driven on the traced lap. {@code brakingM} is measured back to the entry peak. */
    public record TrackCorner(
            int number,
            int pointIndex,
            float apexSpeedKmH,
            int gear,
            float entrySpeedKmH,
            float brakingM,
            float lateralG
    ) {}

    /** A DRS stretch. Wraps past the finish line when {@code endIndex} is below {@code startIndex}. */
    public record DrsRange(int startIndex, int endIndex, float lengthM) {}

    private Float spanXM;
    private Float spanZM;
    private Float elevationMinM;
    private Float elevationMaxM;
    private Float elevationGainM;
    private Float measuredLengthKm;

    private Float lengthKm;
    private int turnCount;
    private Integer drsZones;
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
