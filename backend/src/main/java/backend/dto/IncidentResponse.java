package backend.dto;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class IncidentResponse {
    private Long id;
    private int lap;
    private String driverName;
    private String teamName;
    private String type;
    private String description;
}
