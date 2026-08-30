package backend.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Analytics derived from one traced lap: corners, DRS zones and the loads on the car.
 *
 * <p>Lives in {@code backend.service} because {@link LapTraceMath} is package-private — it is an
 * implementation detail of {@link CircuitGeometryService}, not part of the service API.
 *
 * <p>The fixtures are circles because a circle has an exact answer: the radius through any three
 * consecutive vertices of an inscribed polygon is the circle's own radius, so a constant-speed lap
 * of one has a lateral load that can be written down rather than eyeballed.
 */
@DisplayName("LapTraceMath")
class LapTraceMathTest {

    private static final int POINTS = 240;
    /** Radius in metres of the circular test track. */
    private static final double RADIUS = 500;

    /**
     * A circle stored the way the geometry pipeline stores one: centred and divided by half of its
     * longer side, which for a circle leaves the unit circle.
     */
    private static List<List<Double>> circle() {
        List<List<Double>> points = new ArrayList<>(POINTS);
        for (int i = 0; i < POINTS; i++) {
            double t = 2 * Math.PI * i / POINTS;
            points.add(List.of(Math.cos(t), 0d, Math.sin(t)));
        }
        return points;
    }

    /** The plan-view span of {@link #circle()} in metres, as the pipeline would have recorded it. */
    private static final float SPAN_M = (float) (2 * RADIUS);

    private static List<LapTraceMath.Sample> atConstantSpeed(double speedKmH) {
        List<LapTraceMath.Sample> samples = new ArrayList<>(POINTS);
        for (int i = 0; i < POINTS; i++) {
            samples.add(new LapTraceMath.Sample((float) speedKmH, 7, 100, 0, 0));
        }
        return samples;
    }

    /**
     * A lap at {@code straightKmH} with triangular braking zones down to the given apex speeds.
     * Each well is twenty points wide, comfortably inside the window corner detection looks over.
     */
    private static List<LapTraceMath.Sample> withCorners(double straightKmH, int[] apexIndices, double[] apexKmH) {
        double[] speed = new double[POINTS];
        java.util.Arrays.fill(speed, straightKmH);

        for (int c = 0; c < apexIndices.length; c++) {
            for (int d = -10; d <= 10; d++) {
                int i = Math.floorMod(apexIndices[c] + d, POINTS);
                double depth = (straightKmH - apexKmH[c]) * (1 - Math.abs(d) / 10d);
                speed[i] = Math.min(speed[i], straightKmH - depth);
            }
        }

        List<LapTraceMath.Sample> samples = new ArrayList<>(POINTS);
        for (int i = 0; i < POINTS; i++) {
            int gear = speed[i] < 120 ? 2 : speed[i] < 220 ? 5 : 8;
            samples.add(new LapTraceMath.Sample((float) speed[i], gear, 100, 0, 0));
        }
        return samples;
    }

    private static LapTraceMath.Derived derive(List<LapTraceMath.Sample> samples, int expectedTurns) {
        return LapTraceMath.derive(circle(), samples, SPAN_M, SPAN_M, expectedTurns);
    }

    @Nested
    @DisplayName("loads")
    class Loads {

        @Test
        @DisplayName("lateral load on a constant-radius lap is v squared over r")
        void lateralMatchesTheTextbookFigure() {
            double speedKmH = 180;
            double v = speedKmH / 3.6;
            double expected = v * v / (RADIUS * 9.80665);

            List<LapTraceMath.Loaded> loaded = derive(atConstantSpeed(speedKmH), 0).samples();

            assertThat(loaded).hasSize(POINTS);
            assertThat(loaded).allSatisfy(l ->
                    assertThat(Math.abs(l.lateralG())).isCloseTo((float) expected, within(0.01f)));
        }

        @Test
        @DisplayName("lateral load keeps the sign of the corner it was taken in")
        void lateralIsSignedByTurnDirection() {
            List<LapTraceMath.Loaded> loaded = derive(atConstantSpeed(180), 0).samples();

            // A circle turns the same way the whole way round, so every reading shares one sign.
            float first = loaded.get(0).lateralG();
            assertThat(first).isNotZero();
            assertThat(loaded).allSatisfy(l ->
                    assertThat(Math.signum(l.lateralG())).isEqualTo(Math.signum(first)));
        }

        @Test
        @DisplayName("longitudinal load is zero when the speed never changes")
        void longitudinalIsZeroAtConstantSpeed() {
            List<LapTraceMath.Loaded> loaded = derive(atConstantSpeed(180), 0).samples();

            assertThat(loaded).allSatisfy(l ->
                    assertThat(l.longitudinalG()).isCloseTo(0f, within(0.001f)));
        }

