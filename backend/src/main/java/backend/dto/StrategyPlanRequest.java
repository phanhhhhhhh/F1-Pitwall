package backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class StrategyPlanRequest {

    @NotBlank
    private String planName;

    private String notes;

    @NotEmpty
    private List<@Valid StintRequest> stints;

    @Data
    public static class StintRequest {
        @NotBlank
        private String tyre;
        private int laps;
    }
}
