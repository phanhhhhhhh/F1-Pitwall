package backend.config.seeder;

import backend.model.Race;
import backend.model.RaceNews;
import backend.model.enums.RaceStatus;
import backend.repository.RaceNewsRepository;
import backend.repository.RaceRepository;
import backend.service.RaceNewsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Idempotent news seeding, runs on every startup (after DataSeeder @Order(1)
 * and CiTestDataSeeder @Order(2)):
 * 1. Backfills RACE_REPORT entries for every completed race that already has
 *    synced results (races synced before this feature existed).
 * 2. Seeds curated DRIVER_NEWS items (e.g. mid-season driver changes).
 */
@Slf4j
@Component
@Order(3)
@RequiredArgsConstructor
public class NewsSeeder implements CommandLineRunner {

    private static final String HADJAR_TITLE =
            "Hadjar ruled out — Lawson to Red Bull, Tsunoda to Racing Bulls";

    private final RaceNewsService raceNewsService;
    private final RaceNewsRepository newsRepo;
    private final RaceRepository raceRepo;

    @Override
    public void run(String... args) {
        try {
            backfillRaceReports();
            seedDriverNews();
        } catch (Exception e) {
            log.error("[Pitwall] NewsSeeder failed: {}", e.getMessage(), e);
        }
    }

    private void backfillRaceReports() {
        int count = 0;
        for (Race race : raceRepo.findAllByOrderBySeasonDescRoundNumberAsc()) {
            if (race.getStatus() == RaceStatus.COMPLETED) {
                raceNewsService.generateRaceReport(race); // upsert, never throws
                count++;
            }
        }
        log.info("[Pitwall] Race reports checked for {} completed races", count);
    }

    private void seedDriverNews() {
        if (newsRepo.existsByTitle(HADJAR_TITLE)) {
            log.info("[Pitwall] Curated driver news already exists — skipping");
            return;
        }

        Race dutchGp = raceRepo.findBySeason(2026).stream()
                .filter(r -> r.getRoundNumber() == 14)
                .findFirst()
                .orElse(null);
        if (dutchGp == null) {
            log.warn("[Pitwall] Dutch GP 2026 (R14) not found — skipping curated driver news");
            return;
        }

        String content = "Driver shuffle after the Dutch Grand Prix: Isack Hadjar has been "
                + "ruled out through injury, so Liam Lawson is promoted from Racing Bulls to "
                + "Red Bull Racing to partner Max Verstappen. Yuki Tsunoda returns to race "
                + "full-time at Racing Bulls alongside Arvid Lindblad.";

        newsRepo.save(RaceNews.builder()
                .race(dutchGp)
                .title(HADJAR_TITLE)
                .tag(RaceNewsService.TAG_DRIVER_NEWS)
                .content(content)
                .build());
        log.info("[Pitwall] Curated driver news seeded (Dutch GP 2026)");
    }
}
