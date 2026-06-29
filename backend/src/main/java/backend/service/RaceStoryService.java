package backend.service;

import backend.model.*;
import backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class RaceStoryService {

    private final PitStopRepository pitStopRepo;
    private final WeatherConditionRepository weatherRepo;
    private final IncidentRepository incidentRepo;

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
