package backend.service;

import backend.dto.DriverProfileResponse;
import backend.model.Driver;
import backend.model.LapTelemetry;
import backend.model.PitStop;
import backend.model.QualifyingResult;
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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.Period;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.OptionalDouble;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Derives driver ability ratings from race data instead of hand-entered opinion.
 *
 * <h2>Why these measures</h2>
 * <p>Raw results mostly measure the car. Every rating here is therefore built on a comparison that
 * holds the car constant where possible:
 * <ul>
 *   <li><b>Pace</b> — qualifying against the teammate, the only fair like-for-like comparison on the
 *       grid, nudged by absolute grid slot so a strong driver in a strong car still rates higher
 *       than one who merely beats a slow teammate.</li>
 *   <li><b>Racecraft</b> — finishing ahead of the teammate, positions gained from the grid, and how
 *       often the car is brought home.</li>
 *   <li><b>Tyre management</b> — lap-time loss per lap within a stint, measured against the field
 *       median for the same season, plus stop count relative to the field.</li>
 *   <li><b>Experience</b> — career starts, wins and poles.</li>
 *   <li><b>Wet skill</b> — average finish in wet races against the same driver's dry average.</li>
 * </ul>
 *
 * <h2>Small samples</h2>
 * <p>A rookie with three races has a measured number, but not a trustworthy one. Every skill is
 * blended toward the grid baseline by {@code n / (n + k)}, so early-season and rookie ratings move
 * toward the middle rather than swinging wildly, and the confidence behind each one is reported.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DriverRatingService {

    /**
     * Ratings are calibrated for the F1 grid, not for the general population: every driver here is
     * among the fastest few dozen in the world, so an unremarkable one sits near 85, not near 50.
     */
    private static final double BASELINE = 85d;
    private static final double FLOOR = 60d;
    private static final double CEILING = 99d;

    /** Half-confidence sample sizes: a skill reaches 50% confidence at k observations. */
    private static final double K_QUALIFYING = 5;
    private static final double K_RACE = 5;
    private static final double K_TYRE = 4;
    private static final double K_WET = 2;

    /** Weather that makes a race a wet-weather test rather than a dry one. */
    private static final Set<WeatherType> WET_CONDITIONS =
            EnumSet.of(WeatherType.WET, WeatherType.DAMP, WeatherType.MIXED, WeatherType.STORMY);

    /** Laps slower than this multiple of the stint median are traffic or safety car, not degradation. */
    private static final double STINT_OUTLIER_THRESHOLD = 1.07;
    private static final int MIN_STINT_LAPS = 5;

    private final DriverRepository driverRepository;
    private final RaceResultRepository raceResultRepository;
    private final QualifyingResultRepository qualifyingRepository;
    private final PitStopRepository pitStopRepository;
    private final LapTelemetryRepository telemetryRepository;
    private final WeatherConditionRepository weatherRepository;

    // ─── Public API ───────────────────────────────────────────────────────────

    /** Rates every driver on the grid for a season. */
    @Transactional(readOnly = true)
    @Cacheable(value = "driverProfiles", key = "#season")
    public List<DriverProfileResponse> getProfiles(int season) {
        SeasonData data = load(season);
        return driverRepository.findAllWithTeam().stream()
                .map(driver -> rate(driver, data, season))
                .sorted(Comparator.comparingInt(
                        (DriverProfileResponse p) -> p.getSkills().getOverall()).reversed())
                .toList();
    }

    @Transactional(readOnly = true)
    public DriverProfileResponse getProfile(Long driverId, int season) {
        Driver driver = driverRepository.findByIdWithTeam(driverId)
                .orElseThrow(() -> new RuntimeException("Driver not found: " + driverId));
        return rate(driver, load(season), season);
    }

    /** Ratings change whenever a race is synced; the controller layer calls this after a sync. */
    @CacheEvict(value = "driverProfiles", allEntries = true)
    public void invalidate() {
        log.info("[Ratings] Driver profile cache cleared");
    }

    // ─── Season data ──────────────────────────────────────────────────────────

    /** Everything the ratings need for one season, loaded in a fixed number of queries. */
    private record SeasonData(
            Map<Long, List<RaceResult>> resultsByDriver,
            Map<Long, List<RaceResult>> resultsByRace,
            Map<Long, List<QualifyingResult>> qualifyingByRace,
            Map<Long, List<QualifyingResult>> qualifyingByDriver,
            Map<Long, Long> teamByRaceAndDriver,
            Map<Long, List<PitStop>> pitStopsByResult,
            Map<Long, Double> degradationByResult,
            Set<Long> wetRaceIds,
            Map<Long, Long> careerStartsByDriver,
            double fieldDegradation,
            double fieldStopsPerRace
    ) {}

    private SeasonData load(int season) {
        List<RaceResult> results =
                raceResultRepository.findByRaceSeasonAndRaceStatus(season, RaceStatus.COMPLETED);
        List<QualifyingResult> qualifying = qualifyingRepository.findBySeasonWithDriver(season);
        List<PitStop> pitStops = pitStopRepository.findBySeason(season);
        List<LapTelemetry> telemetry = telemetryRepository.findBySeason(season);
        List<WeatherCondition> weather = weatherRepository.findBySeason(season);

        Map<Long, List<RaceResult>> byDriver = results.stream()
                .filter(r -> r.getDriver() != null)
                .collect(Collectors.groupingBy(r -> r.getDriver().getId()));
        Map<Long, List<RaceResult>> byRace = results.stream()
                .filter(r -> r.getRace() != null)
                .collect(Collectors.groupingBy(r -> r.getRace().getId()));

        // The team a driver actually raced for in each race — drivers move mid-season, so the
        // teammate comparison must use the per-result snapshot rather than their current team.
        Map<Long, Long> teamByRaceAndDriver = new HashMap<>();
        for (RaceResult r : results) {
            if (r.getDriver() == null || r.getRace() == null) continue;
            Team team = r.getTeam() != null ? r.getTeam() : r.getDriver().getTeam();
            if (team != null) {
                teamByRaceAndDriver.put(pairKey(r.getRace().getId(), r.getDriver().getId()), team.getId());
            }
        }

        Map<Long, List<QualifyingResult>> qualiByRace = qualifying.stream()
                .filter(q -> q.getRace() != null)
                .collect(Collectors.groupingBy(q -> q.getRace().getId()));
        Map<Long, List<QualifyingResult>> qualiByDriver = qualifying.stream()
                .filter(q -> q.getDriver() != null)
                .collect(Collectors.groupingBy(q -> q.getDriver().getId()));

        Map<Long, List<PitStop>> stopsByResult = pitStops.stream()
                .filter(p -> p.getRaceResult() != null)
                .collect(Collectors.groupingBy(p -> p.getRaceResult().getId()));

        Map<Long, Double> degradation = computeDegradation(telemetry, stopsByResult);

        Set<Long> wetRaces = weather.stream()
                .filter(w -> w.getRace() != null && WET_CONDITIONS.contains(w.getCondition()))
                .map(w -> w.getRace().getId())
                .collect(Collectors.toSet());

        Map<Long, Long> careerStarts = raceResultRepository.countStartsByDriver(RaceStatus.COMPLETED)
                .stream()
                .filter(row -> row[0] != null)
                .collect(Collectors.toMap(
                        row -> ((Number) row[0]).longValue(),
                        row -> ((Number) row[1]).longValue(),
                        (a, b) -> a));

        double fieldDegradation = median(degradation.values());
        double fieldStops = results.isEmpty() ? 0
                : (double) pitStops.size() / results.size();

        log.debug("[Ratings] Season {}: {} results, {} quali, {} stops, {} stints, {} wet races",
                season, results.size(), qualifying.size(), pitStops.size(), degradation.size(), wetRaces.size());

        return new SeasonData(byDriver, byRace, qualiByRace, qualiByDriver, teamByRaceAndDriver,
                stopsByResult, degradation, wetRaces, careerStarts, fieldDegradation, fieldStops);
    }

    // ─── Rating ───────────────────────────────────────────────────────────────

    private DriverProfileResponse rate(Driver driver, SeasonData data, int season) {
        Long driverId = driver.getId();
        List<RaceResult> myResults = data.resultsByDriver().getOrDefault(driverId, List.of());
        List<QualifyingResult> myQualifying = data.qualifyingByDriver().getOrDefault(driverId, List.of());

        DriverProfileResponse.Evidence.EvidenceBuilder evidence = DriverProfileResponse.Evidence.builder();

        String teammateName = findTeammateName(driver, myResults, data);
        evidence.teammateName(teammateName);

        Rated pace = ratePace(driverId, myQualifying, data, evidence);
        Rated racecraft = rateRacecraft(driverId, myResults, data, evidence);
        Rated tyre = rateTyreManagement(driverId, myResults, data, evidence);
        Rated experience = rateExperience(driver, data);
        Rated wet = rateWetSkill(driverId, myResults, data, racecraft.value(), evidence);

        evidence.confidence(DriverProfileResponse.Confidence.builder()
                .pace(pct(pace.confidence()))
                .racecraft(pct(racecraft.confidence()))
                .tyreMgmt(pct(tyre.confidence()))
                .experience(pct(experience.confidence()))
                .wetSkill(pct(wet.confidence()))
                .build());

        int overall = (int) Math.round(
                pace.value() * 0.30
                        + racecraft.value() * 0.30
                        + tyre.value() * 0.17
                        + experience.value() * 0.10
                        + wet.value() * 0.13);

        Team team = driver.getTeam();
        return DriverProfileResponse.builder()
                .driverId(driverId)
                .name(driver.getName())
                .carNumber(driver.getCarNumber())
                .nationality(driver.getNationality())
                .teamName(team == null ? null : team.getName())
                .teamColorHex(team == null ? null : team.getColorHex())
                .age(ageOf(driver))
                .careerWins(driver.getCareerWins())
                .careerPoles(driver.getCareerPoles())
                .careerPoints(driver.getCareerPoints())
                .season(season)
                .skills(DriverProfileResponse.Skills.builder()
                        .pace((int) Math.round(pace.value()))
                        .racecraft((int) Math.round(racecraft.value()))
                        .tyreMgmt((int) Math.round(tyre.value()))
                        .experience((int) Math.round(experience.value()))
                        .wetSkill((int) Math.round(wet.value()))
                        .overall(overall)
                        .build())
                .evidence(evidence.build())
                .build();
    }

    /** A rating together with how much data stands behind it, 0–1. */
    private record Rated(double value, double confidence) {}

    // ─── Pace ─────────────────────────────────────────────────────────────────

    private Rated ratePace(Long driverId, List<QualifyingResult> myQualifying, SeasonData data,
                           DriverProfileResponse.Evidence.EvidenceBuilder evidence) {
        evidence.qualifyingSessions(myQualifying.size());

        List<Double> gaps = new ArrayList<>();
        int h2hWins = 0;
        int h2hTotal = 0;
        List<Double> positions = new ArrayList<>();

        for (QualifyingResult mine : myQualifying) {
            if (mine.getRace() == null) continue;
            if (mine.getQualifyingPosition() > 0) positions.add((double) mine.getQualifyingPosition());

            QualifyingResult mate = teammateQualifying(driverId, mine, data);
            if (mate == null) continue;

            if (mine.getQualifyingPosition() > 0 && mate.getQualifyingPosition() > 0) {
                h2hTotal++;
                if (mine.getQualifyingPosition() < mate.getQualifyingPosition()) h2hWins++;
            }
            Double myTime = mine.getBestTime();
            Double mateTime = mate.getBestTime();
            // A percentage gap is comparable across circuits; a raw gap in seconds is not.
            if (myTime != null && mateTime != null && myTime > 0 && mateTime > 0) {
                gaps.add((myTime - mateTime) / mateTime * 100d);
            }
        }

        Double medianGap = gaps.isEmpty() ? null : median(gaps);
        Double h2hPct = h2hTotal == 0 ? null : h2hWins * 100d / h2hTotal;
        Double avgPosition = positions.isEmpty() ? null : average(positions);

        evidence.qualifyingHeadToHeadSessions(h2hTotal);
        evidence.qualifyingH2HPct(round(h2hPct, 1));
        evidence.teammateGapPct(round(medianGap, 3));
        evidence.avgQualifyingPosition(round(avgPosition, 2));

        double raw = BASELINE;
        if (h2hPct != null) raw += (h2hPct / 100d - 0.5) * 20;
        // Teammate gaps live inside roughly ±0.6%; that band maps onto the full ±8 point swing.
        if (medianGap != null) raw += clamp(-medianGap * 14, -8, 8);
        if (avgPosition != null) raw += clamp((10.5 - avgPosition) * 0.7, -6, 6);

        double confidence = confidence(Math.max(h2hTotal, gaps.size()), K_QUALIFYING);
        return new Rated(blend(raw, confidence), confidence);
    }

    private QualifyingResult teammateQualifying(Long driverId, QualifyingResult mine, SeasonData data) {
        Long raceId = mine.getRace().getId();
        Long myTeam = data.teamByRaceAndDriver().get(pairKey(raceId, driverId));
        if (myTeam == null) return null;

        return data.qualifyingByRace().getOrDefault(raceId, List.of()).stream()
                .filter(q -> q.getDriver() != null && !Objects.equals(q.getDriver().getId(), driverId))
                .filter(q -> myTeam.equals(data.teamByRaceAndDriver().get(pairKey(raceId, q.getDriver().getId()))))
                .findFirst()
                .orElse(null);
    }

    // ─── Racecraft ────────────────────────────────────────────────────────────

    private Rated rateRacecraft(Long driverId, List<RaceResult> myResults, SeasonData data,
                                DriverProfileResponse.Evidence.EvidenceBuilder evidence) {
        List<Double> gained = new ArrayList<>();
        List<Double> finishes = new ArrayList<>();
        int classified = 0;
        int h2hWins = 0;
        int h2hTotal = 0;

        for (RaceResult mine : myResults) {
            boolean finished = mine.getDnfReason() == null && mine.getFinishPosition() > 0;
            if (finished) {
                classified++;
                finishes.add((double) mine.getFinishPosition());
                if (mine.getStartPosition() > 0) {
                    gained.add((double) (mine.getStartPosition() - mine.getFinishPosition()));
                }
            }
            RaceResult mate = teammateResult(driverId, mine, data);
            // Only count the head-to-head when both cars saw the flag; a rival's blown engine
            // says nothing about racecraft.
            if (mate != null && finished && mate.getDnfReason() == null && mate.getFinishPosition() > 0) {
                h2hTotal++;
                if (mine.getFinishPosition() < mate.getFinishPosition()) h2hWins++;
            }
        }

        int starts = myResults.size();
        Double finishRate = starts == 0 ? null : classified * 100d / starts;
        Double avgGained = gained.isEmpty() ? null : average(gained);
        Double h2hPct = h2hTotal == 0 ? null : h2hWins * 100d / h2hTotal;
        Double avgFinish = finishes.isEmpty() ? null : average(finishes);

        evidence.racesStarted(starts);
        evidence.racesClassified(classified);
        evidence.finishRatePct(round(finishRate, 1));
        evidence.avgPositionsGained(round(avgGained, 2));
        evidence.raceH2HPct(round(h2hPct, 1));
        evidence.avgFinishPosition(round(avgFinish, 2));

        double raw = BASELINE;
        if (h2hPct != null) raw += (h2hPct / 100d - 0.5) * 18;
        if (avgGained != null) raw += clamp(avgGained * 1.6, -6, 8);
        // Reliability is mostly the car, so a poor finish rate is penalised harder than a perfect
        // one is rewarded — otherwise a driver in a bulletproof car banks free rating.
        if (finishRate != null) raw += clamp((finishRate - 88) * 0.4, -8, 4);

        double confidence = confidence(starts, K_RACE);
        return new Rated(blend(raw, confidence), confidence);
    }

    private RaceResult teammateResult(Long driverId, RaceResult mine, SeasonData data) {
        if (mine.getRace() == null) return null;
        Long raceId = mine.getRace().getId();
        Long myTeam = data.teamByRaceAndDriver().get(pairKey(raceId, driverId));
        if (myTeam == null) return null;

        return data.resultsByRace().getOrDefault(raceId, List.of()).stream()
                .filter(r -> r.getDriver() != null && !Objects.equals(r.getDriver().getId(), driverId))
                .filter(r -> myTeam.equals(data.teamByRaceAndDriver().get(pairKey(raceId, r.getDriver().getId()))))
                .findFirst()
                .orElse(null);
    }

    // ─── Tyre management ──────────────────────────────────────────────────────

    private Rated rateTyreManagement(Long driverId, List<RaceResult> myResults, SeasonData data,
                                     DriverProfileResponse.Evidence.EvidenceBuilder evidence) {
        List<Double> myDegradation = new ArrayList<>();
        List<Double> stopDurations = new ArrayList<>();
        int stops = 0;

        for (RaceResult result : myResults) {
            Double slope = data.degradationByResult().get(result.getId());
            if (slope != null) myDegradation.add(slope);
            for (PitStop stop : data.pitStopsByResult().getOrDefault(result.getId(), List.of())) {
                stops++;
                if (stop.getDurationSec() > 0) stopDurations.add((double) stop.getDurationSec());
            }
        }

        Double degradation = myDegradation.isEmpty() ? null : average(myDegradation);
        Double stopsPerRace = myResults.isEmpty() ? null : (double) stops / myResults.size();

        evidence.pitStops(stops);
        evidence.avgPitStopSec(stopDurations.isEmpty() ? null : round(average(stopDurations), 2));
        evidence.avgStopsPerRace(round(stopsPerRace, 2));
        evidence.fieldAvgStopsPerRace(round(data.fieldStopsPerRace(), 2));
        evidence.degradationSecPerLap(round(degradation, 4));
        evidence.fieldDegradationSecPerLap(
                data.fieldDegradation() > 0 ? round(data.fieldDegradation(), 4) : null);
        evidence.stintsAnalysed(myDegradation.size());

        double raw = BASELINE;
        if (degradation != null && data.fieldDegradation() > 0) {
            // Degradation differences between drivers are a few hundredths of a second per lap.
            raw += clamp((data.fieldDegradation() - degradation) * 180, -10, 10);
        }
        if (stopsPerRace != null && data.fieldStopsPerRace() > 0) {
            raw += clamp((data.fieldStopsPerRace() - stopsPerRace) * 3, -5, 5);
        }

        int samples = myDegradation.size() + (stopsPerRace == null ? 0 : myResults.size() / 2);
        double confidence = confidence(samples, K_TYRE);
        return new Rated(blend(raw, confidence), confidence);
    }

    /**
     * Measures how much lap time each driver loses per lap as a stint ages.
     *
     * <p>Stints are split at pit stops. The first lap of a stint is dropped because cold tyres and
     * the pit exit distort it, and laps well off the stint median are dropped as traffic or safety
     * car laps. What remains is fitted with a least-squares line; its slope is the degradation.
     */
    private Map<Long, Double> computeDegradation(List<LapTelemetry> telemetry,
                                                 Map<Long, List<PitStop>> stopsByResult) {
        Map<Long, List<LapTelemetry>> byResult = telemetry.stream()
                .filter(t -> t.getRaceResult() != null && t.getLapTimeSec() > 0)
                .collect(Collectors.groupingBy(t -> t.getRaceResult().getId()));

        Map<Long, Double> out = new HashMap<>();
        for (Map.Entry<Long, List<LapTelemetry>> entry : byResult.entrySet()) {
            List<LapTelemetry> laps = entry.getValue().stream()
                    .sorted(Comparator.comparingInt(LapTelemetry::getLapNumber))
                    .toList();

            Set<Integer> stopLaps = stopsByResult.getOrDefault(entry.getKey(), List.of()).stream()
                    .map(PitStop::getLapNumber)
                    .collect(Collectors.toSet());

            List<Double> slopes = new ArrayList<>();
            List<Double> stint = new ArrayList<>();
            for (LapTelemetry lap : laps) {
                if (stopLaps.contains(lap.getLapNumber()) && !stint.isEmpty()) {
                    addSlope(slopes, stint);
                    stint = new ArrayList<>();
                    continue;
                }
                stint.add((double) lap.getLapTimeSec());
            }
            addSlope(slopes, stint);

            if (!slopes.isEmpty()) out.put(entry.getKey(), average(slopes));
        }
        return out;
    }

    private void addSlope(List<Double> slopes, List<Double> stint) {
        if (stint.size() < MIN_STINT_LAPS) return;

        List<Double> body = stint.subList(1, stint.size()); // drop the out-lap
        double median = median(body);
        if (median <= 0) return;

        List<Double> x = new ArrayList<>();
        List<Double> y = new ArrayList<>();
        for (int i = 0; i < body.size(); i++) {
            double lapTime = body.get(i);
            if (lapTime > median * STINT_OUTLIER_THRESHOLD) continue;
            x.add((double) i);
            y.add(lapTime);
        }
        if (x.size() < MIN_STINT_LAPS - 1) return;

        double meanX = average(x);
        double meanY = average(y);
        double numerator = 0;
        double denominator = 0;
        for (int i = 0; i < x.size(); i++) {
            numerator += (x.get(i) - meanX) * (y.get(i) - meanY);
            denominator += (x.get(i) - meanX) * (x.get(i) - meanX);
        }
        if (denominator > 0) slopes.add(numerator / denominator);
    }

    // ─── Experience ───────────────────────────────────────────────────────────

    private Rated rateExperience(Driver driver, SeasonData data) {
        long starts = data.careerStartsByDriver().getOrDefault(driver.getId(), 0L);
        double raw = 70
                + starts * 0.085
                + driver.getCareerWins() * 0.22
                + driver.getCareerPoles() * 0.13;

        // Career totals are recorded facts rather than an inferred sample, so this rating is not
        // blended toward the baseline the way the measured ones are.
        return new Rated(clamp(raw, FLOOR, CEILING), 1d);
    }

    // ─── Wet skill ────────────────────────────────────────────────────────────

    private Rated rateWetSkill(Long driverId, List<RaceResult> myResults, SeasonData data,
                               double racecraft,
                               DriverProfileResponse.Evidence.EvidenceBuilder evidence) {
        List<Double> wet = new ArrayList<>();
        List<Double> dry = new ArrayList<>();

        for (RaceResult result : myResults) {
            if (result.getRace() == null || result.getFinishPosition() <= 0) continue;
            if (result.getDnfReason() != null) continue;
            if (data.wetRaceIds().contains(result.getRace().getId())) {
                wet.add((double) result.getFinishPosition());
            } else {
                dry.add((double) result.getFinishPosition());
            }
        }

        Double wetAvg = wet.isEmpty() ? null : average(wet);
        Double dryAvg = dry.isEmpty() ? null : average(dry);

        evidence.wetRaces(wet.size());
        evidence.wetAvgFinish(round(wetAvg, 2));
        evidence.dryAvgFinish(round(dryAvg, 2));

        // With no wet running to go on, the honest answer is the driver's racecraft: the skills that
        // carry over are car control and overtaking judgement.
        if (wetAvg == null || dryAvg == null) {
            return new Rated(clamp(racecraft, FLOOR, CEILING), confidence(wet.size(), K_WET));
        }

        double raw = BASELINE + clamp((dryAvg - wetAvg) * 2.2, -8, 10) + (racecraft - BASELINE) * 0.35;
        double confidence = confidence(wet.size(), K_WET);
        return new Rated(blend(raw, confidence), confidence);
    }

    // ─── Maths helpers ────────────────────────────────────────────────────────

    /** Pulls a rating toward the grid baseline in proportion to how little data supports it. */
    private double blend(double raw, double confidence) {
        return clamp(BASELINE + (raw - BASELINE) * confidence, FLOOR, CEILING);
    }

    private double confidence(int samples, double halfPoint) {
        if (samples <= 0) return 0;
        return samples / (samples + halfPoint);
    }

    private int pct(double confidence) {
        return (int) Math.round(confidence * 100);
    }

    private static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private static double average(List<Double> values) {
        OptionalDouble avg = values.stream().mapToDouble(Double::doubleValue).average();
        return avg.orElse(0d);
    }

    private static double median(java.util.Collection<Double> values) {
        List<Double> sorted = values.stream().filter(Objects::nonNull).sorted().toList();
        if (sorted.isEmpty()) return 0d;
        int mid = sorted.size() / 2;
        return sorted.size() % 2 == 1
                ? sorted.get(mid)
                : (sorted.get(mid - 1) + sorted.get(mid)) / 2;
    }

    private static Double round(Double value, int decimals) {
        if (value == null) return null;
        double factor = Math.pow(10, decimals);
        return Math.round(value * factor) / factor;
    }

    private static double round(double value, int decimals) {
        double factor = Math.pow(10, decimals);
        return Math.round(value * factor) / factor;
    }

    /** Packs a (race, driver) pair into one key so team lookups stay a single hash probe. */
    private static long pairKey(Long raceId, Long driverId) {
        return raceId * 100_000L + driverId;
    }

    private String findTeammateName(Driver driver, List<RaceResult> myResults, SeasonData data) {
        Set<String> names = new HashSet<>();
        for (RaceResult mine : myResults) {
            RaceResult mate = teammateResult(driver.getId(), mine, data);
            if (mate != null && mate.getDriver() != null) names.add(mate.getDriver().getName());
        }
        return names.isEmpty() ? null : String.join(" / ", names);
    }

    private Integer ageOf(Driver driver) {
        LocalDate dob = driver.getDateOfBirth();
        return dob == null ? null : Period.between(dob, LocalDate.now()).getYears();
    }
}
