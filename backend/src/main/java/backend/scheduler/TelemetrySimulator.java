package backend.scheduler;

import backend.model.Driver;
import backend.repository.DriverRepository;
import backend.service.OpenF1LiveService;
import backend.websocket.TelemetryPayload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

@Component
@EnableScheduling
public class TelemetrySimulator {

    private final SimpMessagingTemplate messagingTemplate;
    private final DriverRepository driverRepository;
    private final OpenF1LiveService openF1LiveService;

    public TelemetrySimulator(SimpMessagingTemplate messagingTemplate,
                              DriverRepository driverRepository,
                              OpenF1LiveService openF1LiveService) {
        this.messagingTemplate = messagingTemplate;
        this.driverRepository = driverRepository;
        this.openF1LiveService = openF1LiveService;
    }

    private final Map<String, DriverState> driverStates = new LinkedHashMap<>();

    private final AtomicBoolean initialized = new AtomicBoolean(false);
    private final AtomicInteger globalLap = new AtomicInteger(1);
    private final AtomicInteger tickCount = new AtomicInteger(0);

    /** Cached driver list loaded from DB on first initialization (max 10 entries). */
    private List<DriverInfo> cachedDrivers = null;

    private static final String[] TYRE_TYPES = { "SOFT", "MEDIUM", "HARD" };
    private static final Random RNG = new Random();

    /** Lightweight value holder for driver data read from the DB. */
    private static class DriverInfo {
        final String name;
        final String team;
        final String color;
        final int carNumber;

        DriverInfo(String name, String team, String color, int carNumber) {
            this.name = name;
            this.team = team;
            this.color = color;
            this.carNumber = carNumber;
        }
    }

    private static class DriverState {
        String name, team, color;
        int carNumber, position;
        double speed, rpm, throttle, brake, fuelLoad, tyreTemp, lapTime, gap;
        int gear, lap;
        boolean drsActive;
        String tyreType;
        double targetSpeed, currentCornerPhase;
        boolean inCorner;
    }

    /**
     * Loads up to 10 drivers from the database, sorted by car number.
     * Results are cached in {@code cachedDrivers} so the DB is only queried once.
     */
    private List<DriverInfo> loadDriversFromDb() {
        if (cachedDrivers != null) return cachedDrivers;
        List<Driver> dbDrivers = driverRepository.findAllWithTeam()
                .stream()
                .limit(10)
                .collect(Collectors.toList());

        cachedDrivers = dbDrivers.stream().map(d -> {
            String teamName  = d.getTeam() != null ? d.getTeam().getName()     : "Unknown";
            String teamColor = d.getTeam() != null ? d.getTeam().getColorHex() : "#FFFFFF";
            return new DriverInfo(d.getName(), teamName, teamColor, d.getCarNumber());
        }).collect(Collectors.toList());

        return cachedDrivers;
    }

    private synchronized void initialize() {
        if (initialized.get()) return;
        List<DriverInfo> drivers = loadDriversFromDb();
        driverStates.clear();
        double gap = 0;
        for (int i = 0; i < drivers.size(); i++) {
            DriverInfo d = drivers.get(i);
            DriverState s = new DriverState();
            s.name = d.name;
            s.team = d.team;
            s.color = d.color;
            s.carNumber = d.carNumber;
            s.position = i + 1;
            s.lap = 1;
            s.fuelLoad = 110 - (i * 0.3);
            s.tyreType = TYRE_TYPES[i % 3];
            s.tyreTemp = 85 + RNG.nextDouble() * 15;
            s.gap = gap;
            s.lapTime = 85 + RNG.nextDouble() * 3;
            s.speed = 280 + RNG.nextDouble() * 40;
            s.rpm = 11000 + RNG.nextInt(3000);
            s.gear = 7;
            s.throttle = 85 + RNG.nextDouble() * 15;
            s.brake = 0;
            s.drsActive = i < 3;
            s.targetSpeed = s.speed;
            s.inCorner = false;
            gap += 0.5 + RNG.nextDouble() * 2;
            driverStates.put(s.name, s);
        }
        initialized.set(true);
    }

    @Scheduled(fixedRate = 1000)
    public void broadcastTelemetry() {
        // ── Live session: broadcast real OpenF1 data ──────────────────────
        if (openF1LiveService.isSessionLive()) {
            List<TelemetryPayload> payloads = buildRealPayloads();
            if (!payloads.isEmpty()) {
                messagingTemplate.convertAndSend("/topic/telemetry", payloads);
                for (TelemetryPayload p : payloads) {
                    messagingTemplate.convertAndSend(
                            "/topic/telemetry/" + p.getCarNumber(), p);
                }
                return;
            }
            // If real payloads are empty (no stint data yet), fall through to simulator
        }
        // ── No live session: use simulated telemetry ─────────────────────
        broadcastSimulated();
    }

