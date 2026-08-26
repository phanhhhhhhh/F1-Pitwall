package backend;

import backend.dto.RaceNewsResponse;
import backend.model.Driver;
import backend.model.Race;
import backend.model.RaceNews;
import backend.model.RaceResult;
import backend.model.Team;
import backend.repository.RaceNewsRepository;
import backend.repository.RaceRepository;
import backend.repository.RaceResultRepository;
import backend.service.RaceNewsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@DisplayName("RaceNewsService")
class RaceNewsServiceTest {

    private final RaceNewsRepository newsRepo = mock(RaceNewsRepository.class);
    private final RaceRepository raceRepo = mock(RaceRepository.class);
    private final RaceResultRepository raceResultRepo = mock(RaceResultRepository.class);

    private RaceNewsService service;

    @BeforeEach
    void setUp() {
        service = new RaceNewsService(newsRepo, raceRepo, raceResultRepo);
    }

    private Team team(String name) {
        return Team.builder().name(name).build();
    }

    private Driver driver(String name, Team team) {
        return Driver.builder().name(name).team(team).build();
    }

    private Race race() {
        return Race.builder().id(1L).name("Australian Grand Prix")
                .season(2025).roundNumber(1).build();
    }

    private List<RaceResult> sampleResults() {
        Team mclaren = team("McLaren");
        return List.of(
                RaceResult.builder().race(race()).driver(driver("Oscar Piastri", mclaren))
                        .finishPosition(1).points(25f).hasFastestLap(false).fastestLapTime(0f)
                        .dnfReason(null).build(),
                RaceResult.builder().race(race()).driver(driver("Lando Norris", mclaren))
                        .finishPosition(2).points(18f).hasFastestLap(true).fastestLapTime(80.235f)
                        .dnfReason(null).build(),
                RaceResult.builder().race(race()).driver(driver("Max Verstappen", team("Red Bull Racing")))
                        .finishPosition(3).points(15f).hasFastestLap(false).fastestLapTime(0f)
                        .dnfReason(null).build(),
                RaceResult.builder().race(race()).driver(driver("Carlos Sainz", team("Williams")))
                        .finishPosition(0).points(0f).hasFastestLap(false).fastestLapTime(0f)
                        .dnfReason("Retired").build()
        );
    }

    @Test
    @DisplayName("generates a report with winner, podium, fastest lap and DNFs")
    void generatesRaceReport() {
        when(raceResultRepo.findByRaceIdOrderByFinishPosition(1L)).thenReturn(sampleResults());
        when(newsRepo.findByRaceIdAndTag(1L, RaceNewsService.TAG_RACE_REPORT))
                .thenReturn(Optional.empty());

        service.generateRaceReport(race());

        ArgumentCaptor<RaceNews> captor = ArgumentCaptor.forClass(RaceNews.class);
        verify(newsRepo).save(captor.capture());
        RaceNews saved = captor.getValue();
        assertThat(saved.getTitle()).contains("Australian Grand Prix 2025");
        assertThat(saved.getTag()).isEqualTo(RaceNewsService.TAG_RACE_REPORT);
        assertThat(saved.getContent())
                .contains("Oscar Piastri", "PODIUM", "Lando Norris", "Max Verstappen",
                        "FASTEST LAP", "80.235s", "DID NOT FINISH", "Carlos Sainz", "Retired");
    }

    @Test
    @DisplayName("upserts the report when one already exists for the race")
    void upsertsExistingReport() {
        when(raceResultRepo.findByRaceIdOrderByFinishPosition(1L)).thenReturn(sampleResults());
        RaceNews existing = RaceNews.builder().race(race())
                .title("old title").tag(RaceNewsService.TAG_RACE_REPORT).content("old").build();
        when(newsRepo.findByRaceIdAndTag(1L, RaceNewsService.TAG_RACE_REPORT))
                .thenReturn(Optional.of(existing));

        service.generateRaceReport(race());

        verify(newsRepo).save(existing);
        assertThat(existing.getTitle()).contains("Australian Grand Prix 2025");
        assertThat(existing.getContent()).contains("Oscar Piastri");
    }

    @Test
    @DisplayName("skips sprint races")
    void skipsSprintRaces() {
        Race sprint = Race.builder().id(2L).name("Chinese Grand Prix Sprint")
                .season(2025).roundNumber(2).build();

        service.generateRaceReport(sprint);

        verifyNoInteractions(raceResultRepo);
        verify(newsRepo, never()).findByRaceIdAndTag(anyLong(), any());
    }

    @Test
    @DisplayName("skips races without results")
    void skipsRacesWithoutResults() {
        when(raceResultRepo.findByRaceIdOrderByFinishPosition(1L)).thenReturn(List.of());

        service.generateRaceReport(race());

        verify(newsRepo, never()).findByRaceIdAndTag(anyLong(), any());
        verify(newsRepo, never()).save(any());
    }

    @Test
    @DisplayName("lists news by season mapped to flattened DTOs")
    void listsBySeason() {
        RaceNews news = RaceNews.builder().race(race())
                .title("t").content("c").tag("X").build();
        when(newsRepo.findByRaceSeasonOrderByRaceDateDescIdDesc(2025)).thenReturn(List.of(news));

        List<RaceNewsResponse> list = service.listBySeason(2025);

        assertThat(list).hasSize(1);
        RaceNewsResponse dto = list.get(0);
        assertThat(dto.getRaceName()).isEqualTo("Australian Grand Prix");
        assertThat(dto.getRoundNumber()).isEqualTo(1);
        assertThat(dto.getSeason()).isEqualTo(2025);
        assertThat(dto.getTag()).isEqualTo("X");
    }

    @Test
    @DisplayName("getById throws EntityNotFoundException for unknown ids")
    void getByIdThrowsForUnknownId() {
        when(newsRepo.findByIdWithRace(99L)).thenReturn(Optional.empty());

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.getById(99L))
                .isInstanceOf(jakarta.persistence.EntityNotFoundException.class);
    }
}
