package backend;

import backend.config.seeder.TeamDriverSeeder;
import backend.model.Driver;
import backend.model.Team;
import backend.repository.DriverRepository;
import backend.repository.TeamRepository;
import backend.repository.TyreCompoundRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Regression tests for the 2026 grid seeding bug: the all-or-nothing team
 * guard left new 2026 drivers (Lindblad, Perez, Bottas) with null teams when
 * the 2025 seeder had already created part of the grid.
 */
@DisplayName("TeamDriverSeeder — per-name team creation & null-team backfill")
class TeamDriverSeederTest {

    private final TeamRepository teamRepo = mock(TeamRepository.class);
    private final DriverRepository driverRepo = mock(DriverRepository.class);
    private final TyreCompoundRepository tyreRepo = mock(TyreCompoundRepository.class);

    private Team team(String name) {
        return Team.builder().name(name).build();
    }

    @Test
    @DisplayName("creates only the missing grid teams when McLaren already exists")
    void createsOnlyMissingTeams() {
        Team mclaren = team("McLaren");
        when(teamRepo.findAll()).thenReturn(List.of(mclaren));
        when(teamRepo.findByName("McLaren")).thenReturn(Optional.of(mclaren));
        // Other grid teams don't exist yet
        when(teamRepo.findByName(any(String.class))).thenReturn(Optional.empty());
        when(tyreRepo.count()).thenReturn(5L);   // tyres already seeded
        when(driverRepo.findAll()).thenReturn(List.of());

        new TeamDriverSeeder(teamRepo, driverRepo, tyreRepo).seed();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Team>> captor = ArgumentCaptor.forClass(List.class);
        verify(teamRepo).saveAll(captor.capture());
        List<Team> saved = captor.getValue();
        assertThat(saved).hasSize(10); // 11-grid minus existing McLaren
        assertThat(saved).extracting(Team::getName)
                .contains("Racing Bulls", "Cadillac", "Audi", "Mercedes-AMG Petronas")
                .doesNotContain("McLaren");

        // Idempotency guard: already-seeded tyres are not re-saved
        verify(tyreRepo, never()).saveAll(any());
    }

    @Test
    @DisplayName("backfills the team of a driver that exists with team=null")
    void backfillsNullTeamDriver() {
        Team mclaren = team("McLaren");
        Team racingBulls = team("Racing Bulls");
        Team cadillac = team("Cadillac");
        when(teamRepo.findAll()).thenReturn(List.of(mclaren, racingBulls, cadillac));
        when(teamRepo.findByName(any(String.class))).thenReturn(Optional.empty());
        when(teamRepo.findByName("McLaren")).thenReturn(Optional.of(mclaren));
        when(teamRepo.findByName("Racing Bulls")).thenReturn(Optional.of(racingBulls));
        when(teamRepo.findByName("Cadillac")).thenReturn(Optional.of(cadillac));
        when(tyreRepo.count()).thenReturn(5L);

        Driver lindblad = Driver.builder().name("Arvid Lindblad").carNumber(41).team(null).build();
        when(driverRepo.findAll()).thenReturn(List.of(lindblad));
        when(driverRepo.findByCarNumber(41)).thenReturn(Optional.of(lindblad));

        new TeamDriverSeeder(teamRepo, driverRepo, tyreRepo).seed();

        assertThat(lindblad.getTeam()).isEqualTo(racingBulls);
        verify(driverRepo).save(lindblad);
    }

    @Test
    @DisplayName("leaves a driver's existing team untouched")
    void keepsExistingTeam() {
        Team mclaren = team("McLaren");
        when(teamRepo.findAll()).thenReturn(List.of(mclaren));
        when(teamRepo.findByName("McLaren")).thenReturn(Optional.of(mclaren));
        when(teamRepo.findByName(any(String.class))).thenReturn(Optional.empty());
        when(tyreRepo.count()).thenReturn(5L);

        Driver lawson = Driver.builder().name("Liam Lawson").carNumber(30).team(team("Red Bull Racing")).build();
        when(driverRepo.findAll()).thenReturn(List.of(lawson));
        when(driverRepo.findByCarNumber(30)).thenReturn(Optional.of(lawson));

        new TeamDriverSeeder(teamRepo, driverRepo, tyreRepo).seed();

        assertThat(lawson.getTeam().getName()).isEqualTo("Red Bull Racing");
        verify(driverRepo, never()).save(lawson);
    }
}
