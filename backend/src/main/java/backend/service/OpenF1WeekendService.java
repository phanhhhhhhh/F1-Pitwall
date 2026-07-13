package backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
public class OpenF1WeekendService {

    private static final String OPENF1_BASE = "https://api.openf1.org/v1";

    private final RestTemplate restTemplate;

    // Thứ tự ưu tiên session
    private static final List<String> SESSION_ORDER = List.of(
        "Practice 1", "Practice 2", "Practice 3",
        "Sprint Qualifying", "Sprint",
        "Qualifying", "Race"
    );

    @CacheEvict(value = "weekendSchedule", allEntries = true)
    @Scheduled(fixedRate = 1800000) // refresh mỗi 30 phút
    public void refreshCache() {
        log.info("[Weekend] Cache evicted");
    }

    public Map<String, Object> getWeekend() {
        try {
            return enrichWithStatus(fetchWeekendData());
        } catch (Exception e) {
            log.warn("[Weekend] Fetch failed: {}", e.getMessage());
            return Map.of("error", "Unable to fetch weekend data");
        }
    }

    @Cacheable("weekendSchedule")
    @SuppressWarnings("unchecked")
    public Map<String, Object> fetchWeekendData() {
        int year = LocalDate.now().getYear();

        // Lấy sessions trong vòng 14 ngày tới + 3 ngày qua (để cover weekend đang diễn ra)
        String today = LocalDate.now().minusDays(3).toString();
        String twoWeeksLater = LocalDate.now().plusDays(14).toString();

        String url = OPENF1_BASE + "/sessions?year=" + year
            + "&date_start>=" + today
            + "&date_start<=" + twoWeeksLater;

        List<Map<String, Object>> sessions = restTemplate.getForObject(url, List.class);
        if (sessions == null || sessions.isEmpty()) return buildEmptyWeekend();

        // Group sessions by meeting (race weekend)
        // Lấy meeting gần nhất (có thể đang diễn ra hoặc sắp tới)
        Map<String, List<Map<String, Object>>> byMeeting = new LinkedHashMap<>();
        for (Map<String, Object> session : sessions) {
            String meetingKey = String.valueOf(session.getOrDefault("meeting_key", ""));
            byMeeting.computeIfAbsent(meetingKey, k -> new ArrayList<>()).add(session);
        }

        if (byMeeting.isEmpty()) return buildEmptyWeekend();

        // Tìm meeting phù hợp nhất — ưu tiên meeting đang diễn ra, sau đó là gần nhất
        String bestMeetingKey = findBestMeeting(byMeeting);
        List<Map<String, Object>> meetingSessions = byMeeting.get(bestMeetingKey);
        if (meetingSessions == null || meetingSessions.isEmpty()) return buildEmptyWeekend();

        // Sort sessions theo thứ tự thời gian
        meetingSessions.sort(Comparator.comparing(s ->
            String.valueOf(s.getOrDefault("date_start", ""))));

        // Build result
        String countryName = String.valueOf(meetingSessions.get(0).getOrDefault("country_name", ""));
        String circuitName = String.valueOf(meetingSessions.get(0).getOrDefault("circuit_short_name", ""));

        List<Map<String, Object>> sessionList = new ArrayList<>();
        for (Map<String, Object> s : meetingSessions) {
            String sessionName = String.valueOf(s.getOrDefault("session_name", ""));
            if (!SESSION_ORDER.contains(sessionName)) continue;

            Map<String, Object> sessionData = new LinkedHashMap<>();
            sessionData.put("sessionKey", s.get("session_key"));
            sessionData.put("name", sessionName);
            sessionData.put("dateStart", s.getOrDefault("date_start", ""));
            sessionData.put("dateEnd", s.getOrDefault("date_end", ""));
            sessionList.add(sessionData);
        }

        // Sort theo SESSION_ORDER
        sessionList.sort(Comparator.comparingInt(s ->
            SESSION_ORDER.indexOf(s.get("name"))));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("countryName", countryName);
        result.put("circuitName", circuitName);
        result.put("meetingKey", bestMeetingKey);
        result.put("sessions", sessionList);
        return result;
    }

