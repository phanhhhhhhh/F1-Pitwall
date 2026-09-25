package backend;

import backend.model.Driver;
import backend.model.Race;
import backend.model.Team;
import backend.model.enums.RaceStatus;
import backend.repository.DriverRepository;
import backend.repository.RaceRepository;
import backend.repository.RaceResultRepository;
import backend.service.NotificationService;
import backend.service.RaceResultService;
import backend.dto.RaceResultRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("RaceResultService — submitResults orchestration")
class RaceResultServiceTest {

    @Mock RaceResultRepository raceResultRepo;
    @Mock RaceRepository raceRepo;
    @Mock DriverRepository driverRepo;
    @Mock NotificationService notificationService;

    @InjectMocks
    RaceResultService service;

    private Race race() {
        return Race.builder().id(1L).name("Australian Grand Prix").season(2026)
                .roundNumber(1).status(RaceStatus.SCHEDULED).build();
    }

    private Driver driver(long id, String name, Team team) {
        return Driver.builder().id(id).name(name).carNumber((int) id).team(team).build();
    }

    private Team team(long id, String name) {
        return Team.builder().id(id).name(name).colorHex("#000").build();
    }

    private RaceResultRequest req(long driverId, int finish, boolean fl) {
        var r = new RaceResultRequest();
        r.setDriverId(driverId);
        r.setFinishPosition(finish);
        r.setStartPosition(finish);
        r.setHasFastestLap(fl);
        return r;
    }

    @Nested
    @DisplayName("Duplicate fastest lap rejection")
    class DuplicateFastestLap {

        @Test
        @DisplayName("throws when two drivers are marked hasFastestLap=true")
        void rejectsDuplicateFastestLap() {
            when(raceRepo.findById(1L)).thenReturn(Optional.of(race()));

            var reqs = List.of(
                    req(1L, 1, false),
                    req(2L, 2, true),
                    req(3L, 3, true) // duplicate FL!
            );

            assertThatThrownBy(() -> service.submitResults(1L, reqs))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Only one driver can have fastest lap");
        }

        @Test
        @DisplayName("succeeds when exactly one driver has fastest lap")
        void acceptsSingleFastestLap() {
            when(raceRepo.findById(1L)).thenReturn(Optional.of(race()));
            Team t = team(1L, "McLaren");
            Driver d1 = driver(1L, "Norris", t);
            Driver d2 = driver(2L, "Piastri", t);
            when(driverRepo.findById(1L)).thenReturn(Optional.of(d1));
            when(driverRepo.findById(2L)).thenReturn(Optional.of(d2));
            when(raceResultRepo.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

            var req1 = req(1L, 1, true);
            req1.setFastestLapNumber(33);
            req1.setFastestLapTime(80.0f);
            var req2 = req(2L, 2, false);

            var reqs = List.of(req1, req2);

            var results = service.submitResults(1L, reqs);
            assertThat(results).hasSize(2);
            verify(driverRepo, atLeastOnce()).findById(anyLong());
        }
    }

    @Nested
    @DisplayName("Empty or edge-case results list")
    class EdgeCases {

        @Test
        @DisplayName("empty results list does not crash — saves empty list")
        void emptyResultsListDoesNotCrash() {
            when(raceRepo.findById(1L)).thenReturn(Optional.of(race()));
            when(raceResultRepo.saveAll(any())).thenReturn(List.of());

            var results = service.submitResults(1L, List.of());
            assertThat(results).isEmpty();
        }

        @Test
        @DisplayName("driver not found throws RuntimeException")
        void driverNotFoundThrows() {
            when(raceRepo.findById(1L)).thenReturn(Optional.of(race()));
            when(driverRepo.findById(999L)).thenReturn(Optional.empty());

            var reqs = List.of(req(999L, 1, false));

            assertThatThrownBy(() -> service.submitResults(1L, reqs))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Driver not found");
        }

        @Test
        @DisplayName("race not found throws RuntimeException")
        void raceNotFoundThrows() {
            when(raceRepo.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.submitResults(999L, List.of()))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Race not found");
        }
    }
}
