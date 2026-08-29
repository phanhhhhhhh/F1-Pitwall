package backend;

import backend.dto.DriverProfileResponse;
import backend.model.Driver;
import backend.model.LapTelemetry;
import backend.model.PitStop;
import backend.model.QualifyingResult;
import backend.model.Race;
import backend.model.RaceResult;
import backend.model.Team;
import backend.model.WeatherCondition;
import backend.model.enums.RaceStatus;
import backend.model.enums.WeatherType;
import backend.repository.DriverRepository;
import backend.repository.LapTelemetryRepository;
import backend.repository.PitStopRepository;
import backend.repository.QualifyingResultRepository;
import backend.repository.RaceResultRepository;
import backend.repository.WeatherConditionRepository;
import backend.service.DriverRatingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Behaviour of the data-derived driver ratings.
 *
 * <p>These tests fix the properties the ratings promise: they are teammate-relative, they move
 * toward the grid baseline when there is little data behind them, and each one reports the
 * measurements it came from.
 */
@DisplayName("DriverRatingService")
class DriverRatingServiceTest {

    private static final int SEASON = 2026;
    /** Mirrors the service's grid baseline — a driver with no data rates here. */
    private static final int BASELINE = 85;

    private final DriverRepository driverRepo = mock(DriverRepository.class);
    private final RaceResultRepository raceResultRepo = mock(RaceResultRepository.class);
    private final QualifyingResultRepository qualifyingRepo = mock(QualifyingResultRepository.class);
    private final PitStopRepository pitStopRepo = mock(PitStopRepository.class);
    private final LapTelemetryRepository telemetryRepo = mock(LapTelemetryRepository.class);
    private final WeatherConditionRepository weatherRepo = mock(WeatherConditionRepository.class);

    private DriverRatingService service;

    private Team team;
    private Driver fast;
    private Driver slow;

    private final List<Race> races = new ArrayList<>();
    private final List<RaceResult> results = new ArrayList<>();
    private final List<QualifyingResult> qualifying = new ArrayList<>();
    private final List<PitStop> pitStops = new ArrayList<>();
    private final List<LapTelemetry> telemetry = new ArrayList<>();
    private final List<WeatherCondition> weather = new ArrayList<>();

    private long nextId = 1;

    @BeforeEach
    void setUp() {
        service = new DriverRatingService(
                driverRepo, raceResultRepo, qualifyingRepo, pitStopRepo, telemetryRepo, weatherRepo);

        team = Team.builder().id(1L).name("Test Racing").colorHex("#ff0000").build();
        fast = driver(10L, "Fast Driver", 1);
        slow = driver(11L, "Slow Driver", 2);

        races.clear();
        results.clear();
        qualifying.clear();
        pitStops.clear();
        telemetry.clear();
        weather.clear();
        nextId = 100;
    }

    // ─── Fixtures ─────────────────────────────────────────────────────────────

    private Driver driver(long id, String name, int carNumber) {
        return Driver.builder()
                .id(id)
                .name(name)
                .carNumber(carNumber)
                .nationality("Testland")
                .dateOfBirth(LocalDate.of(1998, 1, 1))
                .team(team)
                .build();
    }

    private Race race(int round) {
        Race r = Race.builder()
                .id((long) round)
                .name("Round " + round)
                .season(SEASON)
                .roundNumber(round)
                .status(RaceStatus.COMPLETED)
                .date(LocalDate.of(SEASON, 3, 1).plusWeeks(round))
                .build();
        races.add(r);
        return r;
    }

    private RaceResult result(Race race, Driver driver, int start, int finish, String dnf) {
        RaceResult rr = RaceResult.builder()
                .id(nextId++)
                .race(race)
                .driver(driver)
                .team(team)
                .startPosition(start)
                .finishPosition(finish)
                .dnfReason(dnf)
                .build();
        results.add(rr);
        return rr;
    }

    private void quali(Race race, Driver driver, int position, double bestTime) {
        qualifying.add(QualifyingResult.builder()
                .id(nextId++)
                .race(race)
                .driver(driver)
                .qualifyingPosition(position)
                .gridPosition(position)
                .bestTime(bestTime)
                .build());
    }

