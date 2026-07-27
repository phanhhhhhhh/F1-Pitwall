package backend;

import backend.dto.DriverStandingResponse;
import backend.model.Driver;
import backend.model.Race;
import backend.model.RaceResult;
import backend.model.Team;
import backend.model.enums.RaceStatus;
import backend.repository.RaceResultRepository;
import backend.service.SprintStandingsService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("SprintStandingsService — tie-break sorting logic")
class SprintStandingsServiceTest {

    @Mock RaceResultRepository raceResultRepo;
    @InjectMocks SprintStandingsService service;

    private static Team mclaren = Team.builder().id(1L).name("McLaren").colorHex("#FF8000").build();
    private static Team ferrari = Team.builder().id(2L).name("Ferrari").colorHex("#E8002D").build();

    private Driver d(long id, String name, Team team) {
        return Driver.builder().id(id).name(name).carNumber((int) id).team(team).build();
    }

    private Race sprintRace(String name, RaceStatus status) {
        return Race.builder().name(name).season(2026).roundNumber(1).status(status).build();
    }

    private RaceResult rr(Driver driver, Race race, int finish, float points, String dnf) {
        return RaceResult.builder()
                .driver(driver).race(race)
                .finishPosition(finish).points(points).dnfReason(dnf)
                .hasFastestLap(false).build();
    }

    @Nested
    @DisplayName("Driver standings sorting")
    class DriverStandingsSorting {

        @Test
        @DisplayName("higher points rank first")
        void higherPointsRanksFirst() {
            var race = sprintRace("Miami Grand Prix Sprint", RaceStatus.COMPLETED);
            Driver lando = d(1L, "Lando Norris", mclaren);
            Driver lewis = d(2L, "Lewis Hamilton", ferrari);

            when(raceResultRepo.findByRaceSeasonAndRaceStatus(2026, RaceStatus.COMPLETED))
                    .thenReturn(List.of(
                            rr(lando, race, 1, 8.0f, null),
                            rr(lewis, race, 2, 7.0f, null)));

            List<DriverStandingResponse> standings = service.getDriverStandings(2026);
            assertThat(standings).hasSize(2);
            assertThat(standings.get(0).getDriverName()).isEqualTo("Lando Norris");
            assertThat(standings.get(1).getDriverName()).isEqualTo("Lewis Hamilton");
        }

        @Test
        @DisplayName("tied on points → more wins ranks first")
        void winsBreakTieOnPoints() {
            var race1 = sprintRace("Miami Grand Prix Sprint", RaceStatus.COMPLETED);
            var race2 = sprintRace("Chinese Grand Prix Sprint", RaceStatus.COMPLETED);
            Driver lando = d(1L, "Lando Norris", mclaren);
            Driver lewis = d(2L, "Lewis Hamilton", ferrari);

            when(raceResultRepo.findByRaceSeasonAndRaceStatus(2026, RaceStatus.COMPLETED))
                    .thenReturn(List.of(
                            rr(lewis, race1, 1, 8.0f, null),  // Lewis: 1 win, 8 pts
                            rr(lando, race2, 3, 6.0f, null),  // Lando: 0 wins
                            rr(lewis, race2, 4, 5.0f, null),  // Lewis: 13 total
                            rr(lando, race1, 1, 8.0f, null))); // Lando: 1 win, 14 pts

            List<DriverStandingResponse> standings = service.getDriverStandings(2026);
            assertThat(standings).hasSize(2);
            // Lando: 14 pts, 1 win. Lewis: 13 pts, 1 win. → Lando first (more points)
            assertThat(standings.get(0).getDriverName()).isEqualTo("Lando Norris");
        }

        @Test
        @DisplayName("tied on points + wins → more podiums ranks first")
        void podiumsBreakTieOnPointsAndWins() {
            var race1 = sprintRace("Miami Grand Prix Sprint", RaceStatus.COMPLETED);
            var race2 = sprintRace("Chinese Grand Prix Sprint", RaceStatus.COMPLETED);
            var race3 = sprintRace("British Grand Prix Sprint", RaceStatus.COMPLETED);
            Driver lando = d(1L, "Lando Norris", mclaren);
            Driver lewis = d(2L, "Lewis Hamilton", ferrari);

            when(raceResultRepo.findByRaceSeasonAndRaceStatus(2026, RaceStatus.COMPLETED))
                    .thenReturn(List.of(
                            rr(lewis, race1, 1, 8.0f, null),  // Lewis: 1W, 1P, 8pts
                            rr(lando, race2, 1, 8.0f, null),  // Lando: 1W, 1P, 8pts
                            rr(lewis, race3, 3, 6.0f, null),  // Lewis: 1W, 2P, 14pts
                            rr(lando, race3, 2, 7.0f, null))); // Lando: 1W, 2P, 15pts

            List<DriverStandingResponse> standings = service.getDriverStandings(2026);
            assertThat(standings).hasSize(2);
            // Lando: 15 pts, 1 win, 2 podiums. Lewis: 14 pts.
            assertThat(standings.get(0).getDriverName()).isEqualTo("Lando Norris");
        }

        @Test
        @DisplayName("DNF scores zero and does not count as win/podium")
        void dnfDoesNotCountForWinsOrPodiums() {
            var race = sprintRace("Miami Grand Prix Sprint", RaceStatus.COMPLETED);
            Driver dnfGuy = d(1L, "DNF Driver", mclaren);
            Driver finisher = d(2L, "Finisher", ferrari);

            when(raceResultRepo.findByRaceSeasonAndRaceStatus(2026, RaceStatus.COMPLETED))
                    .thenReturn(List.of(
                            rr(dnfGuy, race, 20, 0.0f, "Engine failure"),
                            rr(finisher, race, 1, 8.0f, null)));

            List<DriverStandingResponse> standings = service.getDriverStandings(2026);
            assertThat(standings).hasSize(2);
            assertThat(standings.get(0).getDriverName()).isEqualTo("Finisher");
            assertThat(standings.get(0).getWins()).isEqualTo(1);
            assertThat(standings.get(1).getWins()).isEqualTo(0);
        }
    }
}
