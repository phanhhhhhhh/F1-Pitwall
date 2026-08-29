package backend.service;

import java.util.ArrayList;
import java.util.List;

/**
 * Geometry helpers shared by the circuit-geometry sources.
 *
 * <p>Every source produces a closed racing line in real-world metres; these helpers clean it,
 * resample it to a fixed point budget and normalise the plan view so the client can render any
 * circuit with the same camera setup.
 */
final class TrackPathMath {

    private TrackPathMath() {}

    /** A racing line in real-world metres: plan view in {@code x}/{@code z}, elevation in {@code y}. */
    record RawPath(double[] x, double[] y, double[] z) {
        int size() { return x.length; }
    }

    /** A racing line after normalisation, ready to serialise. */
    record NormalisedPath(
            List<List<Double>> points,
            double spanXM,
            double spanZM,
            double elevationMinM,
            double elevationMaxM,
            double lengthKm
    ) {}

    /**
     * Drops duplicate and glitched samples. Consecutive points closer than {@code minStepM} carry no
     * shape information but do inflate the payload, and telemetry feeds occasionally emit a zeroed
     * sample when a car loses signal.
     */
    static RawPath clean(RawPath in, double minStepM) {
        List<Double> xs = new ArrayList<>();
        List<Double> ys = new ArrayList<>();
        List<Double> zs = new ArrayList<>();

        for (int i = 0; i < in.size(); i++) {
            double x = in.x()[i];
            double y = in.y()[i];
            double z = in.z()[i];
            if (!Double.isFinite(x) || !Double.isFinite(y) || !Double.isFinite(z)) continue;
            if (x == 0d && z == 0d) continue; // signal-loss sample

            if (!xs.isEmpty()) {
                double dx = x - xs.get(xs.size() - 1);
                double dz = z - zs.get(zs.size() - 1);
                if (Math.hypot(dx, dz) < minStepM) continue;
            }
            xs.add(x);
            ys.add(y);
            zs.add(z);
        }
        return toArrays(xs, ys, zs);
    }

    /**
     * Rejects samples that jump further than {@code maxStepM} from the running line. A lap window can
     * clip a slice of an out-lap or a second car, which would otherwise draw a straight line across
     * the middle of the circuit.
     */
    static RawPath dropOutliers(RawPath in, double maxStepM) {
        if (in.size() < 3) return in;

        List<Double> xs = new ArrayList<>();
        List<Double> ys = new ArrayList<>();
        List<Double> zs = new ArrayList<>();
        xs.add(in.x()[0]);
        ys.add(in.y()[0]);
        zs.add(in.z()[0]);

        for (int i = 1; i < in.size(); i++) {
            double dx = in.x()[i] - xs.get(xs.size() - 1);
            double dz = in.z()[i] - zs.get(zs.size() - 1);
            if (Math.hypot(dx, dz) > maxStepM) continue;
            xs.add(in.x()[i]);
            ys.add(in.y()[i]);
            zs.add(in.z()[i]);
        }
        return toArrays(xs, ys, zs);
    }

    /**
     * Resamples the closed loop to exactly {@code count} points spaced evenly by arc length, so the
     * client gets a predictable payload and an even spline regardless of how the source sampled it.
     */
    static RawPath resampleClosed(RawPath in, int count) {
        int n = in.size();
        if (n < 2) return in;

        // Walk the loop with the first point repeated at the end so the closing segment is included.
        double[] cumulative = new double[n + 1];
        for (int i = 1; i <= n; i++) {
            int prev = i - 1;
            int curr = i % n;
            double dx = in.x()[curr] - in.x()[prev];
            double dz = in.z()[curr] - in.z()[prev];
            cumulative[i] = cumulative[prev] + Math.hypot(dx, dz);
        }
        double total = cumulative[n];
        if (total <= 0) return in;

        double[] outX = new double[count];
        double[] outY = new double[count];
        double[] outZ = new double[count];

        int cursor = 0;
        for (int i = 0; i < count; i++) {
            double target = total * i / count;
            while (cursor < n && cumulative[cursor + 1] < target) cursor++;

            int a = cursor % n;
            int b = (cursor + 1) % n;
            double segment = cumulative[cursor + 1] - cumulative[cursor];
            double t = segment <= 0 ? 0 : (target - cumulative[cursor]) / segment;

            outX[i] = in.x()[a] + (in.x()[b] - in.x()[a]) * t;
            outY[i] = in.y()[a] + (in.y()[b] - in.y()[a]) * t;
            outZ[i] = in.z()[a] + (in.z()[b] - in.z()[a]) * t;
        }
        return new RawPath(outX, outY, outZ);
    }