        @Test
        @DisplayName("braking reads as a negative longitudinal load and acceleration as a positive one")
        void longitudinalFollowsTheSpeedTrace() {
            List<LapTraceMath.Loaded> loaded =
                    derive(withCorners(300, new int[]{120}, new double[]{90}), 1).samples();

            // Five points before the apex the car is hard on the brakes; five points after, back on
            // the throttle. The signs are what the G-force display draws, so they are the assertion.
            assertThat(loaded.get(115).longitudinalG()).isNegative();
            assertThat(loaded.get(125).longitudinalG()).isPositive();
        }

        @Test
        @DisplayName("loads stay at zero when the real-world scale is unknown")
        void withoutSpansThereIsNoScaleToWorkFrom() {
            LapTraceMath.Derived derived =
                    LapTraceMath.derive(circle(), atConstantSpeed(180), null, null, 0);

            assertThat(derived.samples()).isNotEmpty();
            assertThat(derived.samples()).allSatisfy(l -> {
                assertThat(l.lateralG()).isZero();
                assertThat(l.longitudinalG()).isZero();
            });
        }
    }

    @Nested
    @DisplayName("corners")
    class Corners {

        @Test
        @DisplayName("finds each braking zone and numbers them in track order")
        void findsTheBrakingZones() {
            List<LapTraceMath.Corner> corners =
                    derive(withCorners(300, new int[]{60, 180}, new double[]{110, 80}), 2).corners();

            assertThat(corners).hasSize(2);
            assertThat(corners).extracting(LapTraceMath.Corner::number).containsExactly(1, 2);
            assertThat(corners.get(0).pointIndex()).isCloseTo(60, within(2));
            assertThat(corners.get(1).pointIndex()).isCloseTo(180, within(2));
            // Smoothing lifts the reported apex a little, but the slower corner stays the slower one.
            assertThat(corners.get(1).apexSpeedKmH()).isLessThan(corners.get(0).apexSpeedKmH());
        }

        @Test
        @DisplayName("reports the gear taken at the apex and a braking distance in metres")
        void describesHowTheCornerWasDriven() {
            LapTraceMath.Corner corner =
                    derive(withCorners(300, new int[]{60}, new double[]{110}), 1).corners().get(0);

            assertThat(corner.gear()).isEqualTo(2);
            assertThat(corner.entrySpeedKmH()).isGreaterThan(corner.apexSpeedKmH());
            // One tenth of a 3.1 km lap, give or take where the braking point lands.
            assertThat(corner.brakingM()).isBetween(60f, 220f);
        }

        @Test
        @DisplayName("a flat-out lap has no corners to report")
        void aLapWithNoBrakingHasNoCorners() {
            assertThat(derive(atConstantSpeed(300), 18).corners()).isEmpty();
        }

        @Test
        @DisplayName("keeps only the most significant corners when the circuit publishes a turn count")
        void honoursThePublishedTurnCount() {
            List<LapTraceMath.Sample> samples = withCorners(
                    300, new int[]{40, 100, 160, 220}, new double[]{90, 250, 120, 260});

            List<LapTraceMath.Corner> corners = derive(samples, 2).corners();

            assertThat(corners).hasSize(2);
            // The two that cost the most speed are the ones a circuit map would draw; the pair the
            // driver barely lifted for are left out rather than crowding the map.
            assertThat(corners.get(0).pointIndex()).isCloseTo(40, within(2));
            assertThat(corners.get(1).pointIndex()).isCloseTo(160, within(2));
        }
    }

    @Nested
    @DisplayName("DRS")
    class Drs {

        private static List<LapTraceMath.Sample> withWingOpen(int from, int length) {
            List<LapTraceMath.Sample> samples = new ArrayList<>(POINTS);
            for (int i = 0; i < POINTS; i++) samples.add(new LapTraceMath.Sample(300, 8, 100, 0, 0));
            for (int k = 0; k < length; k++) {
                int i = (from + k) % POINTS;
                samples.set(i, new LapTraceMath.Sample(300, 8, 100, 0, 12));
            }
            return samples;
        }

        @Test
        @DisplayName("reports the stretch the wing was open over")
        void findsTheZone() {
            List<LapTraceMath.DrsRange> ranges = derive(withWingOpen(50, 20), 0).drsRanges();

            assertThat(ranges).hasSize(1);
            assertThat(ranges.get(0).startIndex()).isEqualTo(50);
            assertThat(ranges.get(0).endIndex()).isEqualTo(69);
            // Twenty of the 240 segments of a 3.1 km lap.
            assertThat(ranges.get(0).lengthM()).isCloseTo(262f, within(15f));
        }

