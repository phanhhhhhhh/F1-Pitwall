package backend.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Turns one real lap of car telemetry into the analytics the track map draws.
 *
 * <p>The racing line and the telemetry come from the same driver on the same lap, so every figure
 * here is a reading of one real lap rather than a model. Two limits are worth stating because the
 * client shows these numbers to users:
 *
 * <ul>
 *   <li>Position telemetry arrives at roughly 4 Hz and the stored line is resampled to a fixed
 *       point budget, so at racing speed consecutive points sit tens of metres apart. Curvature —
 *       and therefore lateral G — is averaged over that spacing and understates the tightest
 *       corners.</li>
 *   <li>DRS is only recorded as open when the driver actually opened it. A lap run in clean air
 *       yields no zones at all, which is a true statement about that lap and not a gap to fill in
 *       with an assumption.</li>
 * </ul>
 */
final class LapTraceMath {

    private LapTraceMath() {}

    private static final double GRAVITY = 9.80665;
    /** Speeds are smoothed over this many points before corners are picked out of the trace. */
    private static final int SPEED_SMOOTHING = 5;
    /** Half-width of the window a point must be the slowest in to count as a corner candidate. */
    private static final int MINIMUM_WINDOW = 3;
    /** Half-width of the window the entry and exit peaks either side of a corner are sought in. */
    private static final int PROMINENCE_WINDOW = 12;
    /** A corner has to cost at least this much speed; below it the trace is just noise on a straight. */
    private static final double MIN_PROMINENCE_KMH = 8;
    /** Beyond this the figure is telemetry noise rather than a load the car actually took. */
    private static final double MAX_G = 8;
    /** DRS runs shorter than this are dropped, and gaps this short are bridged. */
    private static final int MIN_DRS_RUN = 3;
    private static final int MAX_DRS_GAP = 2;

    /** One car-telemetry reading, as published by the source. */
    record Sample(float speedKmh, int gear, float throttlePct, float brakePct, int drs) {
        static final Sample EMPTY = new Sample(0, 0, 0, 0, 0);

        /**
         * OpenF1 reports 10, 12 and 14 when the rear wing is open. Lower codes mean closed or, at 8,
         * merely eligible to open — which is not the same as having opened it.
         */
        boolean drsOpen() {
            return drs >= 10;
        }
    }

    /** A corner as it was actually driven on the traced lap. */
    record Corner(
            int number,
            int pointIndex,
            float apexSpeedKmH,
            int gear,
            float entrySpeedKmH,
            float brakingM,
            float lateralG
    ) {}

    /** A stretch of the lap where the rear wing was open. Wraps past the finish line when {@code endIndex < startIndex}. */
    record DrsRange(int startIndex, int endIndex, float lengthM) {}

    /** Per-point telemetry with the loads derived from it. */
    record Loaded(
            float speedKmh,
            int gear,
            float throttlePct,
            float brakePct,
            boolean drsOpen,
            float lateralG,
            float longitudinalG
    ) {}

    /** Everything the client needs to draw one traced lap. */
    record Derived(List<Loaded> samples, List<Corner> corners, List<DrsRange> drsRanges) {
        static final Derived EMPTY = new Derived(List.of(), List.of(), List.of());
    }

    /**
     * Carries the telemetry from the raw position samples onto the cleaned racing line.
     *
     * <p>The line is cleaned, resampled and smoothed before it is stored, so its points no longer
     * correspond one-for-one with the samples they came from. Matching on position rather than on
     * index survives all of that: every stored point takes the reading from the raw sample the car
     * was physically closest to.
     */
    static List<Sample> alignToPath(TrackPathMath.RawPath target,
                                    TrackPathMath.RawPath source,
                                    List<Sample> sourceSamples) {
        if (sourceSamples == null || sourceSamples.isEmpty()) return List.of();

        int usable = Math.min(source.size(), sourceSamples.size());
        List<Sample> out = new ArrayList<>(target.size());

        for (int i = 0; i < target.size(); i++) {
            double tx = target.x()[i];
            double tz = target.z()[i];
            int best = 0;
            double bestDistance = Double.MAX_VALUE;

            for (int j = 0; j < usable; j++) {
                double dx = source.x()[j] - tx;
                double dz = source.z()[j] - tz;
                double distance = dx * dx + dz * dz;
                if (distance < bestDistance) {
                    bestDistance = distance;
                    best = j;
                }
            }
            out.add(sourceSamples.get(best));
        }
        return out;
    }

