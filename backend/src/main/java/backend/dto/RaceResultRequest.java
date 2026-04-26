package backend.dto;

import lombok.Data;

@Data
public class RaceResultRequest {
    private Long driverId;
    private int startPosition;
    private int finishPosition;
    private boolean hasFastestLap;
    private int fastestLapNumber;
    private float fastestLapTime;
    private String dnfReason; // null nếu không DNF
}
