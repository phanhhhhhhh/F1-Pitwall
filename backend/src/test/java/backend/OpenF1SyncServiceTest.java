package backend;

import backend.model.Race;
import backend.model.enums.RaceStatus;
import backend.repository.DriverRepository;
import backend.repository.LapTelemetryRepository;
import backend.repository.PitStopRepository;
import backend.repository.RaceRepository;
import backend.repository.RaceResultRepository;
import backend.repository.WeatherConditionRepository;
import backend.service.NotificationService;
import backend.service.OpenF1SyncService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;

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

    @Nested
    @DisplayName("syncRaceByRound — Jolpica preferred for past races")
    class SyncRaceByRoundBranching {

        private final RaceRepository raceRepo = mock(RaceRepository.class);

        private OpenF1SyncService newSpy() {
            return spy(new OpenF1SyncService(
                    raceRepo,
                    mock(RaceResultRepository.class),
                    mock(DriverRepository.class),
                    mock(NotificationService.class),
                    mock(PitStopRepository.class),
                    mock(LapTelemetryRepository.class),
                    mock(WeatherConditionRepository.class),
                    mock(RestTemplate.class)));
        }

        private Race raceOn(LocalDate date) {
            return Race.builder().name("Test Grand Prix").season(2025).roundNumber(1)
                    .date(date).status(RaceStatus.SCHEDULED).build();
        }

        @Test
        @DisplayName("past race syncs via Jolpica only, never OpenF1")
        void pastRaceUsesJolpicaOnly() {
            OpenF1SyncService svc = newSpy();
            doReturn(true).when(svc).syncRaceByRoundViaJolpica(any(Race.class), anyBoolean());

            assertThat(svc.syncRaceByRound(raceOn(LocalDate.now().minusDays(1)), false)).isTrue();
            verify(svc, never()).syncRaceResultsFromOpenF1(any(Race.class), anyBoolean());
        }

        @Test
        @DisplayName("past race with no Jolpica data returns false without OpenF1 fallback")
        void pastRaceNoJolpicaDataFailsWithoutOpenF1Fallback() {
            OpenF1SyncService svc = newSpy();
            doReturn(false).when(svc).syncRaceByRoundViaJolpica(any(Race.class), anyBoolean());

            assertThat(svc.syncRaceByRound(raceOn(LocalDate.now().minusDays(1)), false)).isFalse();
            verify(svc, never()).syncRaceResultsFromOpenF1(any(Race.class), anyBoolean());
        }

        @Test
        @DisplayName("live race tries OpenF1 first and marks the race completed")
        void liveRaceUsesOpenF1First() {
            OpenF1SyncService svc = newSpy();
            Race race = raceOn(LocalDate.now().plusDays(1));
            doReturn(true).when(svc).syncRaceResultsFromOpenF1(any(Race.class), anyBoolean());

            assertThat(svc.syncRaceByRound(race, false)).isTrue();
            assertThat(race.getStatus()).isEqualTo(RaceStatus.COMPLETED);
            verify(raceRepo).save(race);
            verify(svc, never()).syncRaceByRoundViaJolpica(any(Race.class), anyBoolean());
        }

        @Test
        @DisplayName("live race falls back to Jolpica when OpenF1 has no data")
        void liveRaceFallsBackToJolpica() {
            OpenF1SyncService svc = newSpy();
            doReturn(false).when(svc).syncRaceResultsFromOpenF1(any(Race.class), anyBoolean());
            doReturn(true).when(svc).syncRaceByRoundViaJolpica(any(Race.class), anyBoolean());

            assertThat(svc.syncRaceByRound(raceOn(LocalDate.now().plusDays(1)), false)).isTrue();
            verify(svc).syncRaceByRoundViaJolpica(any(Race.class), eq(false));
        }

        @Test
        @DisplayName("race without a date is treated as live (OpenF1 first)")
        void raceWithoutDateTreatsAsLive() {
            OpenF1SyncService svc = newSpy();
            Race race = raceOn(null);
            doReturn(true).when(svc).syncRaceResultsFromOpenF1(any(Race.class), anyBoolean());

            assertThat(svc.syncRaceByRound(race, false)).isTrue();
            verify(svc, never()).syncRaceByRoundViaJolpica(any(Race.class), anyBoolean());
        }
    }
}
