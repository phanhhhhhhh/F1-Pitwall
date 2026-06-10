package backend.config;

import backend.config.seeder.CircuitRaceSeeder;
import backend.config.seeder.TeamDriverSeeder;
import backend.config.seeder.UserSeeder;
import backend.model.Driver;
import backend.repository.DriverRepository;
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
            }

            // Race results are synced from Jolpica by OpenF1SyncService — no fictional seeding
        } catch (Exception e) {
            System.err.println("[Pitwall] DataSeeder failed: " + e.getMessage());
            e.printStackTrace();
        }
    }
}