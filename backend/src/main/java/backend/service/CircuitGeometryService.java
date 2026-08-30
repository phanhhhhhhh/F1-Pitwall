package backend.service;

import backend.dto.CircuitGeometryResponse;
import backend.model.Circuit;
import backend.model.CircuitGeometry;
import backend.model.Race;
import backend.model.enums.GeometrySource;
import backend.repository.CircuitGeometryRepository;
import backend.repository.CircuitRepository;
import backend.repository.RaceRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Builds and caches the 3D racing line for each circuit.
 *
 * <p>Three sources are tried in order, best first:
 * <ol>
 *   <li>{@link GeometrySource#OPENF1} — real car position telemetry from the fastest lap of a race
 *       session. This is the only source that carries true elevation.</li>
 *   <li>{@link GeometrySource#GEOJSON} — open map data. Accurate plan view, flat elevation.</li>
 *   <li>{@link GeometrySource#SYNTHETIC} — generated from length and turn count so a brand new
 *       circuit still renders instead of leaving a hole in the page.</li>
 * </ol>
 *
 * <p>Results are persisted, so the external calls happen once per circuit rather than per request.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CircuitGeometryService {

    private static final String OPENF1_BASE = "https://api.openf1.org/v1";
    private static final String F1_LOCATIONS_URL =
            "https://raw.githubusercontent.com/bacinger/f1-circuits/master/f1-locations.json";
    private static final String F1_CIRCUIT_URL =
            "https://raw.githubusercontent.com/bacinger/f1-circuits/master/circuits/%s.geojson";

    /** Points kept after resampling — smooth enough for a spline, small enough to ship every request. */
    private static final int TARGET_POINTS = 240;
    /** OpenF1 has no position telemetry before 2023. */
    private static final int EARLIEST_OPENF1_YEAR = 2023;
    /** OpenF1 reports positions in decimetres. */
    private static final double OPENF1_UNITS_PER_METRE = 10d;

    private static final DateTimeFormatter OPENF1_FILTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    /**
     * OpenF1 enforces two limits — three requests a second and thirty a minute — and the per-minute
     * one binds first. Spacing requests at just over two seconds keeps a whole-calendar rebuild
     * inside it; geometry is built once per circuit and then served from the database, so the cost
     * is paid on the admin sync rather than on page loads.
     */
    private static final long OPENF1_MIN_INTERVAL_MS = 2_100;
    /** Season session lists barely change; re-fetching them mid-batch only burns the rate limit. */
    private static final java.time.Duration SESSION_CACHE_TTL = java.time.Duration.ofMinutes(30);

    private static final Map<String, String> COUNTRY_ALIASES = Map.of(
            "UAE", "United Arab Emirates",
            "USA", "United States",
            "UK", "United Kingdom"
    );

    /** Words that appear in almost every circuit name and so carry no matching signal. */
    private static final Set<String> STOPWORDS = Set.of(
            "circuit", "de", "international", "autodromo", "autodrome", "nazionale", "street",
            "racing", "course", "grand", "prix", "the", "of", "city", "park", "ring"
    );

    private final CircuitRepository circuitRepository;
    private final CircuitGeometryRepository geometryRepository;
    private final RaceRepository raceRepository;
    private final RestTemplate restTemplate;

    /**
     * The stored points are a plain nested array, so this serialiser needs none of the application's
     * Jackson configuration — and taking a private one keeps the service constructible in test
     * slices that do not start web auto-configuration.
     */
    private static final ObjectMapper JSON = new ObjectMapper();

    private final java.util.Map<Integer, CachedSessions> sessionCache = new java.util.concurrent.ConcurrentHashMap<>();
    /** Guards the OpenF1 request spacing across concurrent builds. */
    private final Object openf1Lock = new Object();
    private long lastOpenF1RequestAt = 0;

    /** Blocks just long enough to keep OpenF1 requests under the published rate limit. */
    private void throttleOpenF1() {
        synchronized (openf1Lock) {
            long wait = lastOpenF1RequestAt + OPENF1_MIN_INTERVAL_MS - System.currentTimeMillis();
            if (wait > 0) {
                try {
                    Thread.sleep(wait);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
            lastOpenF1RequestAt = System.currentTimeMillis();
        }
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * Returns cached geometry, building and caching it on first request.
     *
     * <p>Deliberately not transactional: a first build spends several seconds inside throttled HTTP
     * calls to external sources, and holding a database transaction open across that would tie up a
     * pooled connection for the whole wait. The individual repository writes are each atomic, and
     * both of them are idempotent — a half-finished build is simply rebuilt on the next request.
     */
    public CircuitGeometryResponse get(Long circuitId) {
        Circuit circuit = circuitRepository.findById(circuitId)
                .orElseThrow(() -> new RuntimeException("Circuit not found: " + circuitId));

        return geometryRepository.findByCircuitId(circuitId)
                .map(g -> toResponse(circuit, g))
                .orElseGet(() -> toResponse(circuit, build(circuit)));
    }

    /** Rebuilds geometry from the external sources, replacing whatever was cached. */
    public CircuitGeometryResponse sync(Long circuitId) {
        Circuit circuit = circuitRepository.findById(circuitId)
                .orElseThrow(() -> new RuntimeException("Circuit not found: " + circuitId));
        return toResponse(circuit, build(circuit));
    }

    /**
     * Rebuilds every circuit that has no geometry yet, or all of them when {@code force} is set.
     * Reports per-circuit outcomes rather than failing the batch on one bad circuit.
     */
    public Map<String, Object> syncAll(boolean force) {
        List<Circuit> circuits = circuitRepository.findAll();
        List<Map<String, Object>> details = new ArrayList<>();
        int built = 0;
        int skipped = 0;
        int failed = 0;

        for (Circuit circuit : circuits) {
            if (!force && geometryRepository.existsByCircuitId(circuit.getId())) {
                skipped++;
                continue;
            }
            try {
                CircuitGeometry geometry = build(circuit);
                built++;
                details.add(Map.of(
                        "circuit", circuit.getName(),
                        "source", geometry.getSource().name(),
                        "points", geometry.getPointCount(),
                        "elevationGainM", geometry.getElevationGainM() == null ? 0f : geometry.getElevationGainM(),
                        "lapTelemetry", geometry.getSamples() != null
                ));
            } catch (Exception e) {
                failed++;
                log.warn("[Geometry] {} failed: {}", circuit.getName(), e.getMessage());
                details.add(Map.of("circuit", circuit.getName(), "error", String.valueOf(e.getMessage())));
            }
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("total", circuits.size());
        summary.put("built", built);
        summary.put("skipped", skipped);
        summary.put("failed", failed);
        summary.put("details", details);
        return summary;
    }

    // ─── Build pipeline ───────────────────────────────────────────────────────

    /**
     * A racing line together with where it came from, and — for telemetry sources — what the car
     * was doing at each of its points. {@code samples} is aligned index-for-index with {@code path}
     * and is empty for sources that carry position only.
     */
    private record SourcedPath(
            TrackPathMath.RawPath path,
            GeometrySource source,
            Integer sessionKey,
            Integer driverNumber,
            Integer lapNumber,
            List<LapTraceMath.Sample> samples
    ) {}

    private CircuitGeometry build(Circuit circuit) {
        SourcedPath sourced = fromOpenF1(circuit)
                .or(() -> fromGeoJson(circuit))
                .orElseGet(() -> synthesise(circuit));

        // OpenF1 samples at ~4 Hz and occasionally clips a neighbouring car, so it needs the full
        // clean-up; map data is already an ordered poly-line and only needs resampling.
        boolean fromTelemetry = sourced.source() == GeometrySource.OPENF1;
        TrackPathMath.RawPath path = TrackPathMath.clean(sourced.path(), fromTelemetry ? 2.0 : 0.5);
        if (fromTelemetry) {
            path = TrackPathMath.dropOutliers(path, 120.0);
        }
        if (path.size() < 20) {
            throw new IllegalStateException("Not enough usable points for " + circuit.getName()
                    + " (source " + sourced.source() + ", " + path.size() + " points)");
        }
        path = TrackPathMath.resampleClosed(path, TARGET_POINTS);
        if (fromTelemetry) {
            path = TrackPathMath.smoothClosed(path, 5);
        }

        TrackPathMath.NormalisedPath normalised = TrackPathMath.normalise(path);
        float elevationGain = (float) (normalised.elevationMaxM() - normalised.elevationMinM());

        // The clean-up reorders and drops points, so the telemetry is carried across by position
        // against the untouched source path rather than by index.
        List<LapTraceMath.Sample> aligned =
                LapTraceMath.alignToPath(path, sourced.path(), sourced.samples());

        CircuitGeometry geometry = geometryRepository.findByCircuitId(circuit.getId())
                .orElseGet(CircuitGeometry::new);
        geometry.setCircuit(circuit);
        geometry.setSource(sourced.source());
        geometry.setPoints(writeJson(normalised.points()));
        geometry.setPointCount(normalised.points().size());
        geometry.setSamples(aligned.isEmpty() ? null : writeSamples(aligned));
        geometry.setSpanXM((float) normalised.spanXM());
        geometry.setSpanZM((float) normalised.spanZM());
        geometry.setElevationMinM((float) normalised.elevationMinM());
        geometry.setElevationMaxM((float) normalised.elevationMaxM());
        geometry.setElevationGainM(elevationGain);
        geometry.setMeasuredLengthKm((float) normalised.lengthKm());
        geometry.setOpenf1SessionKey(sourced.sessionKey());
        geometry.setOpenf1DriverNumber(sourced.driverNumber());
        geometry.setOpenf1LapNumber(sourced.lapNumber());
        geometry.setFetchedAt(Instant.now());
        geometry = geometryRepository.save(geometry);

        // Only telemetry carries real elevation; map data would overwrite it with a flat zero.
        if (sourced.source() == GeometrySource.OPENF1) {
            circuit.setElevationGainM(elevationGain);
            circuitRepository.save(circuit);
        }

        log.info("[Geometry] {} built from {} — {} points, {}m elevation delta, lap telemetry {}",
                circuit.getName(), sourced.source(), geometry.getPointCount(),
                Math.round(elevationGain), aligned.isEmpty() ? "unavailable" : "captured");
        return geometry;
    }

    // ─── Source 1: OpenF1 position telemetry ──────────────────────────────────

    /**
     * Traces the racing line from the most recent race at this circuit that actually has position
     * data. The newest season is tried first, but a race can be on the calendar with no telemetry
     * published yet — a round that has not happened, or one still being ingested — so each candidate
     * is attempted in turn rather than treating the first as the only chance.
     */
    private Optional<SourcedPath> fromOpenF1(Circuit circuit) {
        List<Map<String, Object>> sessions = findOpenF1RaceSessions(circuit);
        if (sessions.isEmpty()) {
            log.debug("[Geometry] {} — no matching OpenF1 race session", circuit.getName());
            return Optional.empty();
        }

        for (Map<String, Object> session : sessions) {
            Optional<SourcedPath> traced = traceLap(circuit, session);
            if (traced.isPresent()) return traced;
        }
        log.warn("[Geometry] {} — none of the {} candidate sessions had usable position data",
                circuit.getName(), sessions.size());
        return Optional.empty();
    }

    @SuppressWarnings("unchecked")
    private Optional<SourcedPath> traceLap(Circuit circuit, Map<String, Object> session) {
        int sessionKey = intOf(session.get("session_key"));
        try {
            Optional<Map<String, Object>> lap = findCleanestLap(sessionKey);
            if (lap.isEmpty()) {
                log.debug("[Geometry] {} — session {} has no usable lap", circuit.getName(), sessionKey);
                return Optional.empty();
            }

            int driverNumber = intOf(lap.get().get("driver_number"));
            int lapNumber = intOf(lap.get().get("lap_number"));
            double lapDuration = doubleOf(lap.get().get("lap_duration"));
            OffsetDateTime start = OffsetDateTime.parse(String.valueOf(lap.get().get("date_start")));

            // A one second tail guarantees the sample crosses the line rather than stopping short of it.
            String from = start.withOffsetSameInstant(ZoneOffset.UTC).format(OPENF1_FILTER);
            String to = start.plusSeconds((long) Math.ceil(lapDuration) + 1)
                    .withOffsetSameInstant(ZoneOffset.UTC).format(OPENF1_FILTER);

            URI uri = URI.create(OPENF1_BASE + "/location"
                    + "?session_key=" + sessionKey
                    + "&driver_number=" + driverNumber
                    + "&date%3E" + from
                    + "&date%3C" + to);

            throttleOpenF1();
            List<Map<String, Object>> samples = restTemplate.getForObject(uri, List.class);
            if (samples == null || samples.size() < 40) {
                log.debug("[Geometry] {} — session {} returned only {} position samples",
                        circuit.getName(), sessionKey, samples == null ? 0 : samples.size());
                return Optional.empty();
            }

            samples.sort(Comparator.comparing(s -> String.valueOf(s.getOrDefault("date", ""))));

            int n = samples.size();
            double[] x = new double[n];
            double[] y = new double[n];
            double[] z = new double[n];
            long[] takenAt = new long[n];
            for (int i = 0; i < n; i++) {
                Map<String, Object> s = samples.get(i);
                // OpenF1 lays the track out in x/y and puts altitude in z; our renderer wants
                // y as "up", so the two are swapped here.
                x[i] = doubleOf(s.get("x")) / OPENF1_UNITS_PER_METRE;
                y[i] = doubleOf(s.get("z")) / OPENF1_UNITS_PER_METRE;
                z[i] = doubleOf(s.get("y")) / OPENF1_UNITS_PER_METRE;
                takenAt[i] = epochMillis(s.get("date"));
            }

            return Optional.of(new SourcedPath(
                    new TrackPathMath.RawPath(x, y, z),
                    GeometrySource.OPENF1, sessionKey, driverNumber, lapNumber,
                    fetchCarData(circuit, sessionKey, driverNumber, from, to, takenAt)));

        } catch (Exception e) {
            log.debug("[Geometry] {} — session {} unusable: {}",
                    circuit.getName(), sessionKey, e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Reads what the car was doing over the same lap the racing line was traced from.
     *
     * <p>Position and car telemetry are published as separate feeds sampled on their own clocks, so
     * each position sample takes the car reading closest to it in time. Missing telemetry is not
     * fatal — the geometry is still worth caching without it, and the client is told the analytics
     * are unavailable rather than being handed something invented.
     *
     * @param takenAt when each position sample was recorded, in epoch milliseconds
     * @return one reading per position sample, or empty when the feed had nothing usable
     */
    @SuppressWarnings("unchecked")
    private List<LapTraceMath.Sample> fetchCarData(Circuit circuit, int sessionKey, int driverNumber,
                                                   String from, String to, long[] takenAt) {
        try {
            URI uri = URI.create(OPENF1_BASE + "/car_data"
                    + "?session_key=" + sessionKey
                    + "&driver_number=" + driverNumber
                    + "&date%3E" + from
                    + "&date%3C" + to);

            throttleOpenF1();
            List<Map<String, Object>> readings = restTemplate.getForObject(uri, List.class);
            if (readings == null || readings.isEmpty()) {
                log.debug("[Geometry] {} — no car telemetry for session {}", circuit.getName(), sessionKey);
                return List.of();
            }

            readings.sort(Comparator.comparing(r -> String.valueOf(r.getOrDefault("date", ""))));

            int m = readings.size();
            long[] readingAt = new long[m];
            List<LapTraceMath.Sample> byTime = new ArrayList<>(m);
            for (int i = 0; i < m; i++) {
                Map<String, Object> r = readings.get(i);
                readingAt[i] = epochMillis(r.get("date"));
                byTime.add(new LapTraceMath.Sample(
                        (float) doubleOf(r.get("speed")),
                        intOf(r.get("n_gear")),
                        (float) doubleOf(r.get("throttle")),
                        (float) doubleOf(r.get("brake")),
                        intOf(r.get("drs"))));
            }

            List<LapTraceMath.Sample> aligned = new ArrayList<>(takenAt.length);
            for (long when : takenAt) {
                aligned.add(when <= 0 ? LapTraceMath.Sample.EMPTY : byTime.get(nearest(readingAt, when)));
            }
            return aligned;

        } catch (Exception e) {
            log.debug("[Geometry] {} — car telemetry unavailable for session {}: {}",
                    circuit.getName(), sessionKey, e.getMessage());
            return List.of();
        }
    }

    /** Index of the timestamp closest to {@code when} in an ascending array. */
    private static int nearest(long[] ascending, long when) {
        int found = Arrays.binarySearch(ascending, when);
        if (found >= 0) return found;

        int after = -found - 1;
        if (after == 0) return 0;
        if (after >= ascending.length) return ascending.length - 1;
        return when - ascending[after - 1] <= ascending[after] - when ? after - 1 : after;
    }

    /** Parses an ISO-8601 instant, returning {@code 0} for anything unreadable. */
    private static long epochMillis(Object date) {
        if (date == null) return 0;
        try {
            return OffsetDateTime.parse(String.valueOf(date)).toInstant().toEpochMilli();
        } catch (Exception e) {
            return 0;
        }
    }

    /**
     * Every race session held at this circuit, newest season first. Sessions are matched on country
     * plus name tokens, because several countries host more than one Grand Prix.
     */
    private List<Map<String, Object>> findOpenF1RaceSessions(Circuit circuit) {
        String country = normaliseCountry(circuit.getCountry());
        Set<String> ours = tokens(circuit.getName() + " " + nullSafe(circuit.getCity()));

        List<Map<String, Object>> matches = new ArrayList<>();
        for (int year : candidateYears(circuit)) {
            List<Map<String, Object>> inCountry = raceSessions(year).stream()
                    .filter(s -> country.equalsIgnoreCase(String.valueOf(s.getOrDefault("country_name", ""))))
                    .toList();
            if (inCountry.isEmpty()) continue;

            // A name match is required even when the country has exactly one race that season.
            // Being the only Spanish Grand Prix on the 2025 calendar does not make Barcelona the
            // right geometry for Madrid — a new venue must fall through to another source instead
            // of silently inheriting a neighbour's racing line.
            inCountry.stream()
                    .max(Comparator.comparingInt(s -> overlap(ours, tokens(
                            s.getOrDefault("circuit_short_name", "") + " " + s.getOrDefault("location", "")))))
                    .filter(best -> overlap(ours, tokens(best.getOrDefault("circuit_short_name", "")
                            + " " + best.getOrDefault("location", ""))) > 0)
                    .ifPresent(matches::add);
        }
        return matches;
    }

    /**
     * The race sessions of one season, cached per year.
     *
     * <p>Building geometry for the whole calendar would otherwise ask for the same season list once
     * per circuit per year — roughly a hundred identical calls against an API that allows three a
     * second.
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> raceSessions(int year) {
        CachedSessions cached = sessionCache.get(year);
        if (cached != null && !cached.isStale()) return cached.sessions();

        try {
            throttleOpenF1();
            List<Map<String, Object>> sessions = restTemplate.getForObject(
                    URI.create(OPENF1_BASE + "/sessions?year=" + year + "&session_name=Race"), List.class);
            List<Map<String, Object>> result = sessions == null ? List.of() : sessions;
            sessionCache.put(year, new CachedSessions(result, Instant.now()));
            return result;
        } catch (Exception e) {
            log.warn("[Geometry] Failed to list {} sessions: {}", year, e.getMessage());
            return List.of();
        }
    }

    private record CachedSessions(List<Map<String, Object>> sessions, Instant fetchedAt) {
        boolean isStale() {
            return fetchedAt.plus(SESSION_CACHE_TTL).isBefore(Instant.now());
        }
    }

    /**
     * Picks the fastest complete lap of the session. The fastest lap is the cleanest racing line
     * available: no pit entry, no traffic detour, and a driver using the full width of the track.
     */
    @SuppressWarnings("unchecked")
    private Optional<Map<String, Object>> findCleanestLap(int sessionKey) {
        List<Map<String, Object>> laps;
        try {
            throttleOpenF1();
            laps = restTemplate.getForObject(
                    URI.create(OPENF1_BASE + "/laps?session_key=" + sessionKey), List.class);
        } catch (Exception e) {
            // A session on the calendar with no laps published yet is expected, not an error.
            log.debug("[Geometry] No laps for session {}: {}", sessionKey, e.getMessage());
            return Optional.empty();
        }
        if (laps == null) return Optional.empty();

        return laps.stream()
                .filter(l -> l.get("lap_duration") != null && l.get("date_start") != null)
                .filter(l -> !Boolean.TRUE.equals(l.get("is_pit_out_lap")))
                // Anything outside this band is a safety-car lap or a timing glitch, not a flying lap.
                .filter(l -> {
                    double d = doubleOf(l.get("lap_duration"));
                    return d > 55 && d < 210;
                })
                .min(Comparator.comparingDouble(l -> doubleOf(l.get("lap_duration"))));
    }

    private List<Integer> candidateYears(Circuit circuit) {
        Set<Integer> years = new java.util.LinkedHashSet<>();
        raceRepository.findByCircuitIdWithCircuit(circuit.getId()).stream()
                .map(Race::getSeason)
                .filter(s -> s >= EARLIEST_OPENF1_YEAR)
                .sorted(Comparator.reverseOrder())
                .forEach(years::add);

        int thisYear = java.time.Year.now().getValue();
        for (int y = thisYear; y >= EARLIEST_OPENF1_YEAR; y--) years.add(y);
        return new ArrayList<>(years);
    }

    // ─── Source 2: open map data ──────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Optional<SourcedPath> fromGeoJson(Circuit circuit) {
        try {
            List<Map<String, Object>> locations = fetchJson(
                    URI.create(F1_LOCATIONS_URL), new TypeReference<List<Map<String, Object>>>() {});
            if (locations == null || locations.isEmpty()) return Optional.empty();

            Optional<Map<String, Object>> match = matchGeoJsonCircuit(circuit, locations);
            if (match.isEmpty()) {
                log.warn("[Geometry] {} not present in the map dataset", circuit.getName());
                return Optional.empty();
            }

            String id = String.valueOf(match.get().get("id"));
            Map<String, Object> collection = fetchJson(
                    URI.create(String.format(F1_CIRCUIT_URL, id)),
                    new TypeReference<Map<String, Object>>() {});
            if (collection == null) return Optional.empty();

            List<Map<String, Object>> features = (List<Map<String, Object>>) collection.get("features");
            if (features == null || features.isEmpty()) return Optional.empty();

            Map<String, Object> feature = features.get(0);
            Map<String, Object> geometry = (Map<String, Object>) feature.get("geometry");
            List<List<Number>> coordinates = (List<List<Number>>) geometry.get("coordinates");
            if (coordinates == null || coordinates.size() < 20) return Optional.empty();

            Map<String, Object> properties = (Map<String, Object>) feature.getOrDefault("properties", Map.of());
            double altitude = properties.get("altitude") == null ? 0 : doubleOf(properties.get("altitude"));

            double lat0 = doubleOf(match.get().get("lat"));
            double lon0 = doubleOf(match.get().get("lon"));

            int n = coordinates.size();
            double[] x = new double[n];
            double[] y = new double[n];
            double[] z = new double[n];
            // Equirectangular projection about the circuit centre. Over a few kilometres the
            // distortion is well under a metre, and it keeps the plan view in real metres.
            double metresPerDegLon = 111_320d * Math.cos(Math.toRadians(lat0));
            for (int i = 0; i < n; i++) {
                double lon = coordinates.get(i).get(0).doubleValue();
                double lat = coordinates.get(i).get(1).doubleValue();
                x[i] = (lon - lon0) * metresPerDegLon;
                y[i] = altitude; // dataset has a single altitude per circuit, so the lap reads flat
                z[i] = -(lat - lat0) * 110_540d; // negate so north renders away from the camera
            }

            applyGeoJsonMetadata(circuit, match.get(), properties);
            return Optional.of(new SourcedPath(
                    new TrackPathMath.RawPath(x, y, z), GeometrySource.GEOJSON, null, null, null, List.of()));

        } catch (Exception e) {
            log.warn("[Geometry] Map source failed for {}: {}", circuit.getName(), e.getMessage());
            return Optional.empty();
        }
    }

    private Optional<Map<String, Object>> matchGeoJsonCircuit(Circuit circuit, List<Map<String, Object>> locations) {
        Set<String> ours = tokens(circuit.getName() + " " + nullSafe(circuit.getCity()));

        Optional<Map<String, Object>> best = locations.stream()
                .max(Comparator.comparingInt(l -> overlap(ours,
                        tokens(l.getOrDefault("name", "") + " " + l.getOrDefault("location", "")))));

        if (best.isPresent()) {
            Set<String> theirs = tokens(best.get().getOrDefault("name", "")
                    + " " + best.get().getOrDefault("location", ""));
            if (overlap(ours, theirs) > 0) return best;
        }

        // Fall back to proximity when the names share nothing — circuits get renamed, coordinates do not.
        if (circuit.getLatitude() != null && circuit.getLongitude() != null) {
            return locations.stream()
                    .filter(l -> haversineKm(circuit.getLatitude(), circuit.getLongitude(),
                            doubleOf(l.get("lat")), doubleOf(l.get("lon"))) < 30)
                    .findFirst();
        }
        return Optional.empty();
    }

    /** Backfills circuit metadata the map dataset happens to carry, without overwriting what we have. */
    private void applyGeoJsonMetadata(Circuit circuit, Map<String, Object> location, Map<String, Object> properties) {
        boolean dirty = false;
        if (circuit.getLatitude() == null && location.get("lat") != null) {
            circuit.setLatitude(doubleOf(location.get("lat")));
            circuit.setLongitude(doubleOf(location.get("lon")));
            dirty = true;
        }
        if (circuit.getFirstGpYear() == null && properties.get("firstgp") != null) {
            circuit.setFirstGpYear(intOf(properties.get("firstgp")));
            dirty = true;
        }
        if (dirty) circuitRepository.save(circuit);
    }

    // ─── Source 3: synthetic fallback ─────────────────────────────────────────

    /**
     * Generates a plausible closed loop from length and turn count. Used for circuits with no
     * external data yet — a new venue on the calendar, say — so the viewer degrades to an
     * approximation instead of an empty panel. Callers must surface the source to the user.
     */
    private SourcedPath synthesise(Circuit circuit) {
        double lengthM = (circuit.getLengthKm() > 0 ? circuit.getLengthKm() : 5.0f) * 1000d;
        int turns = circuit.getTurnCount() > 0 ? circuit.getTurnCount() : 14;
        // Lobes stand in for the circuit's major direction changes; too many and it reads as a flower.
        int lobes = Math.max(3, Math.min(8, turns / 3));
        double radius = lengthM / (2 * Math.PI);

        int n = 360;
        double[] x = new double[n];
        double[] y = new double[n];
        double[] z = new double[n];
        for (int i = 0; i < n; i++) {
            double t = 2 * Math.PI * i / n;
            double r = radius * (1 + 0.28 * Math.sin(lobes * t) + 0.12 * Math.cos(2 * t));
            x[i] = r * Math.cos(t) * 1.35; // stretch so it reads as a circuit, not a circle
            y[i] = 0;
            z[i] = r * Math.sin(t);
        }
        log.info("[Geometry] {} has no external data — using a synthetic outline", circuit.getName());
        return new SourcedPath(new TrackPathMath.RawPath(x, y, z), GeometrySource.SYNTHETIC, null, null, null, List.of());
    }

    // ─── Mapping ──────────────────────────────────────────────────────────────

    private CircuitGeometryResponse toResponse(Circuit circuit, CircuitGeometry geometry) {
        List<List<Double>> points = readPoints(geometry.getPoints());

        // Derived on the way out rather than at build time: it costs a few hundred arithmetic
        // operations on an already-loaded lap, and keeping it out of the database means the
        // analytics can be improved without re-fetching every circuit from OpenF1.
        LapTraceMath.Derived derived = LapTraceMath.derive(
                points,
                readSamples(geometry.getSamples()),
                geometry.getSpanXM(),
                geometry.getSpanZM(),
                circuit.getTurnCount());

        return CircuitGeometryResponse.builder()
                .circuitId(circuit.getId())
                .circuitName(circuit.getName())
                .country(circuit.getCountry())
                .city(circuit.getCity())
                .source(geometry.getSource())
                .sourceLabel(sourceLabel(geometry))
                .hasRealElevation(geometry.getSource() == GeometrySource.OPENF1)
                .points(points)
                .pointCount(geometry.getPointCount())
                .hasLapTelemetry(!derived.samples().isEmpty())
                .samples(derived.samples().stream()
                        .map(s -> new CircuitGeometryResponse.TrackSample(
                                s.speedKmh(), s.gear(), s.throttlePct(), s.brakePct(),
                                s.drsOpen(), s.lateralG(), s.longitudinalG()))
                        .toList())
                .corners(derived.corners().stream()
                        .map(c -> new CircuitGeometryResponse.TrackCorner(
                                c.number(), c.pointIndex(), c.apexSpeedKmH(), c.gear(),
                                c.entrySpeedKmH(), c.brakingM(), c.lateralG()))
                        .toList())
                .drsRanges(derived.drsRanges().stream()
                        .map(r -> new CircuitGeometryResponse.DrsRange(
                                r.startIndex(), r.endIndex(), r.lengthM()))
                        .toList())
                .spanXM(geometry.getSpanXM())
                .spanZM(geometry.getSpanZM())
                .elevationMinM(geometry.getElevationMinM())
                .elevationMaxM(geometry.getElevationMaxM())
                .elevationGainM(geometry.getElevationGainM())
                .measuredLengthKm(geometry.getMeasuredLengthKm())
                .lengthKm(circuit.getLengthKm())
                .turnCount(circuit.getTurnCount())
                .drsZones(circuit.getDrsZones())
                .totalLaps(circuit.getTotalLaps())
                .firstGpYear(circuit.getFirstGpYear())
                .direction(circuit.getDirection() == null ? null : circuit.getDirection().name())
                .lapRecordSec(circuit.getLapRecordSec())
                .lapRecordHolder(circuit.getLapRecordHolder())
                .openf1SessionKey(geometry.getOpenf1SessionKey())
                .openf1DriverNumber(geometry.getOpenf1DriverNumber())
                .openf1LapNumber(geometry.getOpenf1LapNumber())
                .fetchedAt(geometry.getFetchedAt())
                .build();
    }

    private String sourceLabel(CircuitGeometry geometry) {
        return switch (geometry.getSource()) {
            case OPENF1 -> "Car position telemetry · lap " + geometry.getOpenf1LapNumber()
                    + " · car #" + geometry.getOpenf1DriverNumber();
            case GEOJSON -> "Open map data · plan view only";
            case SYNTHETIC -> "Generated outline · shape is indicative";
        };
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Fetches JSON from a host that does not label it as such.
     *
     * <p>The map dataset is served from raw file hosting as {@code text/plain}, which the REST
     * client's JSON converter refuses outright. Reading the body as text and parsing it here keeps
     * the content type out of it.
     */
    private <T> T fetchJson(URI uri, TypeReference<T> type) {
        String body = restTemplate.getForObject(uri, String.class);
        if (body == null || body.isBlank()) return null;
        try {
            return JSON.readValue(body, type);
        } catch (Exception e) {
            log.warn("[Geometry] Unparseable response from {}: {}", uri, e.getMessage());
            return null;
        }
    }

    private String writeJson(List<List<Double>> points) {
        try {
            return JSON.writeValueAsString(points);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialise track points", e);
        }
    }

    /**
     * Stores the lap telemetry as bare number quintuples rather than named objects. At one entry per
     * stored point this is the larger half of the row, and the field names would repeat every one.
     */
    private String writeSamples(List<LapTraceMath.Sample> samples) {
        List<List<Number>> rows = samples.stream()
                .map(s -> List.<Number>of(
                        round(s.speedKmh()), s.gear(),
                        round(s.throttlePct()), round(s.brakePct()), s.drs()))
                .toList();
        try {
            return JSON.writeValueAsString(rows);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialise lap telemetry", e);
        }
    }

    private List<LapTraceMath.Sample> readSamples(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            List<List<Number>> rows = JSON.readValue(json, new TypeReference<List<List<Number>>>() {});
            return rows.stream()
                    .filter(r -> r.size() >= 5)
                    .map(r -> new LapTraceMath.Sample(
                            r.get(0).floatValue(), r.get(1).intValue(),
                            r.get(2).floatValue(), r.get(3).floatValue(), r.get(4).intValue()))
                    .toList();
        } catch (Exception e) {
            log.warn("[Geometry] Corrupt stored lap telemetry: {}", e.getMessage());
            return List.of();
        }
    }

    /** One decimal is the precision the feed itself reports; more only inflates the stored row. */
    private static float round(float value) {
        return Math.round(value * 10f) / 10f;
    }

    private List<List<Double>> readPoints(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return JSON.readValue(json, new TypeReference<List<List<Double>>>() {});
        } catch (Exception e) {
            log.warn("[Geometry] Corrupt stored points: {}", e.getMessage());
            return List.of();
        }
    }

    private String normaliseCountry(String country) {
        if (country == null) return "";
        return COUNTRY_ALIASES.getOrDefault(country, country);
    }

    /** Significant words of a circuit name, used to match our records against an external feed. */
    static Set<String> tokens(Object text) {
        String cleaned = OpenF1SyncService.stripAccents(String.valueOf(text))
                .toLowerCase()
                .replaceAll("[^a-z0-9 ]", " ");
        Set<String> out = new HashSet<>();
        for (String token : cleaned.split("\\s+")) {
            if (token.length() > 2 && !STOPWORDS.contains(token)) out.add(token);
        }
        return out;
    }

    /** Number of significant words two circuit names share. */
    static int overlap(Set<String> a, Set<String> b) {
        int count = 0;
        for (String token : a) if (b.contains(token)) count++;
        return count;
    }

    private double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private static String nullSafe(String s) {
        return s == null ? "" : s;
    }

    private static int intOf(Object o) {
        return o instanceof Number n ? n.intValue() : 0;
    }

    private static double doubleOf(Object o) {
        return o instanceof Number n ? n.doubleValue() : 0d;
    }

    /** Exposed for tests: the source order the build pipeline walks. */
    static List<GeometrySource> sourcePriority() {
        return Arrays.asList(GeometrySource.OPENF1, GeometrySource.GEOJSON, GeometrySource.SYNTHETIC);
    }
}
