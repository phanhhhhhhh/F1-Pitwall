package backend.dto;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class WeatherResponse {
    private int lap;
    private String condition;
    private double trackTempC;
}
