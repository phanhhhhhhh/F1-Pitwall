package backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Season-wide pit stop timings, used to grade a player's attempt in the pit stop challenge against
 * what the real crews achieved rather than against invented thresholds.
 *
 * <p>Only green-flag stops count toward the statistics: a stop taken under a safety car is a
 * different job with a different time pressure, and mixing the two flatters the field average.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class PitStopBenchmarkResponse {
    private int season;
    private int totalStops;
    private int greenFlagStops;

    private Double fastestSec;
    private Double medianSec;
    private Double meanSec;
    /** 25th percentile — the bar for a stop that would count as a good one in the pit lane. */
    private Double topQuartileSec;

    /** The quickest individual stops of the season, fastest first. */
    private List<Stop> fastest;
    /** Per-team pit crew performance, ranked by median stop time. */
    private List<TeamCrew> crews;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Stop {
        private Long id;
        private double durationSec;
        private int lapNumber;
        private String driverName;
        private int driverNumber;
        private String teamName;
        private String teamColor;
        private String raceName;
        private int round;
        private String tyreOut;
        private boolean underSafetyCar;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class TeamCrew {
        private String teamName;
        private String teamColor;
        private int stops;
        private Double medianSec;
        private Double bestSec;
    }
}
