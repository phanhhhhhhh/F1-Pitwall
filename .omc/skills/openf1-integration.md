---
name: openf1-integration
description: OpenF1 API integration patterns in F1 Pitwall — three-tier polling, in-memory caching, simulator fallback, WebSocket broadcast
triggers:
  - openf1
  - open f1 api
  - live telemetry
  - telemetry simulator
  - polling strategy
  - live session detection
  - tyre data
  - pitwall live
  - add live data
  - f1 live integration
---

# F1 Pitwall — OpenF1 API Integration Patterns

Extracted from `backend/src/main/java/backend/service/OpenF1LiveService.java`,
`OpenF1SyncService.java`, `OpenF1WeekendService.java`, and
`backend/src/main/java/backend/scheduler/TelemetrySimulator.java`.

---

## 1. Three-Tier Polling Architecture

| Service | Rate | Source | Responsibility |
|---|---|---|---|
| `OpenF1LiveService` | `@Scheduled(fixedRate = 30000)` | `api.openf1.org/v1` | Live session detection + tyre/position/driver data |
| `OpenF1SyncService` | `@Scheduled(fixedRate = 3600000)` | Jolpica API | Historical race results, standings — persisted to DB |
| `OpenF1WeekendService` | `@Scheduled(fixedRate = 1800000)` | `api.openf1.org/v1` | Current race weekend window (`TODAY-3d` to `TODAY+14d`) |
| `TelemetrySimulator` | `@Scheduled(fixedRate = 1000)` | DB (DriverRepository) | Synthetic telemetry when no live session |

**Key invariant:** `OpenF1LiveService.isSessionLive` is the single source of truth for whether real data exists. When `false`, `TelemetrySimulator` continues independently — it does NOT check this flag; both always run.

---

## 2. RestTemplate Timeout Configuration

Always use `SimpleClientHttpRequestFactory` — never the default (infinite timeout):

```java
private static RestTemplate createRestTemplate() {
    var factory = new SimpleClientHttpRequestFactory();
    factory.setConnectTimeout(5000);   // 5s
    factory.setReadTimeout(10000);     // 10s
    return new RestTemplate(factory);
}
```

This is created as a field, not Spring-injected, to keep timeout configuration isolated per service.

---

## 3. Live Session Detection Algorithm

`OpenF1LiveService.getLiveSession()` — priority-ordered session lookup:

```java
private static final List<String> MONITORED_SESSIONS = List.of(
    "Race", "Sprint", "Qualifying", "Sprint Qualifying",
    "Practice 3", "Practice 2", "Practice 1"
);

private Map<String, Object> getLiveSession() {
    // 1. Fetch all sessions for current year
    String url = OPENF1_BASE + "/sessions?year=" + LocalDate.now().getYear();
    List<Map<String, Object>> sessions = restTemplate.getForObject(url, List.class);

    // 2. Filter to today + yesterday (handles sessions that started yesterday)
    String today = LocalDate.now().toString();
    String yesterday = LocalDate.now().minusDays(1).toString();
    List<Map<String, Object>> todaySessions = sessions.stream()
        .filter(s -> dateStart.startsWith(today) || dateEnd.startsWith(today)
                  || dateStart.startsWith(yesterday))
        .toList();

    // 3. Return highest-priority session type found
    for (String sessionType : MONITORED_SESSIONS) {
        for (Map<String, Object> session : todaySessions) {
            if (name.equalsIgnoreCase(sessionType)) return session;
        }
    }
    return todaySessions.isEmpty() ? null : todaySessions.getFirst();
}
```

**Priority order matters:** Race > Sprint > Qualifying > Practice. A qualifying session won't shadow a race session that also falls on the same day.

---

## 4. In-Memory Caching with `volatile`

All cached live data uses `volatile` fields — no external cache (no Redis/Caffeine):