    /** Builds a stint whose lap times climb by {@code degradation} seconds per lap. */
    private void stint(RaceResult result, double baseLapTime, double degradation, int laps) {
        for (int lap = 1; lap <= laps; lap++) {
            telemetry.add(LapTelemetry.builder()
                    .id(nextId++)
                    .raceResult(result)
                    .lapNumber(lap)
                    .lapTimeSec((float) (baseLapTime + degradation * lap))
                    .build());
        }
    }

    private void wireRepositories() {
        when(raceResultRepo.findByRaceSeasonAndRaceStatus(anyInt(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(results);
        when(qualifyingRepo.findBySeasonWithDriver(anyInt())).thenReturn(qualifying);
        when(pitStopRepo.findBySeason(anyInt())).thenReturn(pitStops);
        when(telemetryRepo.findBySeason(anyInt())).thenReturn(telemetry);
        when(weatherRepo.findBySeason(anyInt())).thenReturn(weather);
        when(raceResultRepo.countStartsByDriver(org.mockito.ArgumentMatchers.any()))
                .thenReturn(List.of(
                        new Object[]{fast.getId(), (long) countStarts(fast)},
                        new Object[]{slow.getId(), (long) countStarts(slow)}));
        when(driverRepo.findAllWithTeam()).thenReturn(List.of(fast, slow));
    }

    private int countStarts(Driver driver) {
        return (int) results.stream().filter(r -> r.getDriver().getId().equals(driver.getId())).count();
    }

    private Map<Long, DriverProfileResponse> profilesById() {
        wireRepositories();
        return service.getProfiles(SEASON).stream()
                .collect(java.util.stream.Collectors.toMap(DriverProfileResponse::getDriverId, p -> p));
    }

    // ─── Pace ─────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Pace")
    class Pace {

        @Test
        @DisplayName("rates the driver who consistently out-qualifies their teammate above them")
        void teammateComparisonDrivesPace() {
            for (int round = 1; round <= 12; round++) {
                Race r = race(round);
                // A 0.4% deficit is a decisive but realistic teammate gap.
                quali(r, fast, 3, 80.000);
                quali(r, slow, 8, 80.320);
                result(r, fast, 3, 3, null);
                result(r, slow, 8, 8, null);
            }

            Map<Long, DriverProfileResponse> profiles = profilesById();
            int fastPace = profiles.get(fast.getId()).getSkills().getPace();
            int slowPace = profiles.get(slow.getId()).getSkills().getPace();

            assertThat(fastPace).isGreaterThan(BASELINE);
            assertThat(slowPace).isLessThan(BASELINE);
            assertThat(fastPace).isGreaterThan(slowPace);
        }

        @Test
        @DisplayName("reports the head-to-head record and median gap it used")
        void exposesQualifyingEvidence() {
            for (int round = 1; round <= 10; round++) {
                Race r = race(round);
                // The faster driver loses two of the ten sessions.
                boolean fastWins = round > 2;
                quali(r, fast, fastWins ? 3 : 9, fastWins ? 80.000 : 80.400);
                quali(r, slow, fastWins ? 9 : 3, fastWins ? 80.400 : 80.000);
                result(r, fast, 3, 3, null);
                result(r, slow, 9, 9, null);
            }

            DriverProfileResponse.Evidence evidence = profilesById().get(fast.getId()).getEvidence();

            assertThat(evidence.getQualifyingSessions()).isEqualTo(10);
            assertThat(evidence.getQualifyingHeadToHeadSessions()).isEqualTo(10);
            assertThat(evidence.getQualifyingH2HPct()).isEqualTo(80.0);
            assertThat(evidence.getTeammateName()).isEqualTo("Slow Driver");
            assertThat(evidence.getTeammateGapPct()).isNegative();
        }

        @Test
        @DisplayName("stays at the baseline when there is no teammate to compare against")
        void noTeammateLeavesBaseline() {
            for (int round = 1; round <= 8; round++) {
                Race r = race(round);
                quali(r, fast, 5, 80.000);
                result(r, fast, 5, 5, null);
            }

            DriverProfileResponse profile = profilesById().get(fast.getId());

            // No comparison is possible, so nothing pulls the rating away from the baseline.
            assertThat(profile.getSkills().getPace()).isEqualTo(BASELINE);
            assertThat(profile.getEvidence().getQualifyingH2HPct()).isNull();
            assertThat(profile.getEvidence().getConfidence().getPace()).isZero();
        }
    }

    // ─── Confidence ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Small samples")
    class SmallSamples {

        @Test
        @DisplayName("pulls a one-race rating most of the way back to the baseline")
        void singleRaceIsHeavilyDamped() {
            Race r = race(1);
            quali(r, fast, 1, 79.000);
            quali(r, slow, 20, 81.000);
            result(r, fast, 1, 1, null);
            result(r, slow, 20, 20, null);

            DriverProfileResponse profile = profilesById().get(fast.getId());

            // One session gives 1/(1+5) confidence, so at most a sixth of the raw swing survives.
            assertThat(profile.getSkills().getPace()).isBetween(BASELINE, BASELINE + 4);
            assertThat(profile.getEvidence().getConfidence().getPace()).isLessThan(50);
        }

        @Test
        @DisplayName("lets a full season's evidence through")
        void fullSeasonIsConfident() {
            for (int round = 1; round <= 22; round++) {
                Race r = race(round);
                quali(r, fast, 1, 79.000);
                quali(r, slow, 20, 79.400);
                result(r, fast, 1, 1, null);
                result(r, slow, 20, 20, null);
            }

            DriverProfileResponse profile = profilesById().get(fast.getId());

            assertThat(profile.getEvidence().getConfidence().getPace()).isGreaterThan(80);
            assertThat(profile.getSkills().getPace()).isGreaterThan(BASELINE + 8);
        }
    }

    // ─── Racecraft ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Racecraft")
    class Racecraft {

        @Test
        @DisplayName("rewards places gained and penalises a poor finish rate")
        void gainsAndReliability() {
            for (int round = 1; round <= 14; round++) {
                Race r = race(round);
                quali(r, fast, 10, 80.000);
                quali(r, slow, 9, 79.900);
                // The faster racer climbs from P10 to P4; the teammate retires every third race.
                result(r, fast, 10, 4, null);
                result(r, slow, 9, 12, round % 3 == 0 ? "Engine" : null);
            }

            Map<Long, DriverProfileResponse> profiles = profilesById();
            DriverProfileResponse fastProfile = profiles.get(fast.getId());
            DriverProfileResponse slowProfile = profiles.get(slow.getId());

            assertThat(fastProfile.getSkills().getRacecraft()).isGreaterThan(BASELINE);
            assertThat(fastProfile.getEvidence().getAvgPositionsGained()).isEqualTo(6.0);
            assertThat(fastProfile.getEvidence().getFinishRatePct()).isEqualTo(100.0);
            assertThat(slowProfile.getEvidence().getFinishRatePct()).isLessThan(100.0);
            assertThat(fastProfile.getSkills().getRacecraft())
                    .isGreaterThan(slowProfile.getSkills().getRacecraft());
        }

        @Test
        @DisplayName("ignores a head-to-head where the other car retired")
        void retirementsDoNotCountAsWins() {
            for (int round = 1; round <= 6; round++) {
                Race r = race(round);
                result(r, fast, 5, 5, null);
                result(r, slow, 6, 0, "Gearbox");
            }

            DriverProfileResponse profile = profilesById().get(fast.getId());

            // Six races where the teammate never saw the flag give no head-to-head evidence at all.
            assertThat(profile.getEvidence().getRaceH2HPct()).isNull();
        }
    }

    // ─── Tyre management ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("Tyre management")
    class TyreManagement {

        @Test
        @DisplayName("rates the driver whose stint times climb more slowly above the field")
        void degradationSlopeDrivesRating() {
            for (int round = 1; round <= 10; round++) {
                Race r = race(round);
                RaceResult fastResult = result(r, fast, 5, 5, null);
                RaceResult slowResult = result(r, slow, 6, 6, null);
                // 0.02 s/lap against 0.14 s/lap is the kind of spread that separates the grid.
                stint(fastResult, 90.0, 0.02, 20);
                stint(slowResult, 90.0, 0.14, 20);
            }

            Map<Long, DriverProfileResponse> profiles = profilesById();
            DriverProfileResponse gentle = profiles.get(fast.getId());
            DriverProfileResponse harsh = profiles.get(slow.getId());

            assertThat(gentle.getSkills().getTyreMgmt()).isGreaterThan(harsh.getSkills().getTyreMgmt());
            assertThat(gentle.getEvidence().getDegradationSecPerLap())
                    .isLessThan(harsh.getEvidence().getDegradationSecPerLap());
            assertThat(gentle.getEvidence().getStintsAnalysed()).isEqualTo(10);
        }

        @Test
        @DisplayName("reports no degradation measurement when there is no telemetry")
        void noTelemetryIsReportedHonestly() {
            for (int round = 1; round <= 8; round++) {
                Race r = race(round);
                result(r, fast, 5, 5, null);
                result(r, slow, 6, 6, null);
            }

            DriverProfileResponse.Evidence evidence = profilesById().get(fast.getId()).getEvidence();

            assertThat(evidence.getDegradationSecPerLap()).isNull();
            assertThat(evidence.getStintsAnalysed()).isZero();
        }
    }

    // ─── Wet weather ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Wet skill")
    class WetSkill {

        @Test
        @DisplayName("rewards a driver who finishes better in the wet than in the dry")
        void wetOutperformanceRaisesRating() {
            for (int round = 1; round <= 12; round++) {
                Race r = race(round);
                boolean wet = round % 3 == 0;
                if (wet) {
                    weather.add(WeatherCondition.builder()
                            .id(nextId++).race(r).condition(WeatherType.WET).session("RACE").build());
                }
                result(r, fast, 8, wet ? 2 : 8, null);
                result(r, slow, 7, 7, null);
            }

            DriverProfileResponse profile = profilesById().get(fast.getId());

            assertThat(profile.getEvidence().getWetRaces()).isEqualTo(4);
            assertThat(profile.getEvidence().getWetAvgFinish()).isEqualTo(2.0);
            assertThat(profile.getEvidence().getDryAvgFinish()).isEqualTo(8.0);
            assertThat(profile.getSkills().getWetSkill()).isGreaterThan(BASELINE);
        }

        @Test
        @DisplayName("falls back to racecraft when the season had no wet running")
        void noWetRacesFallsBackToRacecraft() {
            for (int round = 1; round <= 10; round++) {
                Race r = race(round);
                result(r, fast, 10, 4, null);
                result(r, slow, 9, 11, null);
            }

            DriverProfileResponse profile = profilesById().get(fast.getId());

            assertThat(profile.getEvidence().getWetRaces()).isZero();
            assertThat(profile.getSkills().getWetSkill()).isEqualTo(profile.getSkills().getRacecraft());
        }
    }

    // ─── Output contract ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("Output")
    class Output {

        @Test
        @DisplayName("keeps every rating inside the published scale")
        void ratingsStayInRange() {
            for (int round = 1; round <= 22; round++) {
                Race r = race(round);
                // A deliberately lopsided season: one driver dominant, the other nowhere.
                quali(r, fast, 1, 78.000);
                quali(r, slow, 20, 82.000);
                RaceResult fastResult = result(r, fast, 1, 1, null);
                RaceResult slowResult = result(r, slow, 20, 20, "Crash");
                stint(fastResult, 90.0, 0.0, 25);
                stint(slowResult, 90.0, 0.5, 25);
            }

            for (DriverProfileResponse profile : profilesById().values()) {
                DriverProfileResponse.Skills skills = profile.getSkills();
                assertThat(skills.getPace()).isBetween(60, 99);
                assertThat(skills.getRacecraft()).isBetween(60, 99);
                assertThat(skills.getTyreMgmt()).isBetween(60, 99);
                assertThat(skills.getExperience()).isBetween(60, 99);
                assertThat(skills.getWetSkill()).isBetween(60, 99);
                assertThat(skills.getOverall()).isBetween(60, 99);
            }
        }

        @Test
        @DisplayName("returns the grid ordered by overall rating")
        void sortedByOverall() {
            for (int round = 1; round <= 15; round++) {
                Race r = race(round);
                quali(r, fast, 2, 79.000);
                quali(r, slow, 15, 79.600);
                result(r, fast, 2, 2, null);
                result(r, slow, 15, 15, null);
            }

            wireRepositories();
            List<DriverProfileResponse> profiles = service.getProfiles(SEASON);

            assertThat(profiles).hasSize(2);
            assertThat(profiles.get(0).getName()).isEqualTo("Fast Driver");
            assertThat(profiles.get(0).getSkills().getOverall())
                    .isGreaterThan(profiles.get(1).getSkills().getOverall());
        }
    }
}
