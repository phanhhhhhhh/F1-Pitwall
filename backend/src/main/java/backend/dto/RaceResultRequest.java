package backend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class RaceResultRequest {
    @NotNull(message = "driverId is required")
    private Long driverId;

    @Min(value = 1, message = "startPosition must be between 1 and 22")
    @Max(value = 22, message = "startPosition must be between 1 and 22")
    private int startPosition;

    // 0 = DNF
    @Min(value = 0, message = "finishPosition cannot be negative")
    @Max(value = 22, message = "finishPosition must be between 0 and 22")
    private int finishPosition;

    private boolean hasFastestLap;
    private int fastestLapNumber;
    private float fastestLapTime;
    private String dnfReason;
}