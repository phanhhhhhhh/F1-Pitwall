package backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StrategyPlanResponse {
    private Long id;
    private String planName;
    private String notes;
    private boolean executed;
    private int plannedStops;
    private String plannedCompounds;
    private List<StintResponse> stints;
    private Long raceId;
    private String raceName;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StintResponse {
        private String tyre;
        private int laps;
    }
}