```java
private volatile List<Map<String, Object>> cachedLiveData = new ArrayList<>();
private volatile Integer cachedSessionKey = null;
private volatile String cachedSessionName = null;
private volatile String cachedSessionType = null;
private volatile String cachedCircuitName = null;
private volatile String cachedCountryName = null;

@Getter
private volatile boolean isSessionLive = false;
```

`volatile` ensures visibility across threads (the `@Scheduled` thread writes, HTTP request threads read). TTL is implicit — data stays until the next scheduler tick overwrites it.

**Weekend service TTL:** `OpenF1WeekendService` caches for 30 minutes (hardcoded `lastFetch + 1800s` check before re-querying).

---

## 5. Tyre Data Assembly Pattern

Three parallel API calls → merge by driver number → sort by position:

```java
private void fetchTyreData(int sessionKey) {
    // 1. Fetch three endpoints in sequence (RestTemplate is synchronous)
    List<Map<String, Object>> stints   = restTemplate.getForObject(stintUrl, List.class);
    List<Map<String, Object>> positions = restTemplate.getForObject(posUrl, List.class);
    List<Map<String, Object>> drivers   = restTemplate.getForObject(driversUrl, List.class);

    // 2. Latest stint per driver (by stint_number)
    Map<Integer, Map<String, Object>> latestStint = new HashMap<>();
    for (Map<String, Object> stint : stints) {
        latestStint.merge(driverNum, stint, (ex, ne) ->
            neN > exN ? ne : ex);
    }

    // 3. Latest position per driver
    Map<Integer, Integer> latestPosition = new HashMap<>();
    // ... populate from positions list

    // 4. Build result list, join on driverNumber
    List<Map<String, Object>> result = new ArrayList<>();
    // ... for each entry in latestStint, join driver info + position

    // 5. Sort by position
    result.sort(Comparator.comparingInt(m -> (Integer) m.getOrDefault("position", 99)));
    cachedLiveData = result;
}
```

Output fields per driver: `driverNumber`, `driverName`, `firstName`, `lastName`, `teamName`, `teamColor`, `tyreCompound`, `tyreAge`, `lapStart`, `stintNumber`, `position`, `isLive`, `sessionName`.

---

## 6. TelemetrySimulator — Fallback Pattern

Loads drivers from DB **once** at initialization (cached), runs independently of live status:

```java
@Component
@EnableScheduling
@RequiredArgsConstructor
public class TelemetrySimulator {

    private final SimpMessagingTemplate messagingTemplate;
    private final DriverRepository driverRepository;

    private List<DriverInfo> cachedDrivers = null;   // DB cache
    private final AtomicBoolean initialized = new AtomicBoolean(false);
    private final AtomicInteger globalLap = new AtomicInteger(1);
    private final AtomicInteger tickCount = new AtomicInteger(0);

    // Loads up to 10 drivers from DB on first tick, then caches forever
    private List<DriverInfo> loadDriversFromDb() {
        if (cachedDrivers != null) return cachedDrivers;
        cachedDrivers = driverRepository.findAll()
            .stream()
            .sorted(Comparator.comparingInt(Driver::getCarNumber))
            .limit(10)
            // ... map to DriverInfo
            .collect(Collectors.toList());
        return cachedDrivers;
    }

    @Scheduled(fixedRate = 1000)
    public void broadcastTelemetry() {
        if (!initialized.get()) initialize();
        // ... simulate lap ticks, corner phases, compute telemetry
        // Broadcast to ALL drivers:
        messagingTemplate.convertAndSend("/topic/telemetry", payloads);
        // Broadcast per driver:
        for (TelemetryPayload p : payloads) {
            messagingTemplate.convertAndSend("/topic/telemetry/" + p.getCarNumber(), p);
        }
    }
}
```

### Corner Phase Simulation

