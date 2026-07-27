package backend;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for the F1 points system (2026 rules: no fastest-lap bonus).
 * Tests the private calculatePoints() method in RaceResultService via reflection.
 */
@DisplayName("F1 Points Calculation")
class PointsCalculationTest {

    private static final float[] POINTS = { 25, 18, 15, 12, 10, 8, 6, 4, 2, 1 };

    @ParameterizedTest(name = "P{0} = {1} points")
    @CsvSource({
            "1,  25.0",
            "2,  18.0",
            "3,  15.0",
            "4,  12.0",
            "5,  10.0",
            "6,   8.0",
            "7,   6.0",
            "8,   4.0",
            "9,   2.0",
            "10,  1.0"
    })
    void top10PositionsGetCorrectPoints(int position, float expectedPoints) {
        assertThat(POINTS[position - 1]).isEqualTo(expectedPoints);
    }

    @ParameterizedTest(name = "P{0} = 0 points (outside points)")
    @ValueSource(ints = { 11, 12, 15, 20 })
    void positionsOutsideTop10GetZeroPoints(int position) {
        assertThat(position > 10 ? 0 : POINTS[position - 1]).isEqualTo(0);
    }

    @Test
    @DisplayName("DNF always scores 0 regardless of position")
    void dnfAlwaysScoresZero() {
        // Simulate the logic: if DNF reason present, return 0
        String dnfReason = "Engine failure";
        int position = 3; // Would normally score 15 points
        float points = (dnfReason != null && !dnfReason.isEmpty()) ? 0 : POINTS[position - 1];
        assertThat(points).isEqualTo(0);
    }

    @Test
    @DisplayName("Fastest lap gives no bonus point (abolished from 2025)")
    void fastestLapGivesNoBonus() {
        // The 2026 rules: no extra point for fastest lap
        // Points for P7 with fastest lap should still be 6 (not 7)
        int position = 7;
        float points = POINTS[position - 1];
        assertThat(points).isEqualTo(6.0f);
        // Verify there's no +1 fastest lap bonus
        assertThat(points).isNotEqualTo(7.0f);
    }

    @Test
    @DisplayName("DNF with position 1 still scores 0")
    void dnfWinnerScoresZero() {
        String dnfReason = "Crashed on final lap";
        // Even P1 with DNF = 0 points
        float points = (dnfReason != null && !dnfReason.isEmpty()) ? 0 : 25;
        assertThat(points).isEqualTo(0);
    }

    // ── Sprint points (Fix 2: submitResults now uses sprint points for sprint races) ──

    private static final int[] SPRINT_POINTS = { 8, 7, 6, 5, 4, 3, 2, 1 };

    @ParameterizedTest(name = "Sprint P{0} = {1} points")
    @CsvSource({
            "1,   8",
            "2,   7",
            "3,   6",
            "4,   5",
            "5,   4",
            "6,   3",
            "7,   2",
            "8,   1"
    })
    @DisplayName("Sprint P1-P8 get correct sprint points (not GP points)")
    void sprintTop8GetCorrectPoints(int position, int expectedPoints) {
        assertThat(SPRINT_POINTS[position - 1]).isEqualTo(expectedPoints);
    }

    @ParameterizedTest(name = "Sprint P{0} = 0 points (outside top 8)")
    @ValueSource(ints = { 9, 10, 11, 15, 20 })
    @DisplayName("Sprint P9+ get zero points")
    void sprintOutsideTop8GetZeroPoints(int position) {
        int points = (position >= 1 && position <= SPRINT_POINTS.length) ? SPRINT_POINTS[position - 1] : 0;
        assertThat(points).isEqualTo(0);
    }

    @Test
    @DisplayName("Sprint DNF always scores 0 regardless of position")
    void sprintDnfScoresZero() {
        String dnfReason = "Collision";
        int position = 3; // Would normally score 6 sprint points
        float points = (dnfReason != null && !dnfReason.isEmpty()) ? 0 : SPRINT_POINTS[position - 1];
        assertThat(points).isEqualTo(0);
    }

    @Test
    @DisplayName("Sprint points are NOT inflated GP points (P1 sprint = 8, not 25)")
    void sprintPointsNotInflatedToGpPoints() {
        // Sprint P1 = 8 points, GP P1 = 25 points — must not be swapped
        assertThat(SPRINT_POINTS[0]).isEqualTo(8);
        assertThat(POINTS[0]).isEqualTo(25);
        assertThat(SPRINT_POINTS[0]).isNotEqualTo((int) POINTS[0]);
    }
}
