package backend.service;

import backend.model.Race;
import backend.repository.RaceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class OpenF1SessionService {

    private static final String OPENF1_BASE = "https://api.openf1.org/v1";

    private static final Map<String, String> COUNTRY_NAME_MAP = Map.ofEntries(
        Map.entry("UAE", "United Arab Emirates"),
        Map.entry("USA", "United States")
    );

    // Past session data never changes — cache indefinitely
    private final Map<Long, List<Map<String, Object>>> sessionResultsCache = new ConcurrentHashMap<>();
    private final Map<Long, List<Map<String, Object>>> sessionListCache = new ConcurrentHashMap<>();

    private final RaceRepository raceRepository;

    private final RestTemplate restTemplate = createRestTemplate();

    private static RestTemplate createRestTemplate() {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(6000);
        factory.setReadTimeout(20000);
        return new RestTemplate(factory);
    }

    // ─── Sessions for a race weekend ──────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getSessionsForRace(Long raceId) {
        if (sessionListCache.containsKey(raceId)) {
            return sessionListCache.get(raceId);
        }

        Race race = raceRepository.findById(raceId)
            .orElseThrow(() -> new RuntimeException("Race not found: " + raceId));

        String country = race.getCircuit() != null ? race.getCircuit().getCountry() : "";
        String openf1Country = COUNTRY_NAME_MAP.getOrDefault(country, country);
        int year = race.getDate().getYear();

        String meetingUrl = OPENF1_BASE + "/meetings?year=" + year
            + "&country_name=" + openf1Country.replace(" ", "%20");

        List<Map<String, Object>> meetings;
        try {
            meetings = restTemplate.getForObject(meetingUrl, List.class);
        } catch (Exception e) {
            log.warn("[Sessions] Failed to fetch meetings for {}: {}", openf1Country, e.getMessage());
            return List.of();
        }

        if (meetings == null || meetings.isEmpty()) return List.of();

        LocalDate raceDate = race.getDate();
        Integer meetingKey = meetings.stream()
            .filter(m -> {
                String dateStr = String.valueOf(m.getOrDefault("date_start", ""));
                if (dateStr.isBlank()) return false;
                try {
                    LocalDate meetingStart = LocalDate.parse(dateStr.substring(0, 10));
                    return !meetingStart.isBefore(raceDate.minusDays(6))
                        && !meetingStart.isAfter(raceDate.plusDays(1));
                } catch (Exception ex) { return false; }
            })
            .map(m -> {
                Object mk = m.get("meeting_key");
                return mk instanceof Number ? ((Number) mk).intValue() : null;
            })
            .filter(Objects::nonNull)
            .findFirst()
            .orElse(null);

        if (meetingKey == null) {
            log.warn("[Sessions] No meeting found for {} {} (race date {})", openf1Country, year, raceDate);
            return List.of();
        }

        String sessionUrl = OPENF1_BASE + "/sessions?meeting_key=" + meetingKey;
        List<Map<String, Object>> sessions;
        try {
            sessions = restTemplate.getForObject(sessionUrl, List.class);
        } catch (Exception e) {
            log.warn("[Sessions] Failed to fetch sessions for meeting {}: {}", meetingKey, e.getMessage());
            return List.of();
        }

        if (sessions == null) return List.of();

        List<String> SESSION_ORDER = List.of(
            "Practice 1", "Practice 2", "Practice 3",
            "Sprint Qualifying", "Sprint", "Qualifying", "Race"
        );

        List<Map<String, Object>> result = sessions.stream()
            .filter(s -> SESSION_ORDER.contains(String.valueOf(s.getOrDefault("session_name", ""))))
            .sorted(Comparator.comparing(s -> String.valueOf(s.getOrDefault("date_start", ""))))
            .map(s -> {
                Map<String, Object> out = new LinkedHashMap<>();
                out.put("sessionKey", s.get("session_key"));
                out.put("name", s.get("session_name"));
                out.put("type", s.get("session_type"));
                out.put("dateStart", s.get("date_start"));
                out.put("dateEnd", s.get("date_end"));
                return out;
            })
            .collect(Collectors.toList());

        sessionListCache.put(raceId, result);
        return result;
    }

    // ─── Practice session results (fastest lap per driver) ────────────────────

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getSessionResults(Long sessionKey) {
        if (sessionResultsCache.containsKey(sessionKey)) {
            log.debug("[Sessions] Cache hit for session {}", sessionKey);
            return sessionResultsCache.get(sessionKey);
        }

        // Fetch drivers and laps in parallel
        String driversUrl = OPENF1_BASE + "/drivers?session_key=" + sessionKey;
        String lapsUrl    = OPENF1_BASE + "/laps?session_key=" + sessionKey + "&is_pit_out_lap=false";

        CompletableFuture<List<Map<String, Object>>> driversFuture = CompletableFuture.supplyAsync(() -> {
            try {
                List<Map<String, Object>> res = restTemplate.getForObject(driversUrl, List.class);
                return res != null ? res : List.of();
            } catch (Exception e) {
                log.warn("[Sessions] Failed to fetch drivers for session {}: {}", sessionKey, e.getMessage());
                return List.of();
            }
        });

        CompletableFuture<List<Map<String, Object>>> lapsFuture = CompletableFuture.supplyAsync(() -> {
            try {
                List<Map<String, Object>> res = restTemplate.getForObject(lapsUrl, List.class);
                return res != null ? res : List.of();
            } catch (Exception e) {
                log.warn("[Sessions] Failed to fetch laps for session {}: {}", sessionKey, e.getMessage());
                return List.of();
            }
        });

        List<Map<String, Object>> drivers;
        List<Map<String, Object>> laps;
        try {
            CompletableFuture.allOf(driversFuture, lapsFuture).get(25, TimeUnit.SECONDS);
            drivers = driversFuture.get();
            laps    = lapsFuture.get();
        } catch (Exception e) {
            log.warn("[Sessions] Parallel fetch failed for session {}: {}", sessionKey, e.getMessage());
            return List.of();
        }

        Map<Integer, Map<String, Object>> driverMap = new HashMap<>();
        for (Map<String, Object> d : drivers) {
            Object num = d.get("driver_number");
            if (num instanceof Number) driverMap.put(((Number) num).intValue(), d);
        }

        Map<Integer, List<Double>> lapsByDriver = new HashMap<>();
        for (Map<String, Object> lap : laps) {
            Object durObj = lap.get("lap_duration");
            Object numObj = lap.get("driver_number");
            if (durObj == null || numObj == null) continue;
            double dur = ((Number) durObj).doubleValue();
            if (dur <= 0 || dur > 600) continue;
            int num = ((Number) numObj).intValue();
            lapsByDriver.computeIfAbsent(num, k -> new ArrayList<>()).add(dur);
        }

        List<Map<String, Object>> results = new ArrayList<>();
        for (Map.Entry<Integer, List<Double>> entry : lapsByDriver.entrySet()) {
            int driverNum = entry.getKey();
            List<Double> driverLaps = entry.getValue();

            double fastest = driverLaps.stream().mapToDouble(Double::doubleValue).min().orElse(0);
            double avg     = driverLaps.stream().mapToDouble(Double::doubleValue).average().orElse(0);

            Map<String, Object> driverInfo = driverMap.getOrDefault(driverNum, Map.of());

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("driverNumber", driverNum);
            row.put("driverName", driverInfo.getOrDefault("full_name", "Driver #" + driverNum));
            row.put("teamName", driverInfo.getOrDefault("team_name", ""));
            row.put("teamColor", driverInfo.getOrDefault("team_colour", "666666"));
            row.put("nameAcronym", driverInfo.getOrDefault("name_acronym", ""));
            row.put("fastestLap", fastest);
            row.put("avgLap", Math.round(avg * 1000.0) / 1000.0);
            row.put("lapsCompleted", driverLaps.size());
            results.add(row);
        }

        results.sort(Comparator.comparingDouble(r -> ((Number) r.get("fastestLap")).doubleValue()));
        for (int i = 0; i < results.size(); i++) results.get(i).put("position", i + 1);

        sessionResultsCache.put(sessionKey, results);
        return results;
    }

    public void clearCache() {
        sessionResultsCache.clear();
        sessionListCache.clear();
        log.info("[Sessions] Cache cleared");
    }
}
