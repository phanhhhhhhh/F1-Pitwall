package backend.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DriverStandingResponse {
    private int position;
    private Long driverId;
    private String driverName;
    private int carNumber;
    private String nationality;
    private String teamName;
    private String teamColor;
    private float totalPoints;
    private int wins;
    private int podiums;
    private int fastestLaps;
    private float gapToLeader;
    private float gapToAhead;
}
