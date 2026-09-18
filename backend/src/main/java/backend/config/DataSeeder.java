package backend.config;

import backend.config.seeder.CircuitRaceSeeder;
import backend.config.seeder.Seeder2025;
import backend.config.seeder.TeamDriverSeeder;
import backend.config.seeder.UserSeeder;
import backend.repository.RaceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final UserSeeder userSeeder;
    private final Seeder2025 seeder2025;
    private final TeamDriverSeeder teamDriverSeeder;
    private final CircuitRaceSeeder circuitRaceSeeder;

    private final RaceRepository raceRepo;

    @Override
    public void run(String... args) {
        log.info("[Pitwall] DataSeeder starting...");
        try {
            userSeeder.seed();
            log.info("[Pitwall] Users seeded");
        } catch (IllegalStateException e) {
            // Missing ADMIN_PASSWORD/ENGINEER_PASSWORD must not silently seed a known
            // default, but it also shouldn't block the season data below from seeding.
            log.error("[Pitwall] User seeding skipped: {}", e.getMessage());
        }
        try {
            // Seed 2025 data first (idempotent — skips if already present)
            seeder2025.seed();

            // Teams/drivers/tyres/engineers are idempotent — run on every
            // startup so missing 2026 teams get created and null-team
            // drivers get backfilled on existing deployments.
            teamDriverSeeder.seed();

            // Seed 2026 races only if none exist
            if (raceRepo.findBySeason(2026).isEmpty()) {
                circuitRaceSeeder.seed();
            }

            // Race results are synced from Jolpica by OpenF1SyncService — no fictional seeding
        } catch (Exception e) {
            log.error("[Pitwall] DataSeeder failed: {}", e.getMessage(), e);
        }
    }
}