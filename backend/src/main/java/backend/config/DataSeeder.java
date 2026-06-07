package backend.config;

import backend.config.seeder.CircuitRaceSeeder;
import backend.config.seeder.ResultSeeder;
import backend.config.seeder.TeamDriverSeeder;
import backend.config.seeder.UserSeeder;
import backend.repository.DriverRepository;
import backend.repository.RaceRepository;
import backend.repository.RaceResultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final UserSeeder userSeeder;
    private final TeamDriverSeeder teamDriverSeeder;
    private final CircuitRaceSeeder circuitRaceSeeder;
    private final ResultSeeder resultSeeder;

    private final RaceResultRepository raceResultRepo;
    private final RaceRepository raceRepo;
    private final DriverRepository driverRepo;

    @Override
    public void run(String... args) {
        System.out.println("[Pitwall] DataSeeder starting...");
        try {
            userSeeder.seed();
            System.out.println("[Pitwall] Users seeded");

            if (raceResultRepo.count() > 0) {
                System.out.println("[Pitwall] Data already exists, skipping...");
                return;
            }

            teamDriverSeeder.seed();
            circuitRaceSeeder.seed();
            resultSeeder.seed(raceRepo.findAll(), driverRepo.findAll());
        } catch (Exception e) {
            System.err.println("[Pitwall] DataSeeder failed: " + e.getMessage());
            e.printStackTrace();
        }
    }
}