package backend.websocket;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TelemetryPayload {
    private String driverName;
    private String teamName;
    private String teamColor;
    private int carNumber;
    private int lap;
    private double speed;
    private int rpm;
    private int gear;
    private double throttle;
    private double brake;
    private boolean drsActive;
    private double fuelLoad;
    private String tyreType;
    private double tyreTemp;
    private double lapTime;
    private double gap;
    private int position;
    private long timestamp;
}
