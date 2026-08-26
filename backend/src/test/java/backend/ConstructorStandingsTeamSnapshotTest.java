package backend;

import backend.dto.ConstructorStandingResponse;
import backend.model.Driver;
import backend.model.Race;
import backend.model.RaceResult;
import backend.model.Team;
import backend.model.enums.RaceStatus;
import backend.repository.DriverRepository;
import backend.repository.RaceRepository;
import backend.repository.RaceResultRepository;
import backend.service.NotificationService;
import backend.service.RaceResultService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Constructor standings must sum points by the team the driver raced for in
 * each race (RaceResult.team snapshot), not the driver's current team tag —
 * drivers can move mid-season.
 */
@DisplayName("Constructor standings — per-result team snapshot")
class ConstructorStandingsTeamSnapshotTest {

    private final RaceResultRepository raceResultRepo = mock(RaceResultRepository.class);

    private RaceResultService service;

    @BeforeEach
    void setUp() {
        service = new RaceResultService(
                raceResultRepo,
                mock(RaceRepository.class),
                mock(DriverRepository.class),
                mock(NotificationService.class));
    }

    private long teamSeq = 1;

    private Team team(String name) {
        return Team.builder().id(teamSeq++).name(name).colorHex("#666").build();
    }

    private Race race() {
        return Race.builder().id(1L).name("Test Grand Prix")
                .season(2026).roundNumber(15).status(RaceStatus.COMPLETED).build();
    }

    @Test
    @DisplayName("points go to the team in the snapshot, not the driver's current tag")
    void pointsFollowResultSnapshot() {
        Team rbr = team("Red Bull Racing");
        Team rb = team("Racing Bulls");

        // Lawson tagged Racing Bulls today but raced for Red Bull in this race
        RaceResult lawson = RaceResult.builder().race(race())
                .driver(Driver.builder().name("Liam Lawson").team(rb).build())
                .team(rbr)
                .finishPosition(1).points(25f).dnfReason(null).build();
        // Verstappen: tag and snapshot agree
        RaceResult max = RaceResult.builder().race(race())
                .driver(Driver.builder().name("Max Verstappen").team(rbr).build())
                .team(rbr)
                .finishPosition(2).points(18f).dnfReason(null).build();
        // Tsunoda tagged Red Bull but raced for Racing Bulls
        RaceResult yuki = RaceResult.builder().race(race())
                .driver(Driver.builder().name("Yuki Tsunoda").team(rbr).build())
                .team(rb)
                .finishPosition(3).points(15f).dnfReason(null).build();

        when(raceResultRepo.findByRaceSeasonAndRaceStatus(2026, RaceStatus.COMPLETED))
                .thenReturn(List.of(lawson, max, yuki));

        List<ConstructorStandingResponse> standings = service.getConstructorStandings(2026);

        assertThat(standings).hasSize(2);
        ConstructorStandingResponse rbrRow = standings.stream()
                .filter(s -> s.getTeamName().equals("Red Bull Racing")).findFirst().orElseThrow();
        ConstructorStandingResponse rbRow = standings.stream()
                .filter(s -> s.getTeamName().equals("Racing Bulls")).findFirst().orElseThrow();

        assertThat(rbrRow.getTotalPoints()).isEqualTo(43f); // 25 (Lawson) + 18 (Max)
        assertThat(rbRow.getTotalPoints()).isEqualTo(15f);  // Yuki's Racing Bulls race
    }

    @Test
    @DisplayName("legacy rows without a snapshot fall back to the driver's team")
    void legacyRowsFallBackToDriverTeam() {
        Team rbr = team("Red Bull Racing");

        RaceResult legacy = RaceResult.builder().race(race())
                .driver(Driver.builder().name("Isack Hadjar").team(rbr).build())
                .team(null) // pre-snapshot data
                .finishPosition(5).points(10f).dnfReason(null).build();

        when(raceResultRepo.findByRaceSeasonAndRaceStatus(2026, RaceStatus.COMPLETED))
                .thenReturn(List.of(legacy));

        List<ConstructorStandingResponse> standings = service.getConstructorStandings(2026);

        assertThat(standings).hasSize(1);
        assertThat(standings.get(0).getTeamName()).isEqualTo("Red Bull Racing");
        assertThat(standings.get(0).getTotalPoints()).isEqualTo(10f);
    }
}
