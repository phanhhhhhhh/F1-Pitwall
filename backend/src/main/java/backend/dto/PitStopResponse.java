package backend.dto;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class PitStopResponse {
    private Long id;
    private int lapNumber;
    private String driverName;
    private String teamName;
    private String teamColor;
    private String tyreCompound;
    private double durationMs;
}
