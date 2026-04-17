package backend.scheduler;

import backend.websocket.TelemetryPayload;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
@EnableScheduling
@RequiredArgsConstructor
public class TelemetrySimulator {

    private final SimpMessagingTemplate messagingTemplate;

    private final Map<String, DriverState> driverStates = new LinkedHashMap<>();
    private boolean initialized = false;
    private int globalLap = 1;
    private int tickCount = 0;

    private static final Object[][] DRIVERS = {
            { "Lando Norris",     "McLaren",           "#FF8000", 1 },
            { "George Russell",   "Mercedes",           "#27F4D2", 63 },
            { "Kimi Antonelli",   "Mercedes",           "#27F4D2", 12 },
            { "Max Verstappen",   "Red Bull Racing",    "#3671C6", 3 },
            { "Oscar Piastri",    "McLaren",            "#FF8000", 81 },
            { "Charles Leclerc",  "Ferrari",            "#E8002D", 16 },
            { "Lewis Hamilton",   "Ferrari",            "#E8002D", 44 },
            { "Carlos Sainz",     "Williams",           "#005AFF", 55 },
            { "Fernando Alonso",  "Aston Martin",       "#358C75", 14 },
            { "Isack Hadjar",     "Red Bull Racing",    "#3671C6", 6  },
    };

    private static final String[] TYRE_TYPES = { "SOFT", "MEDIUM", "HARD" };
    private static final Random RNG = new Random();

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

    private void initialize() {
        driverStates.clear();
        double gap = 0;
        for (int i = 0; i < DRIVERS.length; i++) {
            Object[] d = DRIVERS[i];
            DriverState s = new DriverState();
            s.name = (String) d[0];
            s.team = (String) d[1];
            s.color = (String) d[2];
            s.carNumber = (int) d[3];
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
        initialized = true;
    }

    @Scheduled(fixedRate = 1000)
    public void broadcastTelemetry() {
        if (!initialized) initialize();
        tickCount++;
        if (tickCount % 90 == 0) {
            globalLap++;
            driverStates.values().forEach(s -> {
                s.lap = globalLap;
                s.fuelLoad = Math.max(0, s.fuelLoad - 1.8);
            });
        }
        double cornerPhase = (tickCount % 15) / 15.0;
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
