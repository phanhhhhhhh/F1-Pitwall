package backend.controller;

import backend.dto.ConstructorStandingResponse;
import backend.dto.DriverStandingResponse;
import backend.service.SprintStandingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/standings/sprint")
@RequiredArgsConstructor
public class SprintStandingsController {

    private final SprintStandingsService sprintStandingsService;

    @GetMapping("/drivers/{season}")
    public ResponseEntity<List<DriverStandingResponse>> getDriverStandings(@PathVariable int season) {
        return ResponseEntity.ok(sprintStandingsService.getDriverStandings(season));
    }

    @GetMapping("/constructors/{season}")
    public ResponseEntity<List<ConstructorStandingResponse>> getConstructorStandings(@PathVariable int season) {
        return ResponseEntity.ok(sprintStandingsService.getConstructorStandings(season));
    }
}
