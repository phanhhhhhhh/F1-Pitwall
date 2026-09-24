package backend;

import backend.repository.QualifyingResultRepository;
import backend.repository.RaceRepository;
import backend.service.QualifyingService;
import backend.model.QualifyingResult;
import backend.model.Driver;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("QualifyingService — mapping & detection logic")
class QualifyingServiceTest {

    @Mock QualifyingResultRepository qualifyingRepo;
    @Mock RaceRepository raceRepo;
    @InjectMocks QualifyingService service;

    // isSprintRace is private in QualifyingService; we test the qualifying result
    // mapping via getQualifyingResults, which exercises the DTO transformation
    // and lazy-load chain.

    @Nested
    @DisplayName("getQualifyingResults — DTO mapping")
    class QualifyingResultsMapping {

        @Test
        @DisplayName("empty results list produces empty response")
        void emptyResultsList() {
            when(qualifyingRepo.findByRaceIdOrderByGridPosition(1L)).thenReturn(List.of());

            List<Map<String, Object>> result = service.getQualifyingResults(1L);
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("maps driver name and team when present")
        void mapsDriverAndTeam() {
            var team = backend.model.Team.builder().id(1L).name("McLaren").colorHex("#FF8000").build();
            var driver = Driver.builder().id(1L).name("Lando Norris").carNumber(1)
                    .team(team).nationality("British").build();

            var qr = QualifyingResult.builder()
                    .id(1L).gridPosition(1)
                    .driver(driver)
                    .q1Time(79.5).q2Time(78.9).q3Time(78.5).bestTime(78.5)
                    .eliminatedQ1(false).eliminatedQ2(false)
                    .build();

            when(qualifyingRepo.findByRaceIdOrderByGridPosition(1L)).thenReturn(List.of(qr));

            List<Map<String, Object>> result = service.getQualifyingResults(1L);
            assertThat(result).hasSize(1);
            Map<String, Object> entry = result.get(0);

            assertThat(entry).containsEntry("driverName", "Lando Norris");
            assertThat(entry).containsEntry("teamName", "McLaren");
            assertThat(entry).containsEntry("teamColor", "#FF8000");
            assertThat(entry).containsEntry("carNumber", 1);
            assertThat(entry).containsEntry("gridPosition", 1);
            assertThat(entry).containsEntry("bestTime", "1:18.500");
        }

        @Test
        @DisplayName("handles null driver gracefully")
        void handlesNullDriver() {
            var qr = QualifyingResult.builder()
                    .id(1L).gridPosition(1)
                    .driver(null)
                    .build();

            when(qualifyingRepo.findByRaceIdOrderByGridPosition(1L)).thenReturn(List.of(qr));

            List<Map<String, Object>> result = service.getQualifyingResults(1L);
            assertThat(result).hasSize(1);

            Map<String, Object> entry = result.get(0);
            assertThat(entry).containsEntry("driverName", "");
            assertThat(entry).containsEntry("teamName", "");
            assertThat(entry).containsEntry("carNumber", 0);
        }
    }
}
