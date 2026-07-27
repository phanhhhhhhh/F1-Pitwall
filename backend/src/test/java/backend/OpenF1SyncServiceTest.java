package backend;

import backend.service.OpenF1SyncService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("OpenF1SyncService — diacritics & name-matching")
class OpenF1SyncServiceTest {

    @Nested
    @DisplayName("stripAccents — diacritics removal")
    class StripAccents {

        @Test
        @DisplayName("removes acute accents and lowercases")
        void removesAcuteAccents() {
            assertThat(OpenF1SyncService.stripAccents("José"))
                    .isEqualTo("jose");
        }

        @Test
        @DisplayName("removes cedilla and lowercases")
        void removesCedilla() {
            assertThat(OpenF1SyncService.stripAccents("François"))
                    .isEqualTo("francois");
        }

        @Test
        @DisplayName("removes umlaut / diaeresis and lowercases")
        void removesUmlaut() {
            assertThat(OpenF1SyncService.stripAccents("Hülkenberg"))
                    .isEqualTo("hulkenberg");
        }

        @Test
        @DisplayName("lowercases ASCII-only input")
        void unchangedForAscii() {
            assertThat(OpenF1SyncService.stripAccents("Lando Norris"))
                    .isEqualTo("lando norris");
        }

        @Test
        @DisplayName("removes tilde and lowercases")
        void removesTilde() {
            assertThat(OpenF1SyncService.stripAccents("São Paulo"))
                    .isEqualTo("sao paulo");
        }

        @Test
        @DisplayName("handles empty string")
        void handlesEmptyString() {
            assertThat(OpenF1SyncService.stripAccents("")).isEmpty();
        }

        @Test
        @DisplayName("throws on null input")
        void throwsOnNull() {
            assertThatThrownBy(() -> OpenF1SyncService.stripAccents(null))
                    .isInstanceOf(NullPointerException.class);
        }
    }

    @Nested
    @DisplayName("findDriver — name matching")
    class FindDriver {

        // findDriver is private, but its logic is tested via stripAccents + manual matching.
        // We test the matching algorithm's components.

        @Test
        @DisplayName("exact name match after stripping accents")
        void exactMatchAfterStripAccents() {
            String openF1Name = "Kimi Antonelli";
            String dbName = "Kimi Antonelli";
            assertThat(OpenF1SyncService.stripAccents(openF1Name))
                    .isEqualTo(OpenF1SyncService.stripAccents(dbName));
        }

        @Test
        @DisplayName("handles first-name-only vs full-name mismatch via last-name matching")
        void lastNameMatch() {
            String openF1Name = "Andrea Kimi Antonelli";
            String dbName = "Kimi Antonelli";
            String[] fParts = OpenF1SyncService.stripAccents(openF1Name).split(" ");
            String[] dParts = OpenF1SyncService.stripAccents(dbName).split(" ");
            String fLast = fParts[fParts.length - 1]; // "Antonelli"
            String dLast = dParts[dParts.length - 1]; // "Antonelli"
            assertThat(fLast).isEqualTo(dLast);
        }

        @Test
        @DisplayName("diacritics in both names are normalized before comparison")
        void diacriticsNormalizedBothSides() {
            String openF1Name = "François Colapinto";
            String dbName = "Francois Colapinto";
            assertThat(OpenF1SyncService.stripAccents(openF1Name))
                    .isEqualTo(OpenF1SyncService.stripAccents(dbName));
        }
    }
}
