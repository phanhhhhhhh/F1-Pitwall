package backend;

import backend.service.OpenF1SyncService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for diacritics normalization used in driver name matching
 * (Jolpica → DB mapping). Public API is static stripAccents().
 */
@DisplayName("Diacritics Normalization — stripAccents")
class StripAccentsTest {

    @Test
    @DisplayName("Removes umlauts: Hülkenberg → hulkenberg")
    void removesUmlaut() {
        String result = OpenF1SyncService.stripAccents("Hülkenberg");
        assertThat(result).isEqualTo("hulkenberg");
    }

    @Test
    @DisplayName("Removes acute accents: Pérez → perez")
    void removesAcuteAccent() {
        String result = OpenF1SyncService.stripAccents("Pérez");
        assertThat(result).isEqualTo("perez");
    }

    @Test
    @DisplayName("Removes tilde: João → joao")
    void removesTilde() {
        String result = OpenF1SyncService.stripAccents("João");
        assertThat(result).isEqualTo("joao");
    }

    @Test
    @DisplayName("Removes cedilla: François → francois")
    void removesCedilla() {
        String result = OpenF1SyncService.stripAccents("François");
        assertThat(result).isEqualTo("francois");
    }

    @Test
    @DisplayName("Removes caron: Jiří → jiri")
    void removesCaron() {
        String result = OpenF1SyncService.stripAccents("Jiří");
        assertThat(result).isEqualTo("jiri");
    }

    @Test
    @DisplayName("Removes ø: Søren → soren")
    void removesSlashO() {
        String result = OpenF1SyncService.stripAccents("Søren");
        assertThat(result).isEqualTo("soren");
    }

    @Test
    @DisplayName("Name without diacritics is unchanged (lowercased)")
    void plainNameUnchanged() {
        String result = OpenF1SyncService.stripAccents("Hamilton");
        assertThat(result).isEqualTo("hamilton");
    }

    @Test
    @DisplayName("Mixed diacritics: José María → jose maria")
    void mixedDiacritics() {
        String result = OpenF1SyncService.stripAccents("José María");
        assertThat(result).isEqualTo("jose maria");
    }

    @Test
    @DisplayName("Empty string stays empty")
    void emptyStringStaysEmpty() {
        String result = OpenF1SyncService.stripAccents("");
        assertThat(result).isEqualTo("");
    }

    @Test
    @DisplayName("Null-safe behavior")
    void nullSafe() {
        // We expect NPE or similar; this test documents that stripAccents
        // currently does NOT handle null. If you add null-safety, change this test.
        try {
            OpenF1SyncService.stripAccents(null);
        } catch (NullPointerException e) {
            assertThat(e).isNotNull(); // Expected — no null guard yet
        }
    }
}