    /**
     * Builds TelemetryPayload list from live OpenF1 data (positions + tyre compounds).
     * Fields not available from the free OpenF1 API (speed, RPM, gear, brake, etc.)
     * are left at sensible defaults — the frontend should treat these as unavailable.
     */
    @SuppressWarnings("unchecked")
    private List<TelemetryPayload> buildRealPayloads() {
        try {
            List<Map<String, Object>> liveData = openF1LiveService.getLiveData();
            if (liveData == null || liveData.isEmpty()) return List.of();

            List<TelemetryPayload> payloads = new ArrayList<>();
            for (Map<String, Object> d : liveData) {
                int carNum = toIntSafe(d.get("driverNumber"));
                int pos    = toIntSafe(d.get("position"));
                int lap    = toIntSafe(d.get("lapStart"));

                String compound = String.valueOf(d.getOrDefault("tyreCompound", ""));
                // Normalise compound to SOFT/MEDIUM/HARD for the frontend tyre chip
                String tyreType = compound.isBlank() ? "UNKNOWN" : compound.toUpperCase();

                payloads.add(TelemetryPayload.builder()
                        .driverName(String.valueOf(d.getOrDefault("driverName", "")))
                        .teamName(String.valueOf(d.getOrDefault("teamName", "")))
                        .teamColor(String.valueOf(d.getOrDefault("teamColor", "#FFFFFF")))
                        .carNumber(carNum)
                        .lap(lap)
                        .speed(0)        // not in OpenF1 free tier
                        .rpm(0)          // not in OpenF1 free tier
                        .gear(0)         // not in OpenF1 free tier
                        .throttle(0)     // not in OpenF1 free tier
                        .brake(0)        // not in OpenF1 free tier
                        .drsActive(false) // not in OpenF1 free tier
                        .fuelLoad(0)     // not in OpenF1 free tier
                        .tyreType(tyreType)
                        .tyreTemp(0)     // not in OpenF1 free tier
                        .lapTime(0)      // populated by live-timing endpoint
                        .gap(0)          // populated by live-timing endpoint
                        .position(pos)
                        .timestamp(System.currentTimeMillis())
                        .build());
            }
            return payloads;
        } catch (Exception e) {
            // If anything fails fetching live data, fall back to simulator silently
            return List.of();
        }
    }

    private static int toIntSafe(Object o) {
        if (o instanceof Number n) return n.intValue();
        if (o instanceof String s) {
            try { return Integer.parseInt(s); } catch (NumberFormatException ignored) {}
        }
        return 0;
    }

    private void broadcastSimulated() {
        if (!initialized.get()) initialize();

        int tick = tickCount.incrementAndGet();

        if (tick % 90 == 0) {
            int lap = globalLap.incrementAndGet();
            driverStates.values().forEach(s -> {
                s.lap = lap;
                s.fuelLoad = Math.max(0, s.fuelLoad - 1.8);
            });
        }

        double cornerPhase = (tick % 15) / 15.0;
        boolean inCorner = cornerPhase > 0.3 && cornerPhase < 0.7;

        List<TelemetryPayload> payloads = new ArrayList<>();

        for (DriverState s : driverStates.values()) {

            if (inCorner) {
                double cornerDepth = Math.sin((cornerPhase - 0.3) / 0.4 * Math.PI);
                s.speed = 180 + (120 * (1 - cornerDepth)) + RNG.nextDouble() * 10;
                s.gear = s.speed > 250 ? 7 : s.speed > 200 ? 6 : s.speed > 160 ? 5 : 4;
                s.throttle = 20 + RNG.nextDouble() * 30;
                s.brake = 40 + RNG.nextDouble() * 40;
                s.drsActive = false;
            } else {
                s.speed = 270 + RNG.nextDouble() * 50 + (s.position <= 3 ? 10 : 0);
                s.gear = s.speed > 300 ? 8 : s.speed > 270 ? 7 : 6;
                s.throttle = 90 + RNG.nextDouble() * 10;
                s.brake = RNG.nextDouble() * 5;
                s.drsActive = s.position > 1 && s.gap < 1.0;
            }

            s.rpm = (int) (s.speed * 50 + RNG.nextInt(500));
            s.rpm = Math.min(15000, Math.max(6000, s.rpm));

            s.tyreTemp += (s.brake > 30 ? 0.5 : -0.1) + RNG.nextDouble() * 0.3;
            s.tyreTemp = Math.min(120, Math.max(60, s.tyreTemp));

            s.gap += (RNG.nextDouble() - 0.5) * 0.05;
            s.gap = Math.max(0, s.gap);

            s.lapTime = 85 + (s.position * 0.1) + RNG.nextDouble() * 0.5;

            payloads.add(TelemetryPayload.builder()
                    .driverName(s.name)
                    .teamName(s.team)
                    .teamColor(s.color)
                    .carNumber(s.carNumber)
                    .lap(s.lap)
                    .speed(Math.round(s.speed * 10.0) / 10.0)
                    .rpm((int) s.rpm)
                    .gear(s.gear)
                    .throttle(Math.round(s.throttle * 10.0) / 10.0)
                    .brake(Math.round(s.brake * 10.0) / 10.0)
                    .drsActive(s.drsActive)
                    .fuelLoad(Math.round(s.fuelLoad * 10.0) / 10.0)
                    .tyreType(s.tyreType)
                    .tyreTemp(Math.round(s.tyreTemp * 10.0) / 10.0)
                    .lapTime(Math.round(s.lapTime * 1000.0) / 1000.0)
                    .gap(Math.round(s.gap * 1000.0) / 1000.0)
                    .position(s.position)
                    .timestamp(System.currentTimeMillis())
                    .build());
        }

        messagingTemplate.convertAndSend("/topic/telemetry", payloads);

        for (TelemetryPayload p : payloads) {
            messagingTemplate.convertAndSend(
                    "/topic/telemetry/" + p.getCarNumber(), p
            );
        }
    }
}