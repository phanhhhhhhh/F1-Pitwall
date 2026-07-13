package backend.controller;

import backend.dto.IncidentResponse;
import backend.dto.PitStopResponse;
import backend.dto.WeatherResponse;
import backend.model.Race;
import backend.model.enums.RaceStatus;
import backend.repository.IncidentRepository;
import backend.repository.PitStopRepository;
import backend.repository.WeatherConditionRepository;
import backend.service.RaceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/races")
@RequiredArgsConstructor
public class RaceController {
    private final RaceService raceService;
    private final PitStopRepository pitStopRepo;
    private final IncidentRepository incidentRepo;
    private final WeatherConditionRepository weatherRepo;

    @GetMapping
    public List<Race> getAll() { return raceService.getAll(); }

    @GetMapping("/{id}")
    public Race getById(@PathVariable Long id) { return raceService.getById(id); }

    @GetMapping("/season/{season}")
    public List<Race> getBySeason(@PathVariable int season) { return raceService.getBySeason(season); }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Race> create(
            @RequestBody Race race,
            @RequestParam Long circuitId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(raceService.create(race, circuitId));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','ENGINEER')")
    public Race updateStatus(@PathVariable Long id, @RequestParam RaceStatus status) {
        return raceService.updateStatus(id, status);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        raceService.delete(id);
        return ResponseEntity.ok(Map.of("message", "Race deleted"));
    }

    @GetMapping("/{raceId}/pit-stops")
    public ResponseEntity<List<PitStopResponse>> getPitStops(@PathVariable Long raceId) {
        List<PitStopResponse> result = pitStopRepo.findByRaceIdWithDriver(raceId).stream()
                .map(ps -> PitStopResponse.builder()
                        .id(ps.getId())
                        .lapNumber(ps.getLapNumber())
                        .driverName(ps.getRaceResult() != null && ps.getRaceResult().getDriver() != null
                                ? ps.getRaceResult().getDriver().getName() : "Unknown")
                        .teamName(ps.getRaceResult() != null && ps.getRaceResult().getDriver() != null
                                && ps.getRaceResult().getDriver().getTeam() != null
                                ? ps.getRaceResult().getDriver().getTeam().getName() : "")
                        .teamColor(ps.getRaceResult() != null && ps.getRaceResult().getDriver() != null
                                && ps.getRaceResult().getDriver().getTeam() != null
                                ? ps.getRaceResult().getDriver().getTeam().getColorHex() : "#666")
                        .tyreCompound(ps.getTyreOut() != null ? ps.getTyreOut().name() : "")
                        .durationMs(ps.getDurationSec() * 1000.0)
                        .build())
                .toList();
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{raceId}/incidents")
    public ResponseEntity<List<IncidentResponse>> getIncidents(@PathVariable Long raceId) {
        List<IncidentResponse> result = incidentRepo.findByRaceIdOrderByLap(raceId).stream()
                .map(inc -> IncidentResponse.builder()
                        .id(inc.getId())
                        .lap(inc.getLap())
                        .driverName("")  // Incident entity has no driver link
                        .teamName("")
                        .type(inc.getType() != null ? inc.getType().name() : "INCIDENT")
                        .description(inc.getDescription() != null ? inc.getDescription() : "")
                        .build())
                .toList();
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{raceId}/weather")
    public ResponseEntity<List<WeatherResponse>> getWeather(@PathVariable Long raceId) {
        List<WeatherResponse> result = weatherRepo.findByRaceIdOrderById(raceId).stream()
                .map(w -> WeatherResponse.builder()
                        .lap(0) // WeatherCondition doesn't track lap
                        .condition(w.getCondition() != null ? w.getCondition().name() : "DRY")
                        .trackTempC(w.getTrackTempC())
                        .build())
                .toList();
        return ResponseEntity.ok(result);
    }
}
