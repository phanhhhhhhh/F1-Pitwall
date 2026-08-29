package backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A driver's rated abilities together with the numbers they were derived from.
 *
 * <p>Every skill is on a 0–100 scale calibrated for the current grid, so a mid-field driver lands
 * near 85 rather than near 50. The {@link Evidence} block is deliberately part of the contract: a
 * rating with no visible basis is indistinguishable from a made-up number, so the UI can always
 * show what produced it and how much data was behind it.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class DriverProfileResponse {

    private Long driverId;
    private String name;
    private int carNumber;
    private String nationality;
    private String teamName;
    private String teamColorHex;
    private Integer age;

    private int careerWins;
    private int careerPoles;
    private float careerPoints;

    /** Season the ratings were computed over. */
    private int season;

    private Skills skills;
    private Evidence evidence;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Skills {
        private int pace;
        private int racecraft;
        private int tyreMgmt;
        private int experience;
        private int wetSkill;
        /** Weighted blend of the five skills, for sorting and headline display. */
        private int overall;
    }

    /**
     * The measurements behind the ratings. {@code null} means there was no data for that measure —
     * the corresponding skill fell back to the grid baseline and its confidence will be low.
     */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Evidence {
        private String teammateName;

        // Qualifying
        private int qualifyingSessions;
        private int qualifyingHeadToHeadSessions;
        /** Share of qualifying sessions the driver out-qualified their teammate, 0–100. */
        private Double qualifyingH2HPct;
        /** Median lap-time gap to the teammate as a percentage; negative means faster. */
        private Double teammateGapPct;
        private Double avgQualifyingPosition;

        // Race
        private int racesStarted;
        private int racesClassified;
        private Double finishRatePct;
        private Double avgPositionsGained;
        private Double raceH2HPct;
        private Double avgFinishPosition;

        // Tyres
        private int pitStops;
        private Double avgPitStopSec;
        private Double avgStopsPerRace;
        private Double fieldAvgStopsPerRace;
        /** Lap-time loss per lap within a stint; lower is better tyre management. */
        private Double degradationSecPerLap;
        private Double fieldDegradationSecPerLap;
        private int stintsAnalysed;

        // Wet weather
        private int wetRaces;
        private Double wetAvgFinish;
        private Double dryAvgFinish;

        /** How much real data backs each skill, 0–100. Low values mean the rating leans on the baseline. */
        private Confidence confidence;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Confidence {
        private int pace;
        private int racecraft;
        private int tyreMgmt;
        private int experience;
        private int wetSkill;
    }
}