    /**
     * Derives per-point loads, corners and DRS zones from a stored lap.
     *
     * @param points        the stored racing line, normalised to {@code [-1, 1]}
     * @param samples       telemetry aligned to {@code points}, one reading per point
     * @param spanXM        real width of the plan view in metres, used to restore the real scale
     * @param spanZM        real depth of the plan view in metres
     * @param expectedTurns the circuit's published turn count, or {@code 0} when unknown; when
     *                      given, only the most significant that many corners are reported
     */
    static Derived derive(List<List<Double>> points, List<Sample> samples,
                          Float spanXM, Float spanZM, int expectedTurns) {
        int n = points == null ? 0 : points.size();
        if (points == null || n < 8 || samples == null || samples.size() != n) return Derived.EMPTY;

        // normalise() divided the centred plan view by half of its longer side, so multiplying by
        // that same half restores metres. Without the spans the shape is still usable but nothing
        // measured in metres can be recovered from it.
        double half = spanXM == null || spanZM == null
                ? 0
                : Math.max(spanXM, spanZM) / 2d;
        boolean scaled = half > 0;

        double[] xs = new double[n];
        double[] zs = new double[n];
        for (int i = 0; i < n; i++) {
            xs[i] = points.get(i).get(0) * half;
            zs[i] = points.get(i).get(2) * half;
        }

        // Arc length of the segment leaving each point, with the last one closing the loop.
        double[] step = new double[n];
        for (int i = 0; i < n; i++) {
            int next = (i + 1) % n;
            step[i] = Math.hypot(xs[next] - xs[i], zs[next] - zs[i]);
        }

        double[] speed = new double[n];
        for (int i = 0; i < n; i++) speed[i] = samples.get(i).speedKmh();
        double[] smoothed = smoothCircular(speed, SPEED_SMOOTHING);

        List<Loaded> loaded = new ArrayList<>(n);
        double[] lateral = new double[n];
        for (int i = 0; i < n; i++) {
            double latG = scaled ? lateralG(xs, zs, smoothed, i, n) : 0;
            double longG = scaled ? longitudinalG(smoothed, step, i, n) : 0;
            lateral[i] = latG;

            Sample s = samples.get(i);
            loaded.add(new Loaded(
                    s.speedKmh(), s.gear(), s.throttlePct(), s.brakePct(), s.drsOpen(),
                    (float) latG, (float) longG));
        }

        return new Derived(
                loaded,
                findCorners(smoothed, step, lateral, samples, expectedTurns, scaled),
                findDrsRanges(samples, step));
    }

    // ─── Loads ────────────────────────────────────────────────────────────────

    /**
     * Lateral load from the curvature of the racing line at this point.
     *
     * <p>Uses the Menger curvature of the three points centred here — the reciprocal of the radius
     * of the circle through them — which needs no derivatives and is stable on a noisy line. The
     * sign is kept: it says which way the corner turns, so a display can put left-handers and
     * right-handers on opposite sides.
     */
    private static double lateralG(double[] xs, double[] zs, double[] speed, int i, int n) {
        int prev = Math.floorMod(i - 1, n);
        int next = (i + 1) % n;

        double ax = xs[prev], az = zs[prev];
        double bx = xs[i], bz = zs[i];
        double cx = xs[next], cz = zs[next];

        double a = Math.hypot(bx - ax, bz - az);
        double b = Math.hypot(cx - bx, cz - bz);
        double c = Math.hypot(cx - ax, cz - az);
        if (a <= 0 || b <= 0 || c <= 0) return 0;

        double cross = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
        double curvature = 2 * cross / (a * b * c);

        double v = speed[i] / 3.6;
        return clampG(v * v * curvature / GRAVITY);
    }

