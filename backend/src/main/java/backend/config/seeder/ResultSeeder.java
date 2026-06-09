package backend.config.seeder;

import backend.dto.RaceResultRequest;
import backend.model.Driver;
import backend.model.Race;
import backend.repository.RaceResultRepository;
import backend.service.RaceResultService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

@Component
@RequiredArgsConstructor
public class ResultSeeder {

    private final RaceResultRepository raceResultRepo;
    private final RaceResultService raceResultService;

    /**
     * Seeds race results for completed races.
     * No-ops when results already exist.
     */
    public void seed(List<Race> races, List<Driver> drivers) {
        if (races.isEmpty() || drivers.isEmpty()) return;

        Function<Integer, Long> driverId = (carNum) ->
                drivers.stream()
                        .filter(d -> d.getCarNumber() == carNum)
                        .findFirst()
                        .map(Driver::getId)
                        .orElse(null);

        seedRace(races, "Australian Grand Prix", new int[][]{
                {63, 2, 1, 0}, {12, 5, 2, 0}, {1,  1, 3, 0}, {81, 4, 4, 1},
                {44, 3, 5, 0}, {16, 6, 6, 0}, {3,  7, 7, 0}, {55, 9, 8, 0},
                {14, 8, 9, 0}, {6, 10, 10, 0}, {27, 11, 11, 0}, {5,  12, 12, 0},
                {10, 13, 13, 0}, {43, 14, 14, 0}, {18, 15, 15, 0}, {23, 16, 16, 0},
                {87, 17, 17, 0}, {30, 18, 18, 0}, {31, 19, 19, 0}, {41, 20, 20, 0},
                {11, 21, 0, 0}, {77, 22, 0, 0},
        }, driverId);

        seedRace(races, "Chinese Grand Prix", new int[][]{
                {12, 1, 1, 1}, {63, 3, 2, 0}, {1,  2, 3, 0}, {81, 4, 4, 0},
                {3,  5, 5, 0}, {44, 6, 6, 0}, {16, 7, 7, 0}, {55, 8, 8, 0},
                {6,  9, 9, 0}, {14, 10, 10, 0}, {5,  11, 11, 0}, {27, 12, 12, 0},
                {10, 13, 13, 0}, {18, 14, 14, 0}, {43, 15, 15, 0}, {23, 16, 16, 0},
                {87, 17, 17, 0}, {30, 18, 18, 0}, {77, 19, 19, 0}, {41, 20, 20, 0},
                {31, 21, 0, 0}, {11, 22, 0, 0},
        }, driverId);

        seedRace(races, "Japanese Grand Prix", new int[][]{
                {12, 2, 1, 1}, {1,  1, 2, 0}, {63, 3, 3, 0}, {81, 4, 4, 0},
                {44, 5, 5, 0}, {3,  6, 6, 0}, {16, 7, 7, 0}, {55, 8, 8, 0},
                {14, 9, 9, 0}, {6, 10, 10, 0}, {27, 11, 11, 0}, {5,  12, 12, 0},
                {10, 13, 13, 0}, {43, 14, 14, 0}, {18, 15, 15, 0}, {23, 16, 16, 0},
                {87, 17, 17, 0}, {41, 18, 18, 0}, {30, 19, 19, 0}, {77, 20, 20, 0},
                {31, 21, 0, 0}, {11, 22, 0, 0},
        }, driverId);
    }

    private void seedRace(List<Race> races, String raceName, int[][] data, Function<Integer, Long> driverIdFn) {
        Race race = races.stream()
                .filter(r -> r.getName().equals(raceName))
                .findFirst().orElse(null);
        if (race == null) return;
        if (raceResultRepo.existsByRaceId(race.getId())) {
            System.out.println("[Pitwall] " + raceName + " results already seeded, skipping");
            return;
        }
        raceResultService.submitResults(race.getId(), buildResults(data, driverIdFn));
        System.out.println("[Pitwall] " + raceName + " results seeded");
    }

    private List<RaceResultRequest> buildResults(int[][] data, Function<Integer, Long> driverIdFn) {
        List<RaceResultRequest> list = new ArrayList<>();
        for (int[] row : data) {
            int carNum  = row[0];
            int start   = row[1];
            int finish  = row[2];
            boolean fl  = row[3] == 1;
            Long id = driverIdFn.apply(carNum);
            if (id == null) continue;
            RaceResultRequest req = new RaceResultRequest();
            req.setDriverId(id);
            req.setStartPosition(start);
            req.setFinishPosition(finish);
            req.setHasFastestLap(fl);
            req.setFastestLapTime(0f);
            req.setFastestLapNumber(0);
            req.setDnfReason(finish == 0 ? "Mechanical" : null);
            list.add(req);
        }
        return list;
    }
}
