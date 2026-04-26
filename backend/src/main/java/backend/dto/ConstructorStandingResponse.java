package backend.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ConstructorStandingResponse {
    private int position;
    private Long teamId;
    private String teamName;
    private String teamColor;
    private String country;
    private float totalPoints;
    private int wins;
    private int podiums;
    private float gapToLeader;
    private float gapToAhead;
    // Drivers of this team
    private String driver1Name;
    private String driver2Name;
    private float driver1Points;
    private float driver2Points;
}