    /**
     * Longitudinal load from how the speed changes along the lap.
     *
     * <p>Acceleration in time is recovered from the speed gradient in space, {@code a = v · dv/ds},
     * which avoids relying on sample timestamps that the resampling has already discarded.
     */
    private static double longitudinalG(double[] speed, double[] step, int i, int n) {
        int prev = Math.floorMod(i - 1, n);
        int next = (i + 1) % n;

        double distance = step[prev] + step[i];
        if (distance <= 0) return 0;

        double v = speed[i] / 3.6;
        double gradient = (speed[next] - speed[prev]) / 3.6 / distance;
        return clampG(v * gradient / GRAVITY);
    }

    private static double clampG(double g) {
        if (!Double.isFinite(g)) return 0;
        return Math.max(-MAX_G, Math.min(MAX_G, g));
    }

    // ─── Corners ──────────────────────────────────────────────────────────────

    /**
     * Picks corners out of the speed trace.
     *
     * <p>A corner is where the driver was slowest between two faster stretches, so candidates are
     * the local minima of the smoothed trace and their significance is how much speed they cost
     * relative to the peaks either side. Ranking by that and keeping the published turn count
     * matches what a circuit map calls a turn: the kinks a driver takes flat do not appear on one.
     */
    private static List<Corner> findCorners(double[] speed, double[] step, double[] lateral,
                                            List<Sample> samples, int expectedTurns, boolean scaled) {
        int n = speed.length;
        List<int[]> candidates = new ArrayList<>();   // [index, prominence in km/h × 1000]

        for (int i = 0; i < n; i++) {
            if (!isLocalMinimum(speed, i, n)) continue;

            double before = peakWithin(speed, i, -PROMINENCE_WINDOW, n);
            double after = peakWithin(speed, i, PROMINENCE_WINDOW, n);
            double prominence = Math.min(before, after) - speed[i];
            if (prominence < MIN_PROMINENCE_KMH) continue;

            candidates.add(new int[]{i, (int) Math.round(prominence * 1000)});
        }

        // Neighbouring minima inside one braking zone describe the same corner; the slowest wins.
        List<int[]> merged = mergeNeighbours(candidates, n);

        if (expectedTurns > 0 && merged.size() > expectedTurns) {
            merged = new ArrayList<>(merged);
            merged.sort(Comparator.comparingInt((int[] c) -> c[1]).reversed());
            merged = new ArrayList<>(merged.subList(0, expectedTurns));
        }
        merged.sort(Comparator.comparingInt(c -> c[0]));

        List<Corner> corners = new ArrayList<>(merged.size());
        for (int k = 0; k < merged.size(); k++) {
            int apex = merged.get(k)[0];
            int entry = entryPeak(speed, apex, n);

            double braking = 0;
            if (scaled) {
                for (int i = entry; i != apex; i = (i + 1) % n) braking += step[i];
            }

            corners.add(new Corner(
                    k + 1,
                    apex,
                    (float) speed[apex],
                    samples.get(apex).gear(),
                    (float) speed[entry],
                    (float) braking,
                    // Which way the corner turns is already clear from the map; what a corner
                    // readout wants is how hard the car was loaded through it.
                    (float) Math.abs(lateral[apex])));
        }
        return corners;
    }

    private static boolean isLocalMinimum(double[] speed, int i, int n) {
        for (int k = -MINIMUM_WINDOW; k <= MINIMUM_WINDOW; k++) {
            if (k == 0) continue;
            double other = speed[Math.floorMod(i + k, n)];
            // A plateau at the bottom of a hairpin would otherwise nominate every point on it, so
            // ties are resolved in favour of the earlier index.
            if (other < speed[i] || (other == speed[i] && Math.floorMod(i + k, n) < i)) return false;
        }
        return true;
    }

    /** Highest speed within {@code offset} points of {@code i}, searching forwards or backwards. */
    private static double peakWithin(double[] speed, int i, int offset, int n) {
        double peak = speed[i];
        int direction = Integer.signum(offset);
        for (int k = 1; k <= Math.abs(offset); k++) {
            peak = Math.max(peak, speed[Math.floorMod(i + k * direction, n)]);
        }
        return peak;
    }

