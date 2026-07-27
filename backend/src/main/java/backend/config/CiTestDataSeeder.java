package backend.config;

import backend.model.*;
import backend.model.enums.TyreType;
import backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Inserts minimal test data (RaceResult, QualifyingResult, PitStop) so the
 * OpenInViewRegressionTest exercises actual lazy-loading paths — not just
 * empty-list 200 responses.
 *
 * <p>This ONLY runs under the "ci" profile. It never touches dev or prod.</p>
 */
@Slf4j
@Component
@Profile("ci")
@Order(2) // must run after DataSeeder (@Order(1)) has created races/drivers/teams
@RequiredArgsConstructor
public class CiTestDataSeeder implements CommandLineRunner {

    private final RaceRepository raceRepo;
    private final DriverRepository driverRepo;
    private final RaceResultRepository raceResultRepo;
    private final QualifyingResultRepository qualifyingRepo;
    private final PitStopRepository pitStopRepo;
    private final TyreCompoundRepository tyreCompoundRepo;

    @Override
    public void run(String... args) {
        log.info("[CI TestData] Inserting OSIV regression guard test data...");

        // Two races needed:
        //  race1  = id=1 (2025 Aus GP, SCHEDULED) — for /race/1/*, /qualifying/race/1, /pit-stops
        //  race26 = 2026 Aus GP (COMPLETED)       — for standings & winners (filter by COMPLETED)
        Race race1 = raceRepo.findById(1L).orElse(null);
        Race race26 = raceRepo.findBySeason(2026).stream()
                .filter(r -> r.getName().equals("Australian Grand Prix"))
                .findFirst().orElse(null);
        Race sprintRace = raceRepo.findBySeason(2026).stream()
                .filter(r -> r.getName() != null && r.getName().toLowerCase().contains("sprint")
                        && r.getStatus() == backend.model.enums.RaceStatus.COMPLETED)
                .findFirst().orElse(null);

        Driver driver = driverRepo.findAllWithTeam().stream()
                .filter(d -> "Lando Norris".equals(d.getName()))
                .findFirst().orElse(null);
        Driver driver2 = driverRepo.findAllWithTeam().stream()
                .filter(d -> "Oscar Piastri".equals(d.getName()))
                .findFirst().orElse(null);

        if (race1 == null || race26 == null || driver == null) {
            log.warn("[CI TestData] Required seed data not found — skipping");
            return;
        }

        // ── RaceResults for race #1 (race-specific endpoints) ──────────
        if (raceResultRepo.findByRaceIdOrderByFinishPosition(race1.getId()).isEmpty()) {
            RaceResult rr1 = RaceResult.builder()
                    .race(race1).driver(driver)
                    .startPosition(1).finishPosition(1).points(25.0f)
                    .hasFastestLap(true).fastestLapNumber(33).fastestLapTime(80.235f)
                    .build();
            raceResultRepo.save(rr1);
            log.info("[CI TestData] RaceResult for race #1 ({} pts)", rr1.getPoints());

            // ── PitStop (linked to race #1 result) ─────────────────────
            var tyre = tyreCompoundRepo.findAll().stream().findFirst().orElse(null);
            pitStopRepo.save(PitStop.builder()
                    .raceResult(rr1).lapNumber(1).durationSec(2.5f)
                    .tyreIn(TyreType.SOFT).tyreOut(TyreType.MEDIUM)
                    .crewSize(4).underSafetyCar(false)
                    .tyreCompound(tyre).build());
            log.info("[CI TestData] PitStop linked to race #1 result");
        }

        // ── RaceResults for 2026 COMPLETED race (standings + winners) ──
        if (raceResultRepo.findByRaceIdOrderByFinishPosition(race26.getId()).isEmpty()) {
            raceResultRepo.save(RaceResult.builder()
                    .race(race26).driver(driver)
                    .startPosition(1).finishPosition(1).points(25.0f)
                    .hasFastestLap(false).build());
            log.info("[CI TestData] RaceResult for 2026 COMPLETED race (P1)");

            if (driver2 != null) {
                raceResultRepo.save(RaceResult.builder()
                        .race(race26).driver(driver2)
                        .startPosition(2).finishPosition(2).points(18.0f)
                        .hasFastestLap(false).build());
                log.info("[CI TestData] RaceResult for 2026 COMPLETED race (P2)");
            }
        }

        // ── Sprint RaceResult ──────────────────────────────────────────
        if (sprintRace != null
                && raceResultRepo.findByRaceIdOrderByFinishPosition(sprintRace.getId()).isEmpty()) {
            raceResultRepo.save(RaceResult.builder()
                    .race(sprintRace).driver(driver)
                    .startPosition(1).finishPosition(1).points(8.0f)
                    .hasFastestLap(false).build());
            log.info("[CI TestData] Sprint RaceResult (P1)");
        }

        // ── QualifyingResult for race #1 ───────────────────────────────
        if (qualifyingRepo.findByRaceIdOrderByGridPosition(race1.getId()).isEmpty()) {
            qualifyingRepo.save(QualifyingResult.builder()
                    .race(race1).driver(driver).gridPosition(1)
                    .q1Time(79.507).q2Time(78.934).q3Time(78.518).bestTime(78.518)
                    .eliminatedQ1(false).eliminatedQ2(false).build());
            log.info("[CI TestData] QualifyingResult for race #1");
        }

        log.info("[CI TestData] Done — {} raceResults, {} qualifyingResults, {} pitStops",
                raceResultRepo.count(), qualifyingRepo.count(), pitStopRepo.count());
    }
}
