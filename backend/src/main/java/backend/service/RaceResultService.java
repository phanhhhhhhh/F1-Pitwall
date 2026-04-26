package backend.service;

import backend.dto.*;
import backend.model.*;
import backend.model.enums.RaceStatus;
import backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RaceResultService {

    private final RaceResultRepository raceResultRepo;
    private final RaceRepository raceRepo;
    private final DriverRepository driverRepo;

    // Official F1 2026 points system
    private static final float[] POINTS = { 25, 18, 15, 12, 10, 8, 6, 4, 2, 1 };
    private static final float FASTEST_LAP_POINT = 1.0f;

    // ─── Submit race results ────────────────────────────────────────────────

    @Transactional
    public List<RaceResultResponse> submitResults(Long raceId, List<RaceResultRequest> requests) {
        Race race = raceRepo.findById(raceId)
                .orElseThrow(() -> new RuntimeException("Race not found: " + raceId));

        // Delete existing results for this race (allow re-submission)
        raceResultRepo.deleteByRaceId(raceId);

        List<RaceResult> results = new ArrayList<>();

        for (RaceResultRequest req : requests) {
            Driver driver = driverRepo.findById(req.getDriverId())
                    .orElseThrow(() -> new RuntimeException("Driver not found: " + req.getDriverId()));

            float points = calculatePoints(req.getFinishPosition(), req.isHasFastestLap(), req.getDnfReason());

            RaceResult result = RaceResult.builder()
                    .race(race)
                    .driver(driver)
                    .startPosition(req.getStartPosition())
                    .finishPosition(req.getFinishPosition())
                    .points(points)
                    .hasFastestLap(req.isHasFastestLap())
                    .fastestLapNumber(req.getFastestLapNumber())
                    .fastestLapTime(req.getFastestLapTime())
                    .dnfReason(req.getDnfReason())
                    .build();

            results.add(result);
        }

        // Mark race as COMPLETED
        race.setStatus(RaceStatus.COMPLETED);
        raceRepo.save(race);

        List<RaceResult> saved = raceResultRepo.saveAll(results);
        return saved.stream().map(this::toResponse).collect(Collectors.toList());
    }

    // ─── Get results for a race ─────────────────────────────────────────────

    public List<RaceResultResponse> getResultsByRace(Long raceId) {
        return raceResultRepo.findByRaceIdOrderByFinishPosition(raceId)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    // ─── Driver Championship Standings ─────────────────────────────────────

    public List<DriverStandingResponse> getDriverStandings(int season) {
        List<RaceResult> allResults = raceResultRepo.findByRaceSeasonAndRaceStatus(season, RaceStatus.COMPLETED);

        // Group by driver, aggregate stats
        Map<Long, DriverStats> statsMap = new LinkedHashMap<>();

        for (RaceResult r : allResults) {
            Long driverId = r.getDriver().getId();
            DriverStats stats = statsMap.computeIfAbsent(driverId, k -> new DriverStats(r.getDriver()));
            stats.totalPoints += r.getPoints();
            if (r.getFinishPosition() == 1) stats.wins++;
            if (r.getFinishPosition() <= 3 && r.getDnfReason() == null) stats.podiums++;
            if (r.isHasFastestLap()) stats.fastestLaps++;
        }

        // Sort by total points descending
        List<DriverStats> sorted = statsMap.values().stream()
                .sorted(Comparator.comparingDouble((DriverStats s) -> s.totalPoints).reversed())
                .collect(Collectors.toList());

        float leaderPoints = sorted.isEmpty() ? 0 : sorted.get(0).totalPoints;
        float prevPoints = leaderPoints;

        List<DriverStandingResponse> standings = new ArrayList<>();
        for (int i = 0; i < sorted.size(); i++) {
            DriverStats s = sorted.get(i);
            Driver d = s.driver;
            standings.add(DriverStandingResponse.builder()
                    .position(i + 1)
                    .driverId(d.getId())
                    .driverName(d.getName())
                    .carNumber(d.getCarNumber())
                    .nationality(d.getNationality())
                    .teamName(d.getTeam() != null ? d.getTeam().getName() : "")
                    .teamColor(d.getTeam() != null ? d.getTeam().getColorHex() : "#666")
                    .totalPoints(s.totalPoints)
                    .wins(s.wins)
                    .podiums(s.podiums)
                    .fastestLaps(s.fastestLaps)
                    .gapToLeader(leaderPoints - s.totalPoints)
                    .gapToAhead(prevPoints - s.totalPoints)
                    .build());
            prevPoints = s.totalPoints;
        }

        return standings;
    }

    // ─── Constructor Championship Standings ────────────────────────────────

    public List<ConstructorStandingResponse> getConstructorStandings(int season) {
        List<RaceResult> allResults = raceResultRepo.findByRaceSeasonAndRaceStatus(season, RaceStatus.COMPLETED);

        Map<Long, ConstructorStats> statsMap = new LinkedHashMap<>();

        for (RaceResult r : allResults) {
            Driver driver = r.getDriver();
            if (driver.getTeam() == null) continue;
            Team team = driver.getTeam();
            Long teamId = team.getId();

            ConstructorStats stats = statsMap.computeIfAbsent(teamId, k -> new ConstructorStats(team));
            stats.totalPoints += r.getPoints();
            if (r.getFinishPosition() == 1) stats.wins++;
            if (r.getFinishPosition() <= 3 && r.getDnfReason() == null) stats.podiums++;

            // Track per-driver points within team
            stats.driverPoints.merge(driver.getName(), (double) r.getPoints(), Double::sum);
        }

        List<ConstructorStats> sorted = statsMap.values().stream()
                .sorted(Comparator.comparingDouble((ConstructorStats s) -> s.totalPoints).reversed())
                .collect(Collectors.toList());

        float leaderPoints = sorted.isEmpty() ? 0 : sorted.get(0).totalPoints;
        float prevPoints = leaderPoints;

        List<ConstructorStandingResponse> standings = new ArrayList<>();
        for (int i = 0; i < sorted.size(); i++) {
            ConstructorStats s = sorted.get(i);
            List<Map.Entry<String, Double>> drivers = s.driverPoints.entrySet().stream()
                    .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                    .collect(Collectors.toList());

            standings.add(ConstructorStandingResponse.builder()
                    .position(i + 1)
                    .teamId(s.team.getId())
                    .teamName(s.team.getName())
                    .teamColor(s.team.getColorHex())
                    .country(s.team.getCountry())
                    .totalPoints(s.totalPoints)
                    .wins(s.wins)
                    .podiums(s.podiums)
                    .gapToLeader(leaderPoints - s.totalPoints)
                    .gapToAhead(prevPoints - s.totalPoints)
                    .driver1Name(drivers.size() > 0 ? drivers.get(0).getKey() : "")
                    .driver2Name(drivers.size() > 1 ? drivers.get(1).getKey() : "")
                    .driver1Points(drivers.size() > 0 ? drivers.get(0).getValue().floatValue() : 0)
                    .driver2Points(drivers.size() > 1 ? drivers.get(1).getValue().floatValue() : 0)
                    .build());
            prevPoints = s.totalPoints;
        }

        return standings;
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    private float calculatePoints(int position, boolean hasFastestLap, String dnfReason) {
        if (dnfReason != null && !dnfReason.isEmpty()) return 0;
        float pts = (position >= 1 && position <= 10) ? POINTS[position - 1] : 0;
        // Fastest lap only counts if driver finished in top 10
        if (hasFastestLap && position <= 10) pts += FASTEST_LAP_POINT;
        return pts;
    }

    private RaceResultResponse toResponse(RaceResult r) {
        Driver d = r.getDriver();
        return RaceResultResponse.builder()
                .id(r.getId())
                .finishPosition(r.getFinishPosition())
                .startPosition(r.getStartPosition())
                .points(r.getPoints())
                .hasFastestLap(r.isHasFastestLap())
                .fastestLapTime(r.getFastestLapTime())
                .dnfReason(r.getDnfReason())
                .driverId(d.getId())
                .driverName(d.getName())
                .carNumber(d.getCarNumber())
                .nationality(d.getNationality())
                .teamName(d.getTeam() != null ? d.getTeam().getName() : "")
                .teamColor(d.getTeam() != null ? d.getTeam().getColorHex() : "#666")
                .raceId(r.getRace().getId())
                .raceName(r.getRace().getName())
                .roundNumber(r.getRace().getRoundNumber())
                .build();
    }

    // ─── Inner stat classes ─────────────────────────────────────────────────

    private static class DriverStats {
        Driver driver;
        float totalPoints = 0;
        int wins = 0, podiums = 0, fastestLaps = 0;
        DriverStats(Driver d) { this.driver = d; }
    }

    private static class ConstructorStats {
        Team team;
        float totalPoints = 0;
        int wins = 0, podiums = 0;
        Map<String, Double> driverPoints = new LinkedHashMap<>();
        ConstructorStats(Team t) { this.team = t; }
    }
}
