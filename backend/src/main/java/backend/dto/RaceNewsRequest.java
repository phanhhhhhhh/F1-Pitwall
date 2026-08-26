package backend.dto;

import lombok.Data;

@Data
public class RaceNewsRequest {
    private String title;
    private String content;
    private String tag;
    private Long raceId;
}
