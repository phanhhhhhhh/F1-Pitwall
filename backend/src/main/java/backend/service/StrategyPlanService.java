package backend.service;

import backend.dto.StrategyPlanRequest;
import backend.dto.StrategyPlanResponse;
import backend.model.Race;
import backend.model.StrategyPlan;
import backend.repository.RaceRepository;
import backend.repository.StrategyPlanRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * Persists the pit strategies the /strategy simulator lets an engineer build, so they can be
 * saved and reloaded rather than lost on every page refresh.
 *
 * <p>Plans are keyed by circuit from the frontend's point of view — the simulator only lets a
 * viewer pick a circuit, not a specific race weekend — and resolved server-side to that
 * circuit's most recent race. A circuit with no race on record yet has nowhere to attach a
 * plan to, so saving is rejected until one exists.
 */
@Service
@RequiredArgsConstructor
public class StrategyPlanService {

    private static final ObjectMapper JSON = new ObjectMapper();

    private final StrategyPlanRepository repository;
    private final RaceRepository raceRepository;

    @Transactional(readOnly = true)
    public List<StrategyPlanResponse> listForCircuit(Long circuitId) {
        Race race = latestRaceForCircuit(circuitId);
        if (race == null) return List.of();
        return repository.findByRaceIdOrderByIdDesc(race.getId()).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public StrategyPlanResponse create(Long circuitId, StrategyPlanRequest request) {
        Race race = latestRaceForCircuit(circuitId);
        if (race == null) {
            throw new EntityNotFoundException("No race on record for circuit: " + circuitId);
        }

        StrategyPlan plan = new StrategyPlan();
        plan.setRace(race);
        applyRequest(plan, request);
        return toResponse(repository.save(plan));
    }

    @Transactional
    public StrategyPlanResponse update(Long id, StrategyPlanRequest request) {
        StrategyPlan plan = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Strategy plan not found: " + id));
        applyRequest(plan, request);
        return toResponse(repository.save(plan));
    }

    @Transactional
    public void delete(Long id) {
        if (!repository.existsById(id)) {
            throw new EntityNotFoundException("Strategy plan not found: " + id);
        }
        repository.deleteById(id);
    }

    private Race latestRaceForCircuit(Long circuitId) {
        List<Race> races = raceRepository.findByCircuitIdWithCircuit(circuitId);
        return races.isEmpty() ? null : races.get(0);
    }

    private void applyRequest(StrategyPlan plan, StrategyPlanRequest request) {
        List<StrategyPlanRequest.StintRequest> stints = request.getStints();

        plan.setPlanName(request.getPlanName());
        plan.setNotes(request.getNotes());
        plan.setPlannedStops(Math.max(0, stints.size() - 1));
        plan.setPlannedCompounds(String.join(",", stints.stream().map(StrategyPlanRequest.StintRequest::getTyre).toList()));
        plan.setStintsJson(writeJson(stints));

        List<Integer> pitLaps = cumulativePitLaps(stints);
        plan.setPitLapsJson(writeJson(pitLaps));
        plan.setPitLap1(pitLaps.size() > 0 ? pitLaps.get(0) : 0);
        plan.setPitLap2(pitLaps.size() > 1 ? pitLaps.get(1) : 0);
        plan.setPitLap3(pitLaps.size() > 2 ? pitLaps.get(2) : 0);
    }

    /** The lap each pit stop happens on: the running total of laps up to (not including) the last stint. */
    private List<Integer> cumulativePitLaps(List<StrategyPlanRequest.StintRequest> stints) {
        List<Integer> laps = new ArrayList<>();
        int total = 0;
        for (int i = 0; i < stints.size() - 1; i++) {
            total += stints.get(i).getLaps();
            laps.add(total);
        }
        return laps;
    }

    private StrategyPlanResponse toResponse(StrategyPlan plan) {
        List<StrategyPlanResponse.StintResponse> stints = readStints(plan.getStintsJson());
        Race race = plan.getRace();
        return StrategyPlanResponse.builder()
                .id(plan.getId())
                .planName(plan.getPlanName())
                .notes(plan.getNotes())
                .executed(plan.isExecuted())
                .plannedStops(plan.getPlannedStops())
                .plannedCompounds(plan.getPlannedCompounds())
                .stints(stints)
                .raceId(race != null ? race.getId() : null)
                .raceName(race != null ? race.getName() : null)
                .build();
    }

    private List<StrategyPlanResponse.StintResponse> readStints(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            List<StrategyPlanRequest.StintRequest> raw =
                    JSON.readValue(json, new TypeReference<List<StrategyPlanRequest.StintRequest>>() {});
            return raw.stream()
                    .map(s -> new StrategyPlanResponse.StintResponse(s.getTyre(), s.getLaps()))
                    .toList();
        } catch (JsonProcessingException e) {
            return List.of();
        }
    }

    private String writeJson(Object value) {
        try {
            return JSON.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialise strategy plan data", e);
        }
    }
}
