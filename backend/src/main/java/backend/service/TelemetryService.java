package backend.service;

import backend.model.LapTelemetry;
import backend.model.RaceResult;
import backend.repository.LapTelemetryRepository;
import backend.repository.RaceResultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TelemetryService {
    private final LapTelemetryRepository lapTelemetryRepository;
    private final RaceResultRepository raceResultRepository;

    public List<LapTelemetry> getByRaceResult(Long raceResultId) {
        return lapTelemetryRepository.findByRaceResultIdOrderByLapNumber(raceResultId);
    }

    public LapTelemetry addLap(Long raceResultId, LapTelemetry lap) {
        RaceResult result = raceResultRepository.findById(raceResultId)
                .orElseThrow(() -> new RuntimeException("RaceResult not found: " + raceResultId));
        lap.setRaceResult(result);
        return lapTelemetryRepository.save(lap);
    }

    public void delete(Long id) {
        lapTelemetryRepository.deleteById(id);
    }
}