    private String findBestMeeting(Map<String, List<Map<String, Object>>> byMeeting) {
        long now = Instant.now().toEpochMilli();
        String bestKey = null;
        long bestDiff = Long.MAX_VALUE;

        for (Map.Entry<String, List<Map<String, Object>>> entry : byMeeting.entrySet()) {
            List<Map<String, Object>> sessions = entry.getValue();
            for (Map<String, Object> session : sessions) {
                try {
                    String dateStart = String.valueOf(session.getOrDefault("date_start", ""));
                    String dateEnd = String.valueOf(session.getOrDefault("date_end", ""));
                    if (dateStart.isEmpty()) continue;

                    long start = Instant.parse(dateStart).toEpochMilli();
                    long end = dateEnd.isEmpty() ? start + 3600000 : Instant.parse(dateEnd).toEpochMilli();

                    // Đang diễn ra → ưu tiên cao nhất
                    if (now >= start && now <= end) {
                        return entry.getKey();
                    }

                    // Tính khoảng cách tới session gần nhất
                    long diff = Math.abs(start - now);
                    if (diff < bestDiff) {
                        bestDiff = diff;
                        bestKey = entry.getKey();
                    }
                } catch (Exception ignored) {}
            }
        }
        return bestKey != null ? bestKey : byMeeting.keySet().iterator().next();
    }

    // Enrich sessions với status động (COMPLETED/LIVE/UPCOMING)
    @SuppressWarnings("unchecked")
    private Map<String, Object> enrichWithStatus(Map<String, Object> weekend) {
        if (weekend.containsKey("error")) return weekend;

        long now = Instant.now().toEpochMilli();
        List<Map<String, Object>> sessions = (List<Map<String, Object>>) weekend.get("sessions");
        if (sessions == null) return weekend;

        Map<String, Object> currentSession = null;
        Map<String, Object> nextSession = null;

        List<Map<String, Object>> enriched = new ArrayList<>();
        for (Map<String, Object> session : sessions) {
            Map<String, Object> s = new LinkedHashMap<>(session);
            String status = "UPCOMING";
            long startsIn = -1;
            long endsIn = -1;

            try {
                String dateStart = String.valueOf(s.getOrDefault("dateStart", ""));
                String dateEnd = String.valueOf(s.getOrDefault("dateEnd", ""));
                if (!dateStart.isEmpty()) {
                    long start = Instant.parse(dateStart).toEpochMilli();
                    long end = dateEnd.isEmpty() ? start + 3600000 : Instant.parse(dateEnd).toEpochMilli();

                    if (now > end) {
                        status = "COMPLETED";
                    } else if (now >= start && now <= end) {
                        status = "LIVE";
                        endsIn = (end - now) / 1000; // seconds
                        currentSession = s;
                    } else {
                        status = "UPCOMING";
                        startsIn = (start - now) / 1000; // seconds
                        if (nextSession == null) nextSession = s;
                    }
                }
            } catch (Exception ignored) {}

            s.put("status", status);
            if (startsIn >= 0) s.put("startsIn", startsIn);
            if (endsIn >= 0) s.put("endsIn", endsIn);
            enriched.add(s);
        }

        Map<String, Object> result = new LinkedHashMap<>(weekend);
        result.put("sessions", enriched);
        result.put("currentSession", currentSession);
        result.put("nextSession", nextSession);
        result.put("timestamp", now);
        return result;
    }

    private Map<String, Object> buildEmptyWeekend() {
        Map<String, Object> empty = new LinkedHashMap<>();
        empty.put("countryName", "");
        empty.put("circuitName", "");
        empty.put("sessions", List.of());
        empty.put("currentSession", null);
        empty.put("nextSession", null);
        return empty;
    }
}
