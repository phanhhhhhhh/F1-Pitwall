package backend.service;

import backend.model.LivePosition;
import backend.repository.LivePositionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class OpenF1LiveService {

    private static final String OPENF1_BASE = "https://api.openf1.org/v1";

    private final RestTemplate restTemplate;
    private final LivePositionRepository livePositionRepository;
    private final CacheManager cacheManager;

    private static final List<String> MONITORED_SESSIONS = List.of(
            "Race", "Sprint", "Qualifying", "Sprint Qualifying",
            "Practice 3", "Practice 2", "Practice 1"
    );

    private static final Map<String, String> SESSION_EMOJI = Map.of(
            "Race", "🏁",
            "Sprint", "⚡",
            "Qualifying", "⏱️",
            "Sprint Qualifying", "⏱️",
            "Practice 1", "🔧",
            "Practice 2", "🔧",
            "Practice 3", "🔧"
    );

    // ─── Internal computation methods (not cached, called by scheduled task and force-fetch) ───

    @SuppressWarnings("unchecked")
    private Map<String, Object> computeLiveSessionStatus() {
        try {
            Map<String, Object> liveSession = getLiveSession();

            if (liveSession == null) {
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("isLive", false);
                return result;
            }

            Integer sessionKey = toInt(liveSession.get("session_key"));
            String sessionName = String.valueOf(liveSession.get("session_name"));
            String circuitName = String.valueOf(liveSession.get("circuit_short_name"));
            String countryName = String.valueOf(liveSession.get("country_name"));

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("isLive", true);
            result.put("sessionKey", sessionKey);
            result.put("sessionName", sessionName);
            result.put("sessionType", sessionName);
            result.put("circuitName", circuitName);
            result.put("countryName", countryName);
            return result;

        } catch (Exception e) {
            log.warn("⚠️ [OpenF1Live] Fetch failed: {}", e.getMessage());
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("isLive", false);
            return result;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getLiveSession() {
        try {
            int year = LocalDate.now().getYear();
            String url = OPENF1_BASE + "/sessions?year=" + year;
            List<Map<String, Object>> sessions = restTemplate.getForObject(url, List.class);
            if (sessions == null || sessions.isEmpty()) return null;

            String today = LocalDate.now().toString();
            String yesterday = LocalDate.now().minusDays(1).toString();

            List<Map<String, Object>> todaySessions = new ArrayList<>();
            for (Map<String, Object> session : sessions) {
                String dateStart = String.valueOf(session.getOrDefault("date_start", ""));
                String dateEnd = String.valueOf(session.getOrDefault("date_end", ""));
                if (dateStart.startsWith(today) || dateEnd.startsWith(today) ||
                        dateStart.startsWith(yesterday)) {
                    todaySessions.add(session);
                }
            }

            if (todaySessions.isEmpty()) return null;

            for (String sessionType : MONITORED_SESSIONS) {
                for (Map<String, Object> session : todaySessions) {
                    String name = String.valueOf(session.getOrDefault("session_name", ""));
                    if (name.equalsIgnoreCase(sessionType)) return session;
                }
            }

            return todaySessions.getFirst();

        } catch (Exception e) {
            log.debug("[OpenF1Live] No live session: {}", e.getMessage());
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> computeLiveTyreData(int sessionKey) {
        try {
            String stintUrl = OPENF1_BASE + "/stints?session_key=" + sessionKey;
            String posUrl = OPENF1_BASE + "/position?session_key=" + sessionKey;
            String driversUrl = OPENF1_BASE + "/drivers?session_key=" + sessionKey;

            List<Map<String, Object>> stints = restTemplate.getForObject(stintUrl, List.class);
            List<Map<String, Object>> positions = restTemplate.getForObject(posUrl, List.class);
            List<Map<String, Object>> drivers = restTemplate.getForObject(driversUrl, List.class);

            if (stints == null || drivers == null) return List.of();

            Map<Integer, Map<String, Object>> latestStint = new HashMap<>();
            for (Map<String, Object> stint : stints) {
                Integer driverNum = toInt(stint.get("driver_number"));
                if (driverNum == null) continue;
                latestStint.merge(driverNum, stint, (ex, ne) -> {
                    Integer exN = toInt(ex.get("stint_number"));
                    Integer neN = toInt(ne.get("stint_number"));
                    return (neN != null && exN != null && neN > exN) ? ne : ex;
                });
            }

            Map<Integer, Integer> latestPosition = new HashMap<>();
            if (positions != null) {
                for (Map<String, Object> pos : positions) {
                    Integer driverNum = toInt(pos.get("driver_number"));
                    Integer position = toInt(pos.get("position"));
                    if (driverNum != null && position != null) {
                        latestPosition.put(driverNum, position);
                    }
                }
            }

            Map<Integer, Map<String, Object>> driverInfo = new HashMap<>();
            for (Map<String, Object> d : drivers) {
                Integer driverNum = toInt(d.get("driver_number"));
                if (driverNum != null) driverInfo.put(driverNum, d);
            }

            List<Map<String, Object>> result = new ArrayList<>();
            for (Map.Entry<Integer, Map<String, Object>> entry : latestStint.entrySet()) {
                Integer driverNum = entry.getKey();
                Map<String, Object> stint = entry.getValue();
                Map<String, Object> driver = driverInfo.get(driverNum);
                if (driver == null) continue;

                Integer position = latestPosition.getOrDefault(driverNum, 99);
                String teamColour = String.valueOf(driver.getOrDefault("team_colour", "FFFFFF"));
                if (!teamColour.startsWith("#")) teamColour = "#" + teamColour;

                Map<String, Object> sessionStatus = getLiveSessionStatus();
                String sessionName = sessionStatus != null ? (String) sessionStatus.get("sessionName") : "";

                Map<String, Object> data = new LinkedHashMap<>();
                data.put("driverNumber", driverNum);
                data.put("driverName", driver.getOrDefault("full_name", "Driver #" + driverNum));
                data.put("firstName", driver.getOrDefault("first_name", ""));
                data.put("lastName", driver.getOrDefault("last_name", ""));
                data.put("teamName", driver.getOrDefault("team_name", "Unknown"));
                data.put("teamColor", teamColour);
                data.put("tyreCompound", stint.getOrDefault("compound", "UNKNOWN"));
                data.put("tyreAge", stint.getOrDefault("tyre_age_at_start", 0));
                data.put("lapStart", stint.getOrDefault("lap_start", 0));
                data.put("stintNumber", stint.getOrDefault("stint_number", 1));
                data.put("position", position);
                data.put("isLive", true);
                data.put("sessionName", sessionName);
                result.add(data);
            }

            result.sort(Comparator.comparingInt(m -> (Integer) m.getOrDefault("position", 99)));
            return result;

        } catch (Exception e) {
            if (e.getMessage() != null && e.getMessage().contains("No results found")) {
                log.debug("[OpenF1Live] No tyre data yet for session {} — session may not have started", sessionKey);
            } else {
                log.warn("[OpenF1Live] Error fetching tyre data: {}", e.getMessage());
            }
            return List.of();
        }
    }

    @SuppressWarnings("unchecked")
    private void fetchAndPersistPositions(int sessionKey) {
        try {
            String posUrl = OPENF1_BASE + "/position?session_key=" + sessionKey;
            List<Map<String, Object>> positions = restTemplate.getForObject(posUrl, List.class);
            if (positions == null || positions.isEmpty()) return;

            livePositionRepository.deleteBySessionKey(sessionKey);

            List<LivePosition> entities = new ArrayList<>();
            Instant now = Instant.now();
            for (Map<String, Object> pos : positions) {
                Integer driverNum = toInt(pos.get("driver_number"));
                Integer position = toInt(pos.get("position"));
                if (driverNum == null || position == null) continue;

                entities.add(LivePosition.builder()
                        .sessionKey(sessionKey)
                        .driverNumber(driverNum)
                        .position(position)
                        .timestamp(now)
                        .build());
            }

            if (!entities.isEmpty()) {
                livePositionRepository.saveAll(entities);
            }

        } catch (Exception e) {
            log.warn("[OpenF1Live] Error persisting positions: {}", e.getMessage());
        }
    }

    // ─── Cacheable facades (called from outside / controllers) ───

    @Cacheable("liveSessionStatus")
    public Map<String, Object> getLiveSessionStatus() {
        return computeLiveSessionStatus();
    }

    @Cacheable(value = "liveTyreData", key = "#sessionKey")
    public List<Map<String, Object>> getLiveTyreData(Integer sessionKey) {
        return computeLiveTyreData(sessionKey);
    }

    // ─── Scheduled refresh (30s) — calls internal methods directly, evicts cache ───

    @Scheduled(fixedRate = 30000)
    public void checkAndFetchLiveData() {
        try {
            Map<String, Object> session = computeLiveSessionStatus();

            if (session == null || !Boolean.TRUE.equals(session.get("isLive"))) {
                // Evict caches so status checks reflect session ended
                evictLiveCaches();
                return;
            }

            Integer sessionKey = toInt(session.get("sessionKey"));
            String sessionName = (String) session.get("sessionName");
            String countryName = (String) session.get("countryName");

            if (sessionKey != null) {
                computeLiveTyreData(sessionKey);
                fetchAndPersistPositions(sessionKey);
                log.info("🔴 [OpenF1Live] Live: {} {} — session: {}", countryName, sessionName, sessionKey);
            }

            // Evict caches so next isSessionLive()/getLiveData() calls
            // hit @Cacheable methods and cache fresh results
            evictLiveCaches();

        } catch (Exception e) {
            log.warn("⚠️ [OpenF1Live] Fetch failed: {}", e.getMessage());
        }
    }

    /**
     * Evicts live-data caches so the next read goes through the compute path.
     * Called by the scheduler after each refresh cycle to keep WebSocket data fresh.
     */
    private void evictLiveCaches() {
        var sessionCache = cacheManager.getCache("liveSessionStatus");
        var tyreCache = cacheManager.getCache("liveTyreData");
        if (sessionCache != null) sessionCache.clear();
        if (tyreCache != null) tyreCache.clear();
    }

    // ─── Getters (delegate to @Cacheable facades) ───

    public boolean isSessionLive() {
        Map<String, Object> status = getLiveSessionStatus();
        return status != null && Boolean.TRUE.equals(status.get("isLive"));
    }

    public Integer getSessionKey() {
        Map<String, Object> status = getLiveSessionStatus();
        return status != null ? toInt(status.get("sessionKey")) : null;
    }

    public String getSessionName() {
        Map<String, Object> status = getLiveSessionStatus();
        return status != null ? (String) status.get("sessionName") : "";
    }

    public String getSessionType() {
        Map<String, Object> status = getLiveSessionStatus();
        return status != null ? (String) status.get("sessionType") : "";
    }

    public String getCircuitName() {
        Map<String, Object> status = getLiveSessionStatus();
        return status != null ? (String) status.get("circuitName") : "";
    }

    public String getCountryName() {
        Map<String, Object> status = getLiveSessionStatus();
        return status != null ? (String) status.get("countryName") : "";
    }

    public String getSessionEmoji() {
        String type = getSessionType();
        return SESSION_EMOJI.getOrDefault(type != null ? type : "", "🏎️");
    }

    public List<Map<String, Object>> getLiveData() {
        Integer sessionKey = getSessionKey();
        if (sessionKey == null) return List.of();
        return getLiveTyreData(sessionKey);
    }

    // ─── Force fetch ───

    @CacheEvict(value = {"liveSessionStatus", "liveTyreData"}, allEntries = true)
    public Map<String, Object> forceFetch() {
        Map<String, Object> session = computeLiveSessionStatus();
        boolean isLive = session != null && Boolean.TRUE.equals(session.get("isLive"));
        Integer sessionKey = isLive ? toInt(session.get("sessionKey")) : null;
        List<Map<String, Object>> data = sessionKey != null ? computeLiveTyreData(sessionKey) : List.of();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("isLive", isLive);
        result.put("sessionKey", sessionKey);
        result.put("sessionName", isLive ? session.get("sessionName") : "");
        result.put("sessionType", isLive ? session.get("sessionType") : "");
        result.put("circuitName", isLive ? session.get("circuitName") : "");
        result.put("countryName", isLive ? session.get("countryName") : "");
        result.put("driversCount", data.size());
        result.put("data", data);
        return result;
    }

    private Integer toInt(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).intValue();
        try { return Integer.parseInt(o.toString()); } catch (Exception e) { return null; }
    }
}
