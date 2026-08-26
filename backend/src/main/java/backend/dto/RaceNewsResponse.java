package backend.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data @Builder
public class RaceNewsResponse {
    private Long id;
    private String title;
    private String content;
    private String tag;
    private LocalDateTime createdAt;
    private Long raceId;
    private String raceName;
    private int roundNumber;
    private int season;
    private LocalDate raceDate;
}
