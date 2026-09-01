package backend;

import backend.dto.StrategyPlanRequest;
import backend.dto.StrategyPlanResponse;
import backend.model.Race;
import backend.model.StrategyPlan;
import backend.repository.RaceRepository;
import backend.repository.StrategyPlanRepository;
import backend.service.StrategyPlanService;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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
@DisplayName("StrategyPlanService")
class StrategyPlanServiceTest {

    @Mock StrategyPlanRepository repository;
    @Mock RaceRepository raceRepository;

    @InjectMocks
    StrategyPlanService service;

    private static Race race(long id, String name) {
        Race r = new Race();
        r.setId(id);
        r.setName(name);
        return r;
    }

    private static StrategyPlanRequest twoStopRequest() {
        StrategyPlanRequest req = new StrategyPlanRequest();
        req.setPlanName("Undercut Leclerc");
        req.setNotes("Box lap 20, react to the pack");
        StrategyPlanRequest.StintRequest s1 = new StrategyPlanRequest.StintRequest();
        s1.setTyre("SOFT");
        s1.setLaps(20);
        StrategyPlanRequest.StintRequest s2 = new StrategyPlanRequest.StintRequest();
        s2.setTyre("MEDIUM");
        s2.setLaps(26);
        StrategyPlanRequest.StintRequest s3 = new StrategyPlanRequest.StintRequest();
        s3.setTyre("HARD");
        s3.setLaps(11);
        req.setStints(List.of(s1, s2, s3));
        return req;
    }

    @Nested
    @DisplayName("create")
    class Create {

        @Test
        @DisplayName("resolves the circuit's latest race and derives stop count, compounds and pit laps")
        void derivesFieldsFromStints() {
            Race melbourne = race(7L, "Australian Grand Prix");
            when(raceRepository.findByCircuitIdWithCircuit(3L)).thenReturn(List.of(melbourne));
            when(repository.save(any(StrategyPlan.class))).thenAnswer(inv -> inv.getArgument(0));

            StrategyPlanResponse res = service.create(3L, twoStopRequest());

            assertThat(res.getPlannedStops()).isEqualTo(2);
            assertThat(res.getPlannedCompounds()).isEqualTo("SOFT,MEDIUM,HARD");
            assertThat(res.getRaceId()).isEqualTo(7L);
            assertThat(res.getRaceName()).isEqualTo("Australian Grand Prix");
            assertThat(res.getStints()).hasSize(3);
            assertThat(res.getStints().get(0).getTyre()).isEqualTo("SOFT");
            assertThat(res.getStints().get(0).getLaps()).isEqualTo(20);

            ArgumentCaptor<StrategyPlan> captor = ArgumentCaptor.forClass(StrategyPlan.class);
            verify(repository).save(captor.capture());
            // Pit laps are the running total up to (not including) the final stint.
            assertThat(captor.getValue().getPitLap1()).isEqualTo(20);
            assertThat(captor.getValue().getPitLap2()).isEqualTo(46);
            assertThat(captor.getValue().getPitLap3()).isEqualTo(0);
            assertThat(captor.getValue().getRace()).isSameAs(melbourne);
        }

        @Test
        @DisplayName("a single-stint (no-stop) plan derives zero stops and no pit laps")
        void noStopStrategy() {
            when(raceRepository.findByCircuitIdWithCircuit(3L)).thenReturn(List.of(race(7L, "Race")));
            when(repository.save(any(StrategyPlan.class))).thenAnswer(inv -> inv.getArgument(0));

            StrategyPlanRequest req = new StrategyPlanRequest();
            req.setPlanName("Nurse it home");
            StrategyPlanRequest.StintRequest only = new StrategyPlanRequest.StintRequest();
            only.setTyre("HARD");
            only.setLaps(57);
            req.setStints(List.of(only));

            StrategyPlanResponse res = service.create(3L, req);

            assertThat(res.getPlannedStops()).isEqualTo(0);
            assertThat(res.getStints()).hasSize(1);
        }

        @Test
        @DisplayName("rejects a circuit with no race on record")
        void noRaceForCircuit() {
            when(raceRepository.findByCircuitIdWithCircuit(99L)).thenReturn(List.of());

            assertThatThrownBy(() -> service.create(99L, twoStopRequest()))
                    .isInstanceOf(EntityNotFoundException.class);

            verifyNoInteractions(repository);
        }
    }

    @Nested
    @DisplayName("listForCircuit")
    class ListForCircuit {

        @Test
        @DisplayName("returns an empty list when the circuit has no race yet")
        void emptyWhenNoRace() {
            when(raceRepository.findByCircuitIdWithCircuit(5L)).thenReturn(List.of());

            assertThat(service.listForCircuit(5L)).isEmpty();
            verifyNoInteractions(repository);
        }

        @Test
        @DisplayName("round-trips saved stints back out through the JSON column")
        void roundTripsStints() {
            Race r = race(7L, "Race");
            when(raceRepository.findByCircuitIdWithCircuit(3L)).thenReturn(List.of(r));

            StrategyPlan saved = new StrategyPlan();
            saved.setId(1L);
            saved.setPlanName("Saved plan");
            saved.setStintsJson("[{\"tyre\":\"SOFT\",\"laps\":20},{\"tyre\":\"HARD\",\"laps\":37}]");
            saved.setRace(r);
            when(repository.findByRaceIdOrderByIdDesc(7L)).thenReturn(List.of(saved));

            List<StrategyPlanResponse> res = service.listForCircuit(3L);

            assertThat(res).hasSize(1);
            assertThat(res.get(0).getStints()).extracting(
                    StrategyPlanResponse.StintResponse::getTyre,
                    StrategyPlanResponse.StintResponse::getLaps
            ).containsExactly(
                    org.assertj.core.groups.Tuple.tuple("SOFT", 20),
                    org.assertj.core.groups.Tuple.tuple("HARD", 37)
            );
        }
    }

    @Nested
    @DisplayName("update / delete")
    class UpdateDelete {

        @Test
        @DisplayName("update throws when the plan does not exist")
        void updateMissing() {
            when(repository.findById(42L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.update(42L, twoStopRequest()))
                    .isInstanceOf(EntityNotFoundException.class);
        }

        @Test
        @DisplayName("update re-derives fields on the existing plan and keeps its race")
        void updateExisting() {
            Race r = race(7L, "Race");
            StrategyPlan existing = new StrategyPlan();
            existing.setId(42L);
            existing.setRace(r);
            when(repository.findById(42L)).thenReturn(Optional.of(existing));
            when(repository.save(any(StrategyPlan.class))).thenAnswer(inv -> inv.getArgument(0));

            StrategyPlanResponse res = service.update(42L, twoStopRequest());

            assertThat(res.getPlanName()).isEqualTo("Undercut Leclerc");
            assertThat(res.getRaceId()).isEqualTo(7L);
        }

        @Test
        @DisplayName("delete throws when the plan does not exist")
        void deleteMissing() {
            when(repository.existsById(anyLong())).thenReturn(false);

            assertThatThrownBy(() -> service.delete(42L)).isInstanceOf(EntityNotFoundException.class);
            verify(repository, never()).deleteById(any());
        }

        @Test
        @DisplayName("delete removes an existing plan")
        void deleteExisting() {
            when(repository.existsById(42L)).thenReturn(true);

            service.delete(42L);

            verify(repository).deleteById(42L);
        }
    }
}
