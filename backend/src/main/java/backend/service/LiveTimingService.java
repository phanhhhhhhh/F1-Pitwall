package backend.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * Aggregates live timing data per driver from the OpenF1 API.
 * Called by the Live Timing screen frontend — one request returns
 * everything needed to render a full timing tower.
 */
@Slf4j
@Service
public class LiveTimingService {

    private static final String OPENF1_BASE = "https://api.openf1.org/v1";

    private final RestTemplate restTemplate = createRestTemplate();

    private static RestTemplate createRestTemplate() {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(15000);
        return new RestTemplate(factory);
    }

    /**
     * Returns a per-driver live timing snapshot for a session.
     * Fetches positions, intervals, laps, stints, and driver info
     * in parallel from OpenF1, then merges by driver_number.
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getLiveTiming(int sessionKey) {
        // ── Staggered fetch (respects OpenF1 3 req/s rate limit) ────────
        CompletableFuture<List<Map<String, Object>>> positionsF = fetchList(
                OPENF1_BASE + "/position?session_key=" + sessionKey);
        sleepMs(400);
        CompletableFuture<List<Map<String, Object>>> intervalsF = fetchList(
                OPENF1_BASE + "/intervals?session_key=" + sessionKey);
        sleepMs(400);
        CompletableFuture<List<Map<String, Object>>> lapsF = fetchList(
                OPENF1_BASE + "/laps?session_key=" + sessionKey + "&is_pit_out_lap=false");
        sleepMs(400);
        CompletableFuture<List<Map<String, Object>>> stintsF = fetchList(
                OPENF1_BASE + "/stints?session_key=" + sessionKey);
        sleepMs(400);
        CompletableFuture<List<Map<String, Object>>> driversF = fetchList(
                OPENF1_BASE + "/drivers?session_key=" + sessionKey);

        List<Map<String, Object>> positions;
        List<Map<String, Object>> intervals;
        List<Map<String, Object>> laps;
        List<Map<String, Object>> stints;
        List<Map<String, Object>> drivers;

        try {
            CompletableFuture.allOf(positionsF, intervalsF, lapsF, stintsF, driversF)
                    .get(20, TimeUnit.SECONDS);
            positions = positionsF.get();
            intervals = intervalsF.get();
            laps      = lapsF.get();
            stints    = stintsF.get();
            drivers   = driversF.get();
        } catch (Exception e) {
            log.warn("[LiveTiming] Parallel fetch failed for session {}: {}", sessionKey, e.getMessage());
            return List.of();
        }

        // ── Index driver info by driver_number ─────────────────────────
        Map<Integer, Map<String, Object>> driverMap = new HashMap<>();
        for (Map<String, Object> d : drivers) {
            Integer num = toInt(d.get("driver_number"));
            if (num != null) driverMap.put(num, d);
        }

        // ── Latest position per driver ────────────────────────────────
        Map<Integer, Integer> positionMap = new HashMap<>();
        if (positions != null) {
            // Positions come sorted by date descending (newest first) in practice,
            // but let's take the last entry per driver for safety
            for (Map<String, Object> p : positions) {
                Integer dn = toInt(p.get("driver_number"));
                Integer pos = toInt(p.get("position"));
                if (dn != null && pos != null && pos > 0) {
                    positionMap.putIfAbsent(dn, pos); // first = newest
                }
            }
        }

        // ── Latest interval per driver ────────────────────────────────
        Map<Integer, Double> gapLeaderMap = new HashMap<>();
        Map<Integer, Double> intervalMap = new HashMap<>();
        if (intervals != null) {
            for (Map<String, Object> iv : intervals) {
                Integer dn = toInt(iv.get("driver_number"));
                if (dn == null || gapLeaderMap.containsKey(dn)) continue;
                Object gtl = iv.get("gap_to_leader");
                Object intv = iv.get("interval");
                if (gtl instanceof Number) gapLeaderMap.put(dn, ((Number) gtl).doubleValue());
                if (intv instanceof Number) intervalMap.put(dn, ((Number) intv).doubleValue());
            }
        }

        // ── Latest lap per driver (including sector times) ────────────
        Map<Integer, Double> lastLapMap = new HashMap<>();
        Map<Integer, Double> sector1Map = new HashMap<>();
        Map<Integer, Double> sector2Map = new HashMap<>();
        Map<Integer, Double> sector3Map = new HashMap<>();
        Map<Integer, Integer> lapsCompletedMap = new HashMap<>();

        if (laps != null) {
            // Group by driver, find max lap_number
            Map<Integer, List<Map<String, Object>>> byDriver = new HashMap<>();
            for (Map<String, Object> lap : laps) {
                Integer dn = toInt(lap.get("driver_number"));
                if (dn == null) continue;
                byDriver.computeIfAbsent(dn, k -> new ArrayList<>()).add(lap);
            }
            for (var entry : byDriver.entrySet()) {
                int dn = entry.getKey();
                var driverLaps = entry.getValue();
                // Find lap with highest lap_number
                driverLaps.sort(Comparator.comparingInt(
                        l -> toInt(l.get("lap_number")) != null ? toInt(l.get("lap_number")) : 0));
                var lastLap = driverLaps.get(driverLaps.size() - 1);

                Integer lapNum = toInt(lastLap.get("lap_number"));
                if (lapNum != null) lapsCompletedMap.put(dn, lapNum);

                Object dur = lastLap.get("lap_duration");
                if (dur instanceof Number && ((Number) dur).doubleValue() > 0) {
                    lastLapMap.put(dn, ((Number) dur).doubleValue());
                }

                // Sector times — try both naming conventions
                sector1Map.put(dn, sectorTime(lastLap, "duration_sector_1", "sector_1_time"));
                sector2Map.put(dn, sectorTime(lastLap, "duration_sector_2", "sector_2_time"));
                sector3Map.put(dn, sectorTime(lastLap, "duration_sector_3", "sector_3_time"));
            }
        }

        // ── Latest stint per driver (tyre info) ───────────────────────
        Map<Integer, String> compoundMap = new HashMap<>();
        Map<Integer, Integer> tyreAgeMap = new HashMap<>();
        Map<Integer, Integer> stintCountMap = new HashMap<>();

        if (stints != null) {
            Map<Integer, List<Map<String, Object>>> stintsByDriver = new HashMap<>();
            for (Map<String, Object> st : stints) {
                Integer dn = toInt(st.get("driver_number"));
                if (dn == null) continue;
                stintsByDriver.computeIfAbsent(dn, k -> new ArrayList<>()).add(st);
            }
            for (var entry : stintsByDriver.entrySet()) {
                int dn = entry.getKey();
                var driverStints = entry.getValue();
                // Sort by stint_number descending
                driverStints.sort(Comparator.comparingInt(
                        s -> -1 * (toInt(s.get("stint_number")) != null ? toInt(s.get("stint_number")) : 0)));
                var latestStint = driverStints.get(0);

                String compound = String.valueOf(latestStint.getOrDefault("compound", ""));
                if (!compound.isBlank()) compoundMap.put(dn, compound.toUpperCase());

                Object age = latestStint.get("tyre_age_at_start");
                if (age instanceof Number) tyreAgeMap.put(dn, ((Number) age).intValue());

                stintCountMap.put(dn, driverStints.size());
            }
        }

        // ── Build merged result ───────────────────────────────────────
        List<Map<String, Object>> result = new ArrayList<>();
        for (var entry : driverMap.entrySet()) {
            int dn = entry.getKey();
            Map<String, Object> driver = entry.getValue();

            Integer pos = positionMap.getOrDefault(dn, 99);
            String teamColour = String.valueOf(driver.getOrDefault("team_colour", "FFFFFF"));
            if (!teamColour.startsWith("#")) teamColour = "#" + teamColour;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("position", pos);
            row.put("driverNumber", dn);
            row.put("driverName", driver.getOrDefault("full_name", "Driver #" + dn));
            row.put("firstName", driver.getOrDefault("first_name", ""));
            row.put("lastName", driver.getOrDefault("last_name", ""));
            row.put("nameAcronym", driver.getOrDefault("name_acronym", ""));
            row.put("teamName", driver.getOrDefault("team_name", ""));
            row.put("teamColor", teamColour);
            row.put("headshotUrl", driver.getOrDefault("headshot_url", ""));

            // Gaps (null for leader)
            row.put("gapToLeader", gapLeaderMap.containsKey(dn) ? gapLeaderMap.get(dn) : null);
            row.put("interval", intervalMap.containsKey(dn) ? intervalMap.get(dn) : null);

            // Lap times
            row.put("lastLapTime", lastLapMap.getOrDefault(dn, null));
            row.put("sector1", sector1Map.getOrDefault(dn, null));
            row.put("sector2", sector2Map.getOrDefault(dn, null));
            row.put("sector3", sector3Map.getOrDefault(dn, null));

            // Tyre
            row.put("tyreCompound", compoundMap.getOrDefault(dn, ""));
            row.put("tyreAge", tyreAgeMap.getOrDefault(dn, 0));

            // Counts
            row.put("pitStopCount", Math.max(0, stintCountMap.getOrDefault(dn, 1) - 1));
            row.put("lapsCompleted", lapsCompletedMap.getOrDefault(dn, 0));

            result.add(row);
        }

        // Sort by position
        result.sort(Comparator.comparingInt(r -> (int) r.getOrDefault("position", 99)));
        return result;
    }

    // ── helpers ──────────────────────────────────────────────────────

    private CompletableFuture<List<Map<String, Object>>> fetchList(String url) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> res = restTemplate.getForObject(url, List.class);
                return res != null ? res : List.of();
            } catch (Exception e) {
                log.debug("[LiveTiming] Fetch failed for {}: {}", url, e.getMessage());
                return List.of();
            }
        });
    }

    private Double sectorTime(Map<String, Object> lap, String... keys) {
        for (String key : keys) {
            Object val = lap.get(key);
            if (val instanceof Number n && n.doubleValue() > 0) return n.doubleValue();
        }
        return null;
    }

    private static void sleepMs(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }

    private static Integer toInt(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.intValue();
        try { return Integer.parseInt(o.toString().trim()); } catch (Exception e) { return null; }
    }
}