    /**
     * Walks back from the apex to the braking point — the last place the car was still gaining
     * speed. The search stops at the prominence window so a corner at the end of a long straight
     * reports a braking distance rather than the length of the straight.
     */
    private static int entryPeak(double[] speed, int apex, int n) {
        int index = apex;
        for (int k = 1; k <= PROMINENCE_WINDOW; k++) {
            int candidate = Math.floorMod(apex - k, n);
            int nextAlong = Math.floorMod(candidate + 1, n);
            if (speed[candidate] <= speed[nextAlong]) break;
            index = candidate;
        }
        return index;
    }

    private static List<int[]> mergeNeighbours(List<int[]> candidates, int n) {
        List<int[]> merged = new ArrayList<>();
        for (int[] candidate : candidates) {
            if (!merged.isEmpty()) {
                int[] last = merged.get(merged.size() - 1);
                if (circularGap(last[0], candidate[0], n) <= MINIMUM_WINDOW + 1) {
                    if (candidate[1] > last[1]) merged.set(merged.size() - 1, candidate);
                    continue;
                }
            }
            merged.add(candidate);
        }
        return merged;
    }

    private static int circularGap(int a, int b, int n) {
        int diff = Math.abs(a - b);
        return Math.min(diff, n - diff);
    }

    // ─── DRS ──────────────────────────────────────────────────────────────────

    /** The stretches where the rear wing was open, as recorded on this lap. */
    private static List<DrsRange> findDrsRanges(List<Sample> samples, double[] step) {
        int n = samples.size();
        boolean[] open = new boolean[n];
        boolean any = false;
        for (int i = 0; i < n; i++) {
            open[i] = samples.get(i).drsOpen();
            any |= open[i];
        }
        if (!any) return List.of();

        // Telemetry drops the odd sample mid-zone; bridging short gaps keeps one zone as one zone.
        for (int i = 0; i < n; i++) {
            if (open[i] || !open[Math.floorMod(i - 1, n)]) continue;
            int gap = 0;
            while (gap <= MAX_DRS_GAP && !open[(i + gap) % n]) gap++;
            if (gap <= MAX_DRS_GAP) {
                for (int k = 0; k < gap; k++) open[(i + k) % n] = true;
            }
        }

        // Start from a closed point so a zone straddling the finish line is walked as one run.
        int origin = -1;
        for (int i = 0; i < n; i++) {
            if (!open[i]) { origin = i; break; }
        }
        if (origin < 0) return List.of();   // wing open for the whole lap: not a zone, a fault

        List<DrsRange> ranges = new ArrayList<>();
        int runStart = -1;
        double runLength = 0;
        for (int k = 0; k < n; k++) {
            int i = (origin + k) % n;
            if (open[i]) {
                if (runStart < 0) {
                    runStart = i;
                    runLength = 0;
                }
                runLength += step[i];
            } else if (runStart >= 0) {
                close(ranges, runStart, Math.floorMod(i - 1, n), runLength, n);
                runStart = -1;
            }
        }
        // The walk begins on a closed point, so a run still open at the end is the zone that
        // straddles the finish line — it has to be closed here or it would be dropped entirely.
        if (runStart >= 0) {
            close(ranges, runStart, Math.floorMod(origin - 1, n), runLength, n);
        }
        return ranges;
    }

    private static void close(List<DrsRange> ranges, int start, int end, double length, int n) {
        if (circularLength(start, end, n) >= MIN_DRS_RUN) {
            ranges.add(new DrsRange(start, end, (float) length));
        }
    }

    private static int circularLength(int start, int end, int n) {
        return Math.floorMod(end - start, n) + 1;
    }

    // ─── Shared ───────────────────────────────────────────────────────────────

    /** Circular moving average; {@code window} must be odd. */
    private static double[] smoothCircular(double[] values, int window) {
        int n = values.length;
        if (n < window || window < 3) return values.clone();
        int half = window / 2;

        double[] out = new double[n];
        for (int i = 0; i < n; i++) {
            double sum = 0;
            for (int k = -half; k <= half; k++) sum += values[Math.floorMod(i + k, n)];
            out[i] = sum / window;
        }
        return out;
    }
}
