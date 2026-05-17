package backend.controller;

import backend.dto.*;
import backend.service.RaceResultService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/race-results")
@RequiredArgsConstructor
public class RaceResultController {

    private final RaceResultService raceResultService;

    @PostMapping("/race/{raceId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<RaceResultResponse>> submitResults(
            @PathVariable Long raceId,
            @RequestBody List<RaceResultRequest> requests) {
        return ResponseEntity.ok(raceResultService.submitResults(raceId, requests));
    }

    @GetMapping("/race/{raceId}")
    public ResponseEntity<List<RaceResultResponse>> getResultsByRace(@PathVariable Long raceId) {
        return ResponseEntity.ok(raceResultService.getResultsByRace(raceId));
    }

    /**
     * Bulk winners endpoint — 1 call thay vì N calls
     * Frontend dùng endpoint này để hiển thị winner trên Race Calendar và Overview
     * Response: Map<raceName, RaceWinnerResponse>
     */
    @GetMapping("/winners/{season}")
    public ResponseEntity<Map<String, RaceWinnerResponse>> getSeasonWinners(@PathVariable int season) {
        return ResponseEntity.ok(raceResultService.getSeasonWinners(season));
    }

    @GetMapping("/standings/drivers/{season}")
    public ResponseEntity<List<DriverStandingResponse>> getDriverStandings(@PathVariable int season) {
        return ResponseEntity.ok(raceResultService.getDriverStandings(season));
    }

    @GetMapping("/standings/constructors/{season}")
    public ResponseEntity<List<ConstructorStandingResponse>> getConstructorStandings(@PathVariable int season) {
        return ResponseEntity.ok(raceResultService.getConstructorStandings(season));
    }
}
