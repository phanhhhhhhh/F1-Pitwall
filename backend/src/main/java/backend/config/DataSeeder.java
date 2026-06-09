package backend.config;

import backend.config.seeder.CircuitRaceSeeder;
import backend.config.seeder.ResultSeeder;
import backend.config.seeder.TeamDriverSeeder;
import backend.config.seeder.UserSeeder;
import backend.model.Driver;
import backend.repository.DriverRepository;
import backend.repository.RaceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final UserSeeder userSeeder;
    private final TeamDriverSeeder teamDriverSeeder;
    private final CircuitRaceSeeder circuitRaceSeeder;
    private final ResultSeeder resultSeeder;

    private final RaceRepository raceRepo;
    private final DriverRepository driverRepo;

    @Override
    public void run(String... args) {
        System.out.println("[Pitwall] DataSeeder starting...");
        try {
            userSeeder.seed();
            System.out.println("[Pitwall] Users seeded");

            List<Driver> drivers = driverRepo.findAll();
            if (drivers.isEmpty()) {
                teamDriverSeeder.seed();
                circuitRaceSeeder.seed();
                drivers = driverRepo.findAll();
            }

            // Always attempt result seeding — ResultSeeder skips races that already have results
            resultSeeder.seed(raceRepo.findAll(), drivers);
        } catch (Exception e) {
            System.err.println("[Pitwall] DataSeeder failed: " + e.getMessage());
            e.printStackTrace();
        }
    }
}