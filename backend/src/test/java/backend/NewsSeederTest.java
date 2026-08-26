package backend;

import backend.config.seeder.NewsSeeder;
import backend.model.Race;
import backend.model.RaceNews;
import backend.model.enums.RaceStatus;
import backend.repository.RaceNewsRepository;
import backend.repository.RaceRepository;
import backend.service.RaceNewsService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@DisplayName("NewsSeeder")
class NewsSeederTest {

    private final RaceNewsService newsService = mock(RaceNewsService.class);
    private final RaceNewsRepository newsRepo = mock(RaceNewsRepository.class);
    private final RaceRepository raceRepo = mock(RaceRepository.class);

    @Test
    @DisplayName("backfills reports only for completed races")
    void backfillsOnlyCompletedRaces() {
        Race completed = Race.builder().id(1L).name("Australian Grand Prix")
                .season(2025).roundNumber(1).status(RaceStatus.COMPLETED).build();
        Race scheduled = Race.builder().id(2L).name("Chinese Grand Prix")
                .season(2025).roundNumber(2).status(RaceStatus.SCHEDULED).build();
        when(raceRepo.findAllByOrderBySeasonDescRoundNumberAsc())
                .thenReturn(List.of(completed, scheduled));
        when(newsRepo.existsByTitle(anyString())).thenReturn(true);

        new NewsSeeder(newsService, newsRepo, raceRepo).run();

        verify(newsService).generateRaceReport(completed);
        verify(newsService, never()).generateRaceReport(scheduled);
    }

    @Test
    @DisplayName("seeds the curated driver news when absent")
    void seedsCuratedDriverNews() {
        Race dutchGp = Race.builder().id(30L).name("Dutch Grand Prix")
                .season(2026).roundNumber(14).status(RaceStatus.COMPLETED).build();
        // Sprint rows share the GP's round number — the GP must win the match
        Race dutchSprint = Race.builder().id(31L).name("Dutch Grand Prix Sprint")
                .season(2026).roundNumber(14).status(RaceStatus.COMPLETED).build();
        when(raceRepo.findAllByOrderBySeasonDescRoundNumberAsc()).thenReturn(List.of());
        when(raceRepo.findBySeason(2026)).thenReturn(List.of(dutchSprint, dutchGp));
        when(newsRepo.existsByTitle(anyString())).thenReturn(false);

        new NewsSeeder(newsService, newsRepo, raceRepo).run();

        ArgumentCaptor<RaceNews> captor = ArgumentCaptor.forClass(RaceNews.class);
        verify(newsRepo).save(captor.capture());
        RaceNews saved = captor.getValue();
        assertThat(saved.getRace()).isEqualTo(dutchGp);
        assertThat(saved.getTag()).isEqualTo(RaceNewsService.TAG_DRIVER_NEWS);
        assertThat(saved.getTitle()).contains("Hadjar", "Lawson", "Tsunoda");
        assertThat(saved.getContent()).contains("Red Bull Racing", "Racing Bulls");
    }

    @Test
    @DisplayName("skips the curated driver news when the title already exists")
    void skipsCuratedDriverNewsWhenPresent() {
        when(raceRepo.findAllByOrderBySeasonDescRoundNumberAsc()).thenReturn(List.of());
        when(newsRepo.existsByTitle(anyString())).thenReturn(true);

        new NewsSeeder(newsService, newsRepo, raceRepo).run();

        verify(newsRepo, never()).save(any(RaceNews.class));
    }
}