    /**
     * Circular moving average. Position telemetry is noisy at ~4 Hz, and unsmoothed elevation makes
     * the rendered track look corrugated; {@code window} must be odd.
     */
    static RawPath smoothClosed(RawPath in, int window) {
        int n = in.size();
        if (n < window || window < 3) return in;
        int half = window / 2;

        double[] outX = new double[n];
        double[] outY = new double[n];
        double[] outZ = new double[n];

        for (int i = 0; i < n; i++) {
            double sx = 0, sy = 0, sz = 0;
            for (int k = -half; k <= half; k++) {
                int idx = Math.floorMod(i + k, n);
                sx += in.x()[idx];
                sy += in.y()[idx];
                sz += in.z()[idx];
            }
            outX[i] = sx / window;
            outY[i] = sy / window;
            outZ[i] = sz / window;
        }
        return new RawPath(outX, outY, outZ);
    }

    /**
     * Centres the plan view and scales it into {@code [-1, 1]} using a single factor for both axes,
     * so Monaco still reads as narrow and Spa as long. Elevation stays in metres, rebased to zero at
     * the lowest point of the lap.
     */
    static NormalisedPath normalise(RawPath in) {
        int n = in.size();
        double minX = Double.MAX_VALUE, maxX = -Double.MAX_VALUE;
        double minZ = Double.MAX_VALUE, maxZ = -Double.MAX_VALUE;
        double minY = Double.MAX_VALUE, maxY = -Double.MAX_VALUE;

        for (int i = 0; i < n; i++) {
            minX = Math.min(minX, in.x()[i]);
            maxX = Math.max(maxX, in.x()[i]);
            minZ = Math.min(minZ, in.z()[i]);
            maxZ = Math.max(maxZ, in.z()[i]);
            minY = Math.min(minY, in.y()[i]);
            maxY = Math.max(maxY, in.y()[i]);
        }

        double spanX = maxX - minX;
        double spanZ = maxZ - minZ;
        double centreX = (minX + maxX) / 2;
        double centreZ = (minZ + maxZ) / 2;
        double half = Math.max(spanX, spanZ) / 2;
        if (half <= 0) half = 1;

        List<List<Double>> points = new ArrayList<>(n);
        double length = 0;
        for (int i = 0; i < n; i++) {
            points.add(List.of(
                    round((in.x()[i] - centreX) / half, 5),
                    round(in.y()[i] - minY, 2),
                    round((in.z()[i] - centreZ) / half, 5)
            ));
            int next = (i + 1) % n;
            length += Math.hypot(in.x()[next] - in.x()[i], in.z()[next] - in.z()[i]);
        }

        return new NormalisedPath(points, spanX, spanZ, minY, maxY, length / 1000d);
    }

    private static RawPath toArrays(List<Double> xs, List<Double> ys, List<Double> zs) {
        int n = xs.size();
        double[] x = new double[n];
        double[] y = new double[n];
        double[] z = new double[n];
        for (int i = 0; i < n; i++) {
            x[i] = xs.get(i);
            y[i] = ys.get(i);
            z[i] = zs.get(i);
        }
        return new RawPath(x, y, z);
    }

    private static double round(double value, int decimals) {
        double factor = Math.pow(10, decimals);
        return Math.round(value * factor) / factor;
    }
}
