package backend.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Geometry pipeline that turns raw circuit sources into a renderable racing line.
 *
 * <p>Lives in {@code backend.service} because {@link TrackPathMath} is package-private — it is an
 * implementation detail of {@link CircuitGeometryService}, not part of the service API.
 */
@DisplayName("TrackPathMath")
class TrackPathMathTest {

    /** A closed rectangle, sampled densely enough to survive resampling. */
    private static TrackPathMath.RawPath rectangle(double width, double depth, double height) {
        int perSide = 30;
        int n = perSide * 4;
        double[] x = new double[n];
        double[] y = new double[n];
        double[] z = new double[n];

        for (int i = 0; i < perSide; i++) {
            double t = (double) i / perSide;
            // Top edge, right edge, bottom edge, left edge.
            x[i] = -width / 2 + width * t;
            z[i] = -depth / 2;
            x[perSide + i] = width / 2;
            z[perSide + i] = -depth / 2 + depth * t;
            x[perSide * 2 + i] = width / 2 - width * t;
            z[perSide * 2 + i] = depth / 2;
            x[perSide * 3 + i] = -width / 2;
            z[perSide * 3 + i] = depth / 2 - depth * t;
        }
        for (int i = 0; i < n; i++) {
            // A single hill so elevation handling is exercised.
            y[i] = height * Math.sin(Math.PI * i / n);
        }
        return new TrackPathMath.RawPath(x, y, z);
    }

    @Nested
    @DisplayName("clean")
    class Clean {

        @Test
        @DisplayName("drops signal-loss samples that report the origin")
        void dropsZeroedSamples() {
            TrackPathMath.RawPath input = new TrackPathMath.RawPath(
                    new double[]{0, 10, 0, 20, 30},
                    new double[]{5, 5, 5, 5, 5},
                    new double[]{0, 10, 0, 20, 30});

            TrackPathMath.RawPath cleaned = TrackPathMath.clean(input, 0.5);

            assertThat(cleaned.size()).isEqualTo(3);
            assertThat(cleaned.x()).containsExactly(10.0, 20.0, 30.0);
        }

        @Test
        @DisplayName("collapses samples closer together than the minimum step")
        void collapsesStationarySamples() {
            TrackPathMath.RawPath input = new TrackPathMath.RawPath(
                    new double[]{10, 10.1, 10.2, 40, 70},
                    new double[]{1, 1, 1, 1, 1},
                    new double[]{10, 10.1, 10.2, 40, 70});

            TrackPathMath.RawPath cleaned = TrackPathMath.clean(input, 2.0);

            // The three clustered points carry the same shape information as one.
            assertThat(cleaned.size()).isEqualTo(3);
        }

        @Test
        @DisplayName("drops non-finite samples")
        void dropsNonFinite() {
            TrackPathMath.RawPath input = new TrackPathMath.RawPath(
                    new double[]{10, Double.NaN, 40},
                    new double[]{1, 1, 1},
                    new double[]{10, 5, 40});

            assertThat(TrackPathMath.clean(input, 0.5).size()).isEqualTo(2);
        }
    }

    @Nested
    @DisplayName("dropOutliers")
    class DropOutliers {

        @Test
        @DisplayName("rejects a sample that jumps across the circuit")
        void rejectsTeleport() {
            TrackPathMath.RawPath input = new TrackPathMath.RawPath(
                    new double[]{0, 10, 5000, 20, 30},
                    new double[]{0, 0, 0, 0, 0},
                    new double[]{0, 10, 5000, 20, 30});

            TrackPathMath.RawPath filtered = TrackPathMath.dropOutliers(input, 100);

            assertThat(filtered.size()).isEqualTo(4);
            assertThat(filtered.x()).doesNotContain(5000.0);
        }

        @Test
        @DisplayName("keeps a path whose steps are all within the limit")
        void keepsCleanPath() {
            TrackPathMath.RawPath input = rectangle(1000, 800, 40);
            assertThat(TrackPathMath.dropOutliers(input, 200).size()).isEqualTo(input.size());
        }
    }

    @Nested
    @DisplayName("resampleClosed")
    class ResampleClosed {

        @Test
        @DisplayName("produces exactly the requested number of points")
        void exactCount() {
            TrackPathMath.RawPath resampled = TrackPathMath.resampleClosed(rectangle(1000, 800, 40), 240);
            assertThat(resampled.size()).isEqualTo(240);
        }

        @Test
        @DisplayName("spaces points evenly along the lap")
        void evenSpacing() {
            TrackPathMath.RawPath resampled = TrackPathMath.resampleClosed(rectangle(1000, 800, 0), 200);

            double expected = (2 * 1000 + 2 * 800) / 200d;
            for (int i = 0; i < resampled.size(); i++) {
                int next = (i + 1) % resampled.size();
                double step = Math.hypot(
                        resampled.x()[next] - resampled.x()[i],
                        resampled.z()[next] - resampled.z()[i]);
                // Corners cut a little, so the tolerance allows for the chord across a corner.
                assertThat(step).isCloseTo(expected, org.assertj.core.data.Offset.offset(expected * 0.6));
            }
        }

        @Test
        @DisplayName("preserves the enclosed shape rather than shrinking it")
        void preservesExtent() {
            TrackPathMath.RawPath resampled = TrackPathMath.resampleClosed(rectangle(1000, 800, 0), 240);

            double maxX = java.util.Arrays.stream(resampled.x()).max().orElseThrow();
            double minX = java.util.Arrays.stream(resampled.x()).min().orElseThrow();
            assertThat(maxX - minX).isCloseTo(1000, org.assertj.core.data.Offset.offset(20.0));
        }
    }

