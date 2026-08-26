package backend;

import backend.service.JolpicaRoundMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for the DB → Jolpica round mapping.
 * <p>
 * The 2-cancelled-round offset (R4 Bahrain + R5 Saudi) only exists in the 2026
 * calendar. Every other season must map rounds 1:1 — regression test for the
 * bug where 2025 races were synced against the wrong Jolpica rounds.
 */
@DisplayName("JolpicaRoundMapper")
class JolpicaRoundMapperTest {

    @Test
    @DisplayName("2025 maps DB rounds 1:1 (no cancelled rounds)")
    void season2025MapsRoundsOneToOne() {
        for (int r = 1; r <= 24; r++) {
            assertThat(JolpicaRoundMapper.toJolpicaRound(r, 2025))
                    .as("2025 round %d", r)
                    .isEqualTo(r);
        }
    }

    @Test
    @DisplayName("2026 applies the 2-cancelled-round offset")
    void season2026AppliesOffset() {
        assertThat(JolpicaRoundMapper.toJolpicaRound(1, 2026)).isEqualTo(1);
        assertThat(JolpicaRoundMapper.toJolpicaRound(3, 2026)).isEqualTo(3);
        assertThat(JolpicaRoundMapper.toJolpicaRound(4, 2026)).isEqualTo(JolpicaRoundMapper.CANCELLED);
        assertThat(JolpicaRoundMapper.toJolpicaRound(5, 2026)).isEqualTo(JolpicaRoundMapper.CANCELLED);
        assertThat(JolpicaRoundMapper.toJolpicaRound(6, 2026)).isEqualTo(4);
        assertThat(JolpicaRoundMapper.toJolpicaRound(9, 2026)).isEqualTo(7);
        assertThat(JolpicaRoundMapper.toJolpicaRound(10, 2026)).isEqualTo(8);
        assertThat(JolpicaRoundMapper.toJolpicaRound(24, 2026)).isEqualTo(22);
    }

    @Test
    @DisplayName("Other seasons map 1:1")
    void otherSeasonsMapOneToOne() {
        assertThat(JolpicaRoundMapper.toJolpicaRound(4, 2024)).isEqualTo(4);
        assertThat(JolpicaRoundMapper.toJolpicaRound(24, 2027)).isEqualTo(24);
        assertThat(JolpicaRoundMapper.toJolpicaRound(0, 2025)).isEqualTo(JolpicaRoundMapper.CANCELLED);
    }

    @Test
    @DisplayName("buildResultsUrl and buildQualifyingUrl use the season-aware mapping")
    void urlBuildersAreSeasonAware() {
        assertThat(JolpicaRoundMapper.buildResultsUrl(6, 2025, false))
                .isEqualTo("https://api.jolpi.ca/ergast/f1/2025/6/results.json");
        assertThat(JolpicaRoundMapper.buildResultsUrl(6, 2026, false))
                .isEqualTo("https://api.jolpi.ca/ergast/f1/2026/4/results.json");
        assertThat(JolpicaRoundMapper.buildQualifyingUrl(24, 2025))
                .isEqualTo("https://api.jolpi.ca/ergast/f1/2025/24/qualifying.json");
        assertThat(JolpicaRoundMapper.buildResultsUrl(2, 2025, true))
                .isEqualTo("https://api.jolpi.ca/ergast/f1/2025/2/sprint.json");
    }
}