```java
double cornerPhase = (tick % 15) / 15.0;
boolean inCorner = cornerPhase > 0.3 && cornerPhase < 0.7;

if (inCorner) {
    double cornerDepth = Math.sin((cornerPhase - 0.3) / 0.4 * Math.PI);
    s.speed = 180 + (120 * (1 - cornerDepth)) + RNG.nextDouble() * 10;
    s.throttle = 20 + RNG.nextDouble() * 30;
    s.brake = 40 + RNG.nextDouble() * 40;
    s.drsActive = false;
} else {
    s.speed = 270 + RNG.nextDouble() * 50 + (s.position <= 3 ? 10 : 0);
    s.throttle = 90 + RNG.nextDouble() * 10;
    s.brake = RNG.nextDouble() * 5;
    s.drsActive = s.position > 1 && s.gap < 1.0;
}
```

Lap increments every 90 ticks (90s). Fuel burns 1.8kg/lap.

---

## 7. WebSocket Broadcast Topics

| Topic | Payload | Subscriber |
|---|---|---|
| `/topic/telemetry` | `List<TelemetryPayload>` | All-driver dashboard |
| `/topic/telemetry/{carNumber}` | `TelemetryPayload` | Per-driver focus view |
| `/topic/notifications` | notification object | `NotificationBell` component |

Frontend subscription pattern (from `NotificationBell.tsx`):
```ts
client.subscribe("/topic/notifications", (msg) => {
    const notification = JSON.parse(msg.body);
    // ... handle
});
```

---

## 8. Error Handling Strategy

All polling methods use silent-failure via `logger.warn` — never `throw`:

```java
@Scheduled(fixedRate = 30000)
public void checkAndFetchLiveData() {
    try {
        // ... all polling logic
    } catch (Exception e) {
        log.warn("⚠️ [OpenF1Live] Fetch failed: {}", e.getMessage());
        // isSessionLive stays at its last value; cachedLiveData stays stale
    }
}
```

**Special case for "No results found":** OpenF1 returns this text in an error body when a session has no data yet (e.g. session detected but hasn't started). Detect and downgrade to `debug` level:

```java
if (e.getMessage() != null && e.getMessage().contains("No results found")) {
    log.debug("[OpenF1Live] No tyre data yet for session {} — may not have started", sessionKey);
} else {
    log.warn("[OpenF1Live] Error fetching tyre data: {}", e.getMessage());
}
```

---

## 9. REST API Endpoints

### `OpenF1LiveController` (`/api/openf1`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/openf1/status` | Returns `isLive`, `sessionKey`, `sessionName`, `circuitName`, `driversCount` |
| `GET` | `/api/openf1/tyres` | Returns `cachedLiveData` (tyre + position per driver) |
| `POST` | `/api/openf1/fetch` | Triggers immediate `forceFetch()` and returns result |

### `OpenF1WeekendController` (`/api/openf1/weekend`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/openf1/weekend` | Returns current race weekend (with 30-min TTL cache) |
| `POST` | `/api/openf1/weekend/refresh` | Bypasses cache and force-fetches from OpenF1 |

---

## 10. Adding a New Live Data Field — Checklist

1. Add the endpoint fetch in `fetchTyreData()` (or a new private method).
2. Add the field to the `Map<String, Object>` result built in the same method.
3. Expose it via the existing `getLiveData()` response — no new endpoint needed unless it requires independent TTL.
4. In the frontend, read from `GET /api/openf1/tyres` response shape — already typed as `any[]` in `telemetry/page.tsx`.
5. If the field needs its own update cadence, create a new `volatile` cache field and a separate `@Scheduled` method.

---

## Key Library / Config

- `@Scheduled` requires `@EnableScheduling` (present on the `@SpringBootApplication` class or `TelemetrySimulator`).
- `SimpMessagingTemplate` is injected — requires `@EnableWebSocketMessageBroker` in `WebSocketConfig`.
- `api.openf1.org/v1` is public; no API key needed.
- Timeout values (5000ms / 10000ms) are hardcoded; extract to `application.properties` if environment-specific tuning is needed.