    @Nested
    @DisplayName("smoothClosed")
    class SmoothClosed {

        @Test
        @DisplayName("reduces sample-to-sample noise")
        void reducesNoise() {
            TrackPathMath.RawPath base = TrackPathMath.resampleClosed(rectangle(1000, 800, 0), 120);

            double[] noisyY = new double[base.size()];
            for (int i = 0; i < base.size(); i++) {
                // Alternating spikes stand in for telemetry jitter.
                noisyY[i] = (i % 2 == 0) ? 4 : -4;
            }
            TrackPathMath.RawPath noisy = new TrackPathMath.RawPath(base.x(), noisyY, base.z());
            TrackPathMath.RawPath smoothed = TrackPathMath.smoothClosed(noisy, 5);

            double noisyRange = range(noisy.y());
            double smoothedRange = range(smoothed.y());
            assertThat(smoothedRange).isLessThan(noisyRange / 2);
        }

        @Test
        @DisplayName("wraps around the start/finish line instead of flattening it")
        void wrapsAtStartLine() {
            double[] flat = new double[60];
            java.util.Arrays.fill(flat, 10.0);
            TrackPathMath.RawPath base = TrackPathMath.resampleClosed(rectangle(1000, 800, 0), 60);
            TrackPathMath.RawPath constant = new TrackPathMath.RawPath(base.x(), flat, base.z());

            TrackPathMath.RawPath smoothed = TrackPathMath.smoothClosed(constant, 5);

            // A constant signal must survive smoothing untouched, including at the wrap point.
            for (double y : smoothed.y()) {
                assertThat(y).isCloseTo(10.0, org.assertj.core.data.Offset.offset(1e-9));
            }
        }

        @Test
        @DisplayName("leaves a path shorter than the window untouched")
        void ignoresTinyPaths() {
            TrackPathMath.RawPath tiny = new TrackPathMath.RawPath(
                    new double[]{0, 1}, new double[]{0, 5}, new double[]{0, 1});
            assertThat(TrackPathMath.smoothClosed(tiny, 5).y()).containsExactly(0.0, 5.0);
        }

        private double range(double[] values) {
            return java.util.Arrays.stream(values).max().orElseThrow()
                    - java.util.Arrays.stream(values).min().orElseThrow();
        }
    }

    @Nested
    @DisplayName("normalise")
    class Normalise {

        @Test
        @DisplayName("fits the plan view inside [-1, 1]")
        void fitsUnitBox() {
            TrackPathMath.NormalisedPath result =
                    TrackPathMath.normalise(TrackPathMath.resampleClosed(rectangle(2000, 1200, 100), 240));

            for (java.util.List<Double> point : result.points()) {
                assertThat(point.get(0)).isBetween(-1.0, 1.0);
                assertThat(point.get(2)).isBetween(-1.0, 1.0);
            }
        }

        @Test
        @DisplayName("keeps the true aspect ratio so a narrow circuit stays narrow")
        void preservesAspectRatio() {
            TrackPathMath.NormalisedPath result =
                    TrackPathMath.normalise(TrackPathMath.resampleClosed(rectangle(2000, 1000, 0), 240));

            double spanX = extent(result, 0);
            double spanZ = extent(result, 2);

            // The source is twice as wide as it is deep; normalisation must not square it up.
            assertThat(spanX / spanZ).isCloseTo(2.0, org.assertj.core.data.Offset.offset(0.1));
            assertThat(spanX).isCloseTo(2.0, org.assertj.core.data.Offset.offset(0.05));
        }

        @Test
        @DisplayName("reports elevation in metres, rebased to the lowest point")
        void elevationStaysInMetres() {
            TrackPathMath.NormalisedPath result =
                    TrackPathMath.normalise(TrackPathMath.resampleClosed(rectangle(2000, 1200, 100), 240));

            double minY = result.points().stream().mapToDouble(p -> p.get(1)).min().orElseThrow();
            double maxY = result.points().stream().mapToDouble(p -> p.get(1)).max().orElseThrow();

            assertThat(minY).isCloseTo(0.0, org.assertj.core.data.Offset.offset(0.01));
            assertThat(maxY).isCloseTo(100.0, org.assertj.core.data.Offset.offset(2.0));
            assertThat(result.elevationMaxM() - result.elevationMinM())
                    .isCloseTo(100.0, org.assertj.core.data.Offset.offset(2.0));
        }

        @Test
        @DisplayName("measures lap length along the line, in kilometres")
        void measuresLapLength() {
            TrackPathMath.NormalisedPath result =
                    TrackPathMath.normalise(TrackPathMath.resampleClosed(rectangle(2000, 1000, 0), 240));

            // Perimeter of the source rectangle is 6000 m.
            assertThat(result.lengthKm()).isCloseTo(6.0, org.assertj.core.data.Offset.offset(0.1));
        }

        @Test
        @DisplayName("reports the real-world span so the client can state its height exaggeration")
        void reportsRealSpans() {
            TrackPathMath.NormalisedPath result =
                    TrackPathMath.normalise(TrackPathMath.resampleClosed(rectangle(2000, 1000, 50), 240));

            assertThat(result.spanXM()).isCloseTo(2000, org.assertj.core.data.Offset.offset(30.0));
            assertThat(result.spanZM()).isCloseTo(1000, org.assertj.core.data.Offset.offset(30.0));
        }

        private double extent(TrackPathMath.NormalisedPath path, int axis) {
            double min = path.points().stream().mapToDouble(p -> p.get(axis)).min().orElseThrow();
            double max = path.points().stream().mapToDouble(p -> p.get(axis)).max().orElseThrow();
            return max - min;
        }
    }
}
