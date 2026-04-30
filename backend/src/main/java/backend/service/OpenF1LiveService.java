package backend.service;

import lombok.Getter;
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

    private List<Map<String, Object>> cachedLiveData = new ArrayList<>();
    private Integer cachedSessionKey = null;
    @Getter
    private boolean isRaceLive = false;
    private long lastFetchTime = 0;

    @Scheduled(fixedRate = 30000)
    public void checkAndFetchLiveData() {
        try {
            Integer sessionKey = getLiveSessionKey();
            if (sessionKey == null) {
                if (isRaceLive) {
                    log.info("🏁 [OpenF1Live] Race ended, switching back to simulator");
                    isRaceLive = false;
                }
                return;
            }

            isRaceLive = true;
            cachedSessionKey = sessionKey;
            fetchTyreData(sessionKey);
            log.info("🔴 [OpenF1Live] Live race data fetched — session: {}", sessionKey);

        } catch (Exception e) {
            log.warn("⚠️ [OpenF1Live] Fetch failed: {}", e.getMessage());
        }
    }

    private Integer getLiveSessionKey() {
        try {
            String url = OPENF1_BASE + "/sessions?session_name=Race&year=" + LocalDate.now().getYear();
            List<Map<String, Object>> sessions = restTemplate.getForObject(url, List.class);
            if (sessions == null || sessions.isEmpty()) return null;

            for (Map<String, Object> session : sessions) {
                String dateStart = String.valueOf(session.get("date_start"));
                String dateEnd = String.valueOf(session.get("date_end"));
                if (dateStart == null || dateEnd == null) continue;

                String today = LocalDate.now().toString();
                if (dateStart.startsWith(today) || dateEnd.startsWith(today)) {
                    Object key = session.get("session_key");
                    if (key != null) return ((Number) key).intValue();
                }
            }
        } catch (Exception e) {
            log.debug("[OpenF1Live] No live session: {}", e.getMessage());
        }
        return null;
    }

    private void fetchTyreData(int sessionKey) {
        try {
            String stintUrl = OPENF1_BASE + "/stints?session_key=" + sessionKey;
            List<Map<String, Object>> stints = restTemplate.getForObject(stintUrl, List.class);

            String posUrl = OPENF1_BASE + "/position?session_key=" + sessionKey;
            List<Map<String, Object>> positions = restTemplate.getForObject(posUrl, List.class);

            String driversUrl = OPENF1_BASE + "/drivers?session_key=" + sessionKey;
            List<Map<String, Object>> drivers = restTemplate.getForObject(driversUrl, List.class);

            if (stints == null || positions == null || drivers == null) return;

            Map<Integer, Map<String, Object>> latestStint = new HashMap<>();
            for (Map<String, Object> stint : stints) {
                Integer driverNum = toInt(stint.get("driver_number"));
                if (driverNum == null) continue;
                latestStint.merge(driverNum, stint, (existing, newOne) -> {
                    Integer existingStint = toInt(existing.get("stint_number"));
                    Integer newStint = toInt(newOne.get("stint_number"));
                    return (newStint != null && existingStint != null && newStint > existingStint) ? newOne : existing;
                });
            }

            Map<Integer, Integer> latestPosition = new HashMap<>();
            for (Map<String, Object> pos : positions) {
                Integer driverNum = toInt(pos.get("driver_number"));
                Integer position = toInt(pos.get("position"));
                if (driverNum != null && position != null) {
                    latestPosition.put(driverNum, position);
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
                Integer position = latestPosition.getOrDefault(driverNum, 99);

                if (driver == null) continue;

                Map<String, Object> data = new LinkedHashMap<>();
                data.put("driverNumber", driverNum);
                data.put("driverName", driver.getOrDefault("full_name", "Driver #" + driverNum));
                data.put("teamName", driver.getOrDefault("team_name", "Unknown"));
                data.put("teamColor", "#" + driver.getOrDefault("team_colour", "FFFFFF"));
                data.put("tyreCompound", stint.getOrDefault("compound", "UNKNOWN"));
                data.put("tyreAge", stint.getOrDefault("tyre_age_at_start", 0));
                data.put("lapStart", stint.getOrDefault("lap_start", 0));
                data.put("stintNumber", stint.getOrDefault("stint_number", 1));
                data.put("position", position);
                data.put("isLive", true);
                result.add(data);
            }

            result.sort(Comparator.comparingInt(m -> (Integer) m.getOrDefault("position", 99)));
            cachedLiveData = result;

        } catch (Exception e) {
            log.error("[OpenF1Live] Error fetching tyre data: {}", e.getMessage());
        }
    }

    private Integer toInt(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).intValue();
        try { return Integer.parseInt(o.toString()); } catch (Exception e) { return null; }
    }


    public List<Map<String, Object>> getLiveData() { return cachedLiveData; }

    public Integer getSessionKey() { return cachedSessionKey; }

    public Map<String, Object> forceFetch() {
        checkAndFetchLiveData();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("isLive", isRaceLive);
        result.put("sessionKey", cachedSessionKey);
        result.put("driversCount", cachedLiveData.size());
        result.put("data", cachedLiveData);
        return result;
    }
}
