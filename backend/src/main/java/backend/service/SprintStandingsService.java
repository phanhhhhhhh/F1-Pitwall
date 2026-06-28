package backend.service;

import backend.dto.ConstructorStandingResponse;
import backend.dto.DriverStandingResponse;
import backend.model.Driver;
import backend.model.RaceResult;
import backend.model.Team;
import backend.model.enums.RaceStatus;
import backend.repository.RaceResultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SprintStandingsService {

    private final RaceResultRepository raceResultRepo;

    // Sprint points: 8-7-6-5-4-3-2-1 for P1-P8
    private static final int[] SPRINT_POINTS = {8, 7, 6, 5, 4, 3, 2, 1};

    public List<DriverStandingResponse> getDriverStandings(int season) {
        List<RaceResult> allResults = raceResultRepo.findByRaceSeasonAndRaceStatus(season, RaceStatus.COMPLETED);

        // Filter only sprint results
        List<RaceResult> sprintResults = allResults.stream()
                .filter(r -> isSprintRace(r))
                .collect(Collectors.toList());

        Map<Long, SprintDriverStats> statsMap = new LinkedHashMap<>();

        for (RaceResult r : sprintResults) {
            Long driverId = r.getDriver().getId();
            SprintDriverStats stats = statsMap.computeIfAbsent(driverId, k -> new SprintDriverStats(r.getDriver()));
            stats.totalPoints += r.getPoints();
            boolean classified = r.getFinishPosition() >= 1 && r.getDnfReason() == null;
            if (classified && r.getFinishPosition() == 1) stats.wins++;
            if (classified && r.getFinishPosition() <= 3) stats.podiums++;
        }

        List<SprintDriverStats> sorted = statsMap.values().stream()
                .sorted(Comparator.comparingDouble((SprintDriverStats s) -> s.totalPoints)
                        .thenComparingInt((SprintDriverStats s) -> s.wins)
                        .thenComparingInt((SprintDriverStats s) -> s.podiums)
                        .reversed())
                .collect(Collectors.toList());

        float leaderPoints = sorted.isEmpty() ? 0 : sorted.get(0).totalPoints;
        float prevPoints = leaderPoints;
        List<DriverStandingResponse> standings = new ArrayList<>();

        for (int i = 0; i < sorted.size(); i++) {
            SprintDriverStats s = sorted.get(i);
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
                    .fastestLaps(0)
                    .gapToLeader(leaderPoints - s.totalPoints)
                    .gapToAhead(prevPoints - s.totalPoints)
                    .build());
            prevPoints = s.totalPoints;
        }
        return standings;
    }

    public List<ConstructorStandingResponse> getConstructorStandings(int season) {
        List<RaceResult> allResults = raceResultRepo.findByRaceSeasonAndRaceStatus(season, RaceStatus.COMPLETED);

        // Filter only sprint results
        List<RaceResult> sprintResults = allResults.stream()
                .filter(r -> isSprintRace(r))
                .collect(Collectors.toList());

        Map<Long, SprintConstructorStats> statsMap = new LinkedHashMap<>();

        for (RaceResult r : sprintResults) {
            Driver driver = r.getDriver();
            if (driver.getTeam() == null) continue;
            Team team = driver.getTeam();
            SprintConstructorStats stats = statsMap.computeIfAbsent(team.getId(), k -> new SprintConstructorStats(team));
            stats.totalPoints += r.getPoints();
            boolean classified = r.getFinishPosition() >= 1 && r.getDnfReason() == null;
            if (classified && r.getFinishPosition() == 1) stats.wins++;
            if (classified && r.getFinishPosition() <= 3) stats.podiums++;
            stats.driverPoints.merge(driver.getName(), (double) r.getPoints(), Double::sum);
        }

        List<SprintConstructorStats> sorted = statsMap.values().stream()
                .sorted(Comparator.comparingDouble((SprintConstructorStats s) -> s.totalPoints)
                        .thenComparingInt((SprintConstructorStats s) -> s.wins)
                        .thenComparingInt((SprintConstructorStats s) -> s.podiums)
                        .reversed())
                .collect(Collectors.toList());

        float leaderPoints = sorted.isEmpty() ? 0 : sorted.get(0).totalPoints;
        float prevPoints = leaderPoints;
        List<ConstructorStandingResponse> standings = new ArrayList<>();

        for (int i = 0; i < sorted.size(); i++) {
            SprintConstructorStats s = sorted.get(i);
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

    private boolean isSprintRace(RaceResult r) {
        String name = r.getRace().getName();
        return name != null && name.toLowerCase().contains("sprint");
    }

    private static class SprintDriverStats {
        Driver driver;
        float totalPoints = 0;
        int wins = 0, podiums = 0;
        SprintDriverStats(Driver d) { this.driver = d; }
    }

    private static class SprintConstructorStats {
        Team team;
        float totalPoints = 0;
        int wins = 0, podiums = 0;
        Map<String, Double> driverPoints = new LinkedHashMap<>();
        SprintConstructorStats(Team t) { this.team = t; }
    }
}
