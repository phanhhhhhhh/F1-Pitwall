package backend;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for driver/constructor standings tie-break logic.
 *
 * The standing sort order is:
 *   1. Total points (DESC)
 *   2. Wins (DESC) — GP only, sprints excluded
 *   3. Podiums (DESC) — GP only, sprints excluded
 *
 * These tests verify the comparator chain used in RaceResultService
 * without needing a database connection.
 */
@DisplayName("Standings Tie-Break Logic")
class StandingsTieBreakTest {

    // Mirrors the inner class structure in RaceResultService
    record DriverStats(String name, float totalPoints, int wins, int podiums) {}

    private static final Comparator<DriverStats> STANDINGS_COMPARATOR =
            Comparator.comparingDouble((DriverStats s) -> s.totalPoints)
                    .thenComparingInt((DriverStats s) -> s.wins)
                    .thenComparingInt((DriverStats s) -> s.podiums)
                    .reversed();

    @Test
    @DisplayName("Higher points rank first")
    void higherPointsRankFirst() {
        var a = new DriverStats("A", 100, 2, 5);
        var b = new DriverStats("B", 80, 5, 8);

        List<DriverStats> sorted = sortStandings(List.of(a, b));

        assertThat(sorted.get(0).name).isEqualTo("A");
        assertThat(sorted.get(1).name).isEqualTo("B");
    }

    @Test
    @DisplayName("Tie on points → more wins ranks first")
    void tieOnPointsWinsBreakTie() {
        var a = new DriverStats("A", 100, 3, 5);
        var b = new DriverStats("B", 100, 5, 3);

        List<DriverStats> sorted = sortStandings(List.of(a, b));

        assertThat(sorted.get(0).name).isEqualTo("B"); // More wins
        assertThat(sorted.get(1).name).isEqualTo("A");
    }

    @Test
    @DisplayName("Tie on points + wins → more podiums ranks first")
    void tieOnPointsAndWinsPodiumsBreakTie() {
        var a = new DriverStats("A", 100, 3, 7);
        var b = new DriverStats("B", 100, 3, 5);

        List<DriverStats> sorted = sortStandings(List.of(a, b));

        assertThat(sorted.get(0).name).isEqualTo("A"); // More podiums
        assertThat(sorted.get(1).name).isEqualTo("B");
    }

    @Test
    @DisplayName("Equal on all criteria → stable order (no NPE)")
    void allEqualResultsInStableOrder() {
        var a = new DriverStats("A", 100, 3, 5);
        var b = new DriverStats("B", 100, 3, 5);

        List<DriverStats> sorted = sortStandings(List.of(a, b));

        // Both should be present, no exceptions
        assertThat(sorted).hasSize(2);
        assertThat(sorted.stream().map(s -> s.totalPoints).distinct()).hasSize(1);
    }

    @Test
    @DisplayName("Zero points drivers are still ranked")
    void zeroPointsStaysAtBottom() {
        var a = new DriverStats("A", 50, 1, 2);
        var b = new DriverStats("B", 0, 0, 0);
        var c = new DriverStats("C", 25, 0, 1);

        List<DriverStats> sorted = sortStandings(List.of(a, b, c));

        assertThat(sorted.get(0).name).isEqualTo("A");
        assertThat(sorted.get(1).name).isEqualTo("C");
        assertThat(sorted.get(2).name).isEqualTo("B");
    }

    @Test
    @DisplayName("Multi-way tie resolved by podiums")
    void multiWayTieResolvedByPodiums() {
        var a = new DriverStats("A", 100, 3, 8);
        var b = new DriverStats("B", 100, 3, 10);
        var c = new DriverStats("C", 100, 3, 5);

        List<DriverStats> sorted = sortStandings(List.of(a, b, c));

        assertThat(sorted.get(0).name).isEqualTo("B"); // 10 podiums
        assertThat(sorted.get(1).name).isEqualTo("A"); // 8 podiums
        assertThat(sorted.get(2).name).isEqualTo("C"); // 5 podiums
    }

    private List<DriverStats> sortStandings(List<DriverStats> input) {
        return input.stream().sorted(STANDINGS_COMPARATOR).collect(Collectors.toList());
    }
}
