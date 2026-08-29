package backend.service;

import backend.dto.PitStopBenchmarkResponse;
import backend.model.*;
import backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RaceStoryService {

    private final PitStopRepository pitStopRepo;
    private final WeatherConditionRepository weatherRepo;
    private final IncidentRepository incidentRepo;

    /** How many individual stops the benchmark leaderboard returns. */
    private static final int LEADERBOARD_SIZE = 10;

    /**
     * Season-wide pit stop timings for the pit stop challenge.
     *
     * <p>Safety car stops are excluded from the statistics: the crew is doing the same work but the
     * field is queued behind a delta, so those stops are systematically more relaxed and would drag
     * the field average away from what a flat-out stop actually looks like. They still appear in the
     * leaderboard, flagged, because a genuinely fast one is still a fast one.
     */
    @Transactional(readOnly = true)
    @Cacheable(value = "pitStopBenchmark", key = "#season")
    public PitStopBenchmarkResponse getPitStopBenchmark(int season) {
        List<PitStop> stops = pitStopRepo.findBySeasonWithDriver(season).stream()
                .filter(ps -> ps.getDurationSec() > 0)
                .toList();

        List<Double> greenFlag = stops.stream()
                .filter(ps -> !ps.isUnderSafetyCar())
                .map(ps -> (double) ps.getDurationSec())
                .sorted()
                .toList();

        List<PitStopBenchmarkResponse.Stop> fastest = stops.stream()
                .sorted(Comparator.comparingDouble(PitStop::getDurationSec))
                .limit(LEADERBOARD_SIZE)
                .map(this::toBenchmarkStop)
                .toList();

        return PitStopBenchmarkResponse.builder()
                .season(season)
                .totalStops(stops.size())
                .greenFlagStops(greenFlag.size())
                .fastestSec(greenFlag.isEmpty() ? null : greenFlag.get(0))
                .medianSec(percentile(greenFlag, 0.50))
                .topQuartileSec(percentile(greenFlag, 0.25))
                .meanSec(greenFlag.isEmpty() ? null
                        : round(greenFlag.stream().mapToDouble(Double::doubleValue).average().orElse(0), 3))
                .fastest(fastest)
                .crews(buildCrews(stops))
                .build();
    }

    /** Pit stop timings shift whenever a race is synced. */
    @org.springframework.cache.annotation.CacheEvict(value = "pitStopBenchmark", allEntries = true)
    public void invalidateBenchmark() { }

    private PitStopBenchmarkResponse.Stop toBenchmarkStop(PitStop ps) {
        RaceResult rr = ps.getRaceResult();
        Driver d = rr != null ? rr.getDriver() : null;
        // The per-result team snapshot is authoritative: drivers change teams mid-season.
        Team t = rr != null && rr.getTeam() != null ? rr.getTeam() : (d != null ? d.getTeam() : null);
        Race race = rr != null ? rr.getRace() : null;

        return PitStopBenchmarkResponse.Stop.builder()
                .id(ps.getId())
                .durationSec(round(ps.getDurationSec(), 3))
                .lapNumber(ps.getLapNumber())
                .driverName(d != null ? d.getName() : "")
                .driverNumber(d != null ? d.getCarNumber() : 0)
                .teamName(t != null ? t.getName() : "")
                .teamColor(t != null ? t.getColorHex() : "#666")
                .raceName(race != null ? race.getName() : "")
                .round(race != null ? race.getRoundNumber() : 0)
                .tyreOut(ps.getTyreOut() != null ? ps.getTyreOut().name() : null)
                .underSafetyCar(ps.isUnderSafetyCar())
                .build();
    }

    private List<PitStopBenchmarkResponse.TeamCrew> buildCrews(List<PitStop> stops) {
        Map<String, List<PitStop>> byTeam = stops.stream()
                .filter(ps -> !ps.isUnderSafetyCar())
                .collect(Collectors.groupingBy(ps -> {
                    RaceResult rr = ps.getRaceResult();
                    Team t = rr != null && rr.getTeam() != null ? rr.getTeam()
                            : (rr != null && rr.getDriver() != null ? rr.getDriver().getTeam() : null);
                    return t != null && t.getName() != null ? t.getName() : "Unknown";
                }));

        return byTeam.entrySet().stream()
                .map(entry -> {
                    List<Double> durations = entry.getValue().stream()
                            .map(ps -> (double) ps.getDurationSec())
                            .sorted()
                            .toList();
                    String color = entry.getValue().stream()
                            .map(ps -> {
                                RaceResult rr = ps.getRaceResult();
                                Team t = rr != null && rr.getTeam() != null ? rr.getTeam()
                                        : (rr != null && rr.getDriver() != null ? rr.getDriver().getTeam() : null);
                                return t != null ? t.getColorHex() : null;
                            })
                            .filter(Objects::nonNull)
                            .findFirst()
                            .orElse("#666");

                    return PitStopBenchmarkResponse.TeamCrew.builder()
                            .teamName(entry.getKey())
                            .teamColor(color)
                            .stops(durations.size())
                            .medianSec(percentile(durations, 0.50))
                            .bestSec(durations.isEmpty() ? null : round(durations.get(0), 3))
                            .build();
                })
                .sorted(Comparator.comparing(
                        PitStopBenchmarkResponse.TeamCrew::getMedianSec,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    /** Linear-interpolated percentile over an already sorted list. */
    private Double percentile(List<Double> sorted, double fraction) {
        if (sorted.isEmpty()) return null;
        if (sorted.size() == 1) return round(sorted.get(0), 3);

        double position = fraction * (sorted.size() - 1);
        int lower = (int) Math.floor(position);
        int upper = (int) Math.ceil(position);
        double weight = position - lower;
        return round(sorted.get(lower) * (1 - weight) + sorted.get(upper) * weight, 3);
    }

    private static double round(double value, int decimals) {
        double factor = Math.pow(10, decimals);
        return Math.round(value * factor) / factor;
    }

    /**
     * Returns all pit stops for a race, including driver and team info.
     * GET /api/races/{raceId}/pit-stops
     */
    public List<Map<String, Object>> getPitStops(Long raceId) {
        List<PitStop> stops = pitStopRepo.findByRaceIdWithDriver(raceId);
        List<Map<String, Object>> result = new ArrayList<>();
        for (PitStop ps : stops) {
            RaceResult rr = ps.getRaceResult();
            Driver d = rr != null ? rr.getDriver() : null;
            Team t = d != null ? d.getTeam() : null;

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", ps.getId());
            m.put("lapNumber", ps.getLapNumber());
            m.put("durationSec", ps.getDurationSec());
            m.put("tyreIn", ps.getTyreIn() != null ? ps.getTyreIn().name() : null);
            m.put("tyreOut", ps.getTyreOut() != null ? ps.getTyreOut().name() : null);
            m.put("crewSize", ps.getCrewSize());
            m.put("underSafetyCar", ps.isUnderSafetyCar());
            m.put("driverName", d != null ? d.getName() : "");
            m.put("driverNumber", d != null ? d.getCarNumber() : 0);
            m.put("teamName", t != null ? t.getName() : "");
            m.put("teamColor", t != null ? t.getColorHex() : "#666");
            m.put("finishPosition", rr != null ? rr.getFinishPosition() : 0);
            result.add(m);
        }
        return result;
    }

    /**
     * Returns weather conditions recorded during a race session.
     * GET /api/races/{raceId}/weather
     */
    public List<Map<String, Object>> getWeather(Long raceId) {
        List<WeatherCondition> conditions = weatherRepo.findByRaceIdOrderById(raceId);
        List<Map<String, Object>> result = new ArrayList<>();
        for (WeatherCondition w : conditions) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", w.getId());
            m.put("airTempC", w.getAirTempC());
            m.put("trackTempC", w.getTrackTempC());
            m.put("humidityPct", w.getHumidityPct());
            m.put("windSpeedKmh", w.getWindSpeedKmh());
            m.put("condition", w.getCondition() != null ? w.getCondition().name() : "DRY");
            m.put("session", w.getSession() != null ? w.getSession() : "");
            result.add(m);
        }
        return result;
    }

    /**
     * Returns incidents that occurred during a race (safety cars, red flags, etc.).
     * GET /api/races/{raceId}/incidents
     */
    public List<Map<String, Object>> getIncidents(Long raceId) {
        List<Incident> incidents = incidentRepo.findByRaceIdOrderByLap(raceId);
        List<Map<String, Object>> result = new ArrayList<>();
        for (Incident i : incidents) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", i.getId());
            m.put("type", i.getType() != null ? i.getType().name() : "");
            m.put("lap", i.getLap());
            m.put("description", i.getDescription() != null ? i.getDescription() : "");
            m.put("safetyCarLaps", i.getSafetyCarLaps());
            result.add(m);
        }
        return result;
    }
}
