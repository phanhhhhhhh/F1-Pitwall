package backend.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.*;

@Slf4j
@Service
public class OpenF1LiveService {

    private static final String OPENF1_BASE = "https://api.openf1.org/v1";
    private final RestTemplate restTemplate = new RestTemplate();

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

    private List<Map<String, Object>> cachedLiveData = new ArrayList<>();
    private Integer cachedSessionKey = null;
    private String cachedSessionName = null;
    private String cachedSessionType = null;
    private String cachedCircuitName = null;
    private String cachedCountryName = null;
    private boolean isSessionLive = false;

    @Scheduled(fixedRate = 30000)
    public void checkAndFetchLiveData() {
        try {
            Map<String, Object> liveSession = getLiveSession();

            if (liveSession == null) {
                if (isSessionLive) {
                    log.info("🏁 [OpenF1Live] Session ended — switching back to simulator");
                    isSessionLive = false;
                    cachedSessionKey = null;
                    cachedSessionName = null;
                }
                return;
            }

            Integer sessionKey = toInt(liveSession.get("session_key"));
            String sessionName = String.valueOf(liveSession.get("session_name"));
            String circuitName = String.valueOf(liveSession.get("circuit_short_name"));
            String countryName = String.valueOf(liveSession.get("country_name"));

            isSessionLive = true;
            cachedSessionKey = sessionKey;
            cachedSessionName = sessionName;
            cachedSessionType = sessionName;
            cachedCircuitName = circuitName;
            cachedCountryName = countryName;

            fetchTyreData(sessionKey);
            log.info("🔴 [OpenF1Live] Live: {} {} — session: {}", countryName, sessionName, sessionKey);

        } catch (Exception e) {
            log.warn("⚠️ [OpenF1Live] Fetch failed: {}", e.getMessage());
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
                    if (name.equalsIgnoreCase(sessionType)) {
                        return session;
                    }
                }
            }

            return todaySessions.get(0);

        } catch (Exception e) {
            log.debug("[OpenF1Live] No live session: {}", e.getMessage());
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private void fetchTyreData(int sessionKey) {
        try {
            String stintUrl = OPENF1_BASE + "/stints?session_key=" + sessionKey;
            String posUrl = OPENF1_BASE + "/position?session_key=" + sessionKey;
            String driversUrl = OPENF1_BASE + "/drivers?session_key=" + sessionKey;

            List<Map<String, Object>> stints = restTemplate.getForObject(stintUrl, List.class);
            List<Map<String, Object>> positions = restTemplate.getForObject(posUrl, List.class);
            List<Map<String, Object>> drivers = restTemplate.getForObject(driversUrl, List.class);

            if (stints == null || drivers == null) return;

            Map<Integer, Map<String, Object>> latestStint = new HashMap<>();
            if (stints != null) {
                for (Map<String, Object> stint : stints) {
                    Integer driverNum = toInt(stint.get("driver_number"));
                    if (driverNum == null) continue;
                    latestStint.merge(driverNum, stint, (ex, ne) -> {
                        Integer exN = toInt(ex.get("stint_number"));
                        Integer neN = toInt(ne.get("stint_number"));
                        return (neN != null && exN != null && neN > exN) ? ne : ex;
                    });
                }
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
                data.put("sessionName", cachedSessionName);
                result.add(data);
            }

            result.sort(Comparator.comparingInt(m -> (Integer) m.getOrDefault("position", 99)));
            cachedLiveData = result;

        } catch (Exception e) {
            if (e.getMessage() != null && e.getMessage().contains("No results found")) {
                log.debug("[OpenF1Live] No tyre data yet for session {} — session may not have started", sessionKey);
            } else {
                log.warn("[OpenF1Live] Error fetching tyre data: {}", e.getMessage());
            }
        }
    }

    private Integer toInt(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).intValue();
        try { return Integer.parseInt(o.toString()); } catch (Exception e) { return null; }
    }


    public boolean isSessionLive() { return isSessionLive; }

    public List<Map<String, Object>> getLiveData() { return cachedLiveData; }

    public Integer getSessionKey() { return cachedSessionKey; }

    public String getSessionName() { return cachedSessionName; }

    public String getSessionType() { return cachedSessionType; }

    public String getCircuitName() { return cachedCircuitName; }

    public String getCountryName() { return cachedCountryName; }

    public String getSessionEmoji() {
        return SESSION_EMOJI.getOrDefault(cachedSessionType, "🏎️");
    }

    public Map<String, Object> forceFetch() {
        checkAndFetchLiveData();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("isLive", isSessionLive);
        result.put("sessionKey", cachedSessionKey);
        result.put("sessionName", cachedSessionName);
        result.put("sessionType", cachedSessionType);
        result.put("circuitName", cachedCircuitName);
        result.put("countryName", cachedCountryName);
        result.put("driversCount", cachedLiveData.size());
        result.put("data", cachedLiveData);
        return result;
    }

    private void sleep(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }
}