        @Test
        @DisplayName("a zone straddling the finish line stays one zone")
        void handlesTheWrapPastTheLine() {
            List<LapTraceMath.DrsRange> ranges = derive(withWingOpen(230, 20), 0).drsRanges();

            assertThat(ranges).hasSize(1);
            assertThat(ranges.get(0).startIndex()).isEqualTo(230);
            assertThat(ranges.get(0).endIndex()).isEqualTo(9);
        }

        @Test
        @DisplayName("a lap the driver never opened the wing on reports no zones")
        void cleanAirMeansNoZones() {
            assertThat(derive(atConstantSpeed(300), 0).drsRanges()).isEmpty();
        }

        @Test
        @DisplayName("eligibility alone is not an open wing")
        void detectionIsNotActivation() {
            List<LapTraceMath.Sample> samples = new ArrayList<>(POINTS);
            for (int i = 0; i < POINTS; i++) {
                // 8 is OpenF1's "allowed to use it", which is not the same as having used it.
                samples.add(new LapTraceMath.Sample(300, 8, 100, 0, i >= 50 && i < 70 ? 8 : 0));
            }

            assertThat(derive(samples, 0).drsRanges()).isEmpty();
        }
    }

    @Nested
    @DisplayName("alignment")
    class Alignment {

        @Test
        @DisplayName("each stored point takes the reading from the sample it is closest to")
        void carriesTelemetryAcrossByPosition() {
            // A source lap of four points around a square, each with its own distinctive speed.
            TrackPathMath.RawPath source = new TrackPathMath.RawPath(
                    new double[]{0, 100, 100, 0},
                    new double[]{0, 0, 0, 0},
                    new double[]{0, 0, 100, 100});
            List<LapTraceMath.Sample> readings = List.of(
                    new LapTraceMath.Sample(100, 3, 50, 0, 0),
                    new LapTraceMath.Sample(200, 5, 70, 0, 0),
                    new LapTraceMath.Sample(300, 7, 90, 0, 0),
                    new LapTraceMath.Sample(400, 8, 100, 0, 0));

            // A target sitting a few metres from the second and third source points.
            TrackPathMath.RawPath target = new TrackPathMath.RawPath(
                    new double[]{98, 96},
                    new double[]{0, 0},
                    new double[]{4, 97});

            List<LapTraceMath.Sample> aligned = LapTraceMath.alignToPath(target, source, readings);

            assertThat(aligned).extracting(LapTraceMath.Sample::speedKmh).containsExactly(200f, 300f);
        }

        @Test
        @DisplayName("a path with no telemetry aligns to nothing rather than to zeroes")
        void withoutReadingsThereIsNothingToCarry() {
            TrackPathMath.RawPath path = new TrackPathMath.RawPath(
                    new double[]{0, 1}, new double[]{0, 0}, new double[]{0, 1});

            assertThat(LapTraceMath.alignToPath(path, path, List.of())).isEmpty();
            assertThat(LapTraceMath.alignToPath(path, path, null)).isEmpty();
        }
    }

    @Nested
    @DisplayName("missing input")
    class MissingInput {

        @Test
        @DisplayName("nothing is derived when the telemetry does not cover the line")
        void refusesToGuessAtMissingSamples() {
            assertThat(LapTraceMath.derive(circle(), List.of(), SPAN_M, SPAN_M, 10))
                    .isEqualTo(LapTraceMath.Derived.EMPTY);
            assertThat(LapTraceMath.derive(circle(), null, SPAN_M, SPAN_M, 10))
                    .isEqualTo(LapTraceMath.Derived.EMPTY);
            // A short read of the telemetry must not be stretched over the whole lap.
            assertThat(LapTraceMath.derive(circle(), atConstantSpeed(200).subList(0, 100),
                    SPAN_M, SPAN_M, 10)).isEqualTo(LapTraceMath.Derived.EMPTY);
        }

        @Test
        @DisplayName("nothing is derived from a line too short to have a shape")
        void refusesATrivialLine() {
            List<List<Double>> stub = List.of(List.of(0d, 0d, 0d), List.of(1d, 0d, 1d));

            assertThat(LapTraceMath.derive(stub, List.of(
                    LapTraceMath.Sample.EMPTY, LapTraceMath.Sample.EMPTY), SPAN_M, SPAN_M, 0))
                    .isEqualTo(LapTraceMath.Derived.EMPTY);
        }
    }
}
