package backend.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RaceWinnerResponse {
    private String raceName;
    private Long raceId;
    private String driverName;
    private String driverLastName;
    private String teamName;
    private String teamColor;
    private float points;
    private boolean hasFastestLap;
}
