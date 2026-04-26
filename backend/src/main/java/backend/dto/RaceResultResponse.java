package backend.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RaceResultResponse {
    private Long id;
    private int finishPosition;
    private int startPosition;
    private float points;
    private boolean hasFastestLap;
    private float fastestLapTime;
    private String dnfReason;

    // Driver info
    private Long driverId;
    private String driverName;
    private int carNumber;
    private String nationality;

    // Team info
    private String teamName;
    private String teamColor;

    // Race info
    private Long raceId;
    private String raceName;
    private int roundNumber;
}
