package backend.config.seeder;

import backend.model.Championship;
import backend.model.Circuit;
import backend.model.Race;
import backend.model.enums.ChampionshipType;
import backend.model.enums.CircuitType;
import backend.model.enums.RaceStatus;
import backend.repository.ChampionshipRepository;
import backend.repository.CircuitRepository;
import backend.repository.RaceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class CircuitRaceSeeder {

    private final CircuitRepository circuitRepo;
    private final RaceRepository raceRepo;
    private final ChampionshipRepository champRepo;

    /**
     * Seeds circuits, races and championships.
     * Returns the list of saved circuits.
     */
    public List<Circuit> seed() {
        List<Circuit> circuits = seedCircuits();
        seedRaces(circuits);
        seedChampionships();
        return circuits;
    }

    private List<Circuit> seedCircuits() {
        List<Circuit> circuits = circuitRepo.saveAll(List.of(
                Circuit.builder().name("Albert Park Circuit").country("Australia").city("Melbourne")
                        .type(CircuitType.STREET).totalLaps(58).lengthKm(5.278f).lapRecordSec(80.235f)
                        .lapRecordHolder("Charles Leclerc").turnCount(16).build(),
                Circuit.builder().name("Shanghai International Circuit").country("China").city("Shanghai")
                        .type(CircuitType.PERMANENT).totalLaps(56).lengthKm(5.451f).lapRecordSec(93.018f)
                        .lapRecordHolder("Michael Schumacher").turnCount(16).build(),
                Circuit.builder().name("Suzuka International Racing Course").country("Japan").city("Suzuka")
                        .type(CircuitType.PERMANENT).totalLaps(53).lengthKm(5.807f).lapRecordSec(90.983f)
                        .lapRecordHolder("Lando Norris").turnCount(18).build(),
                Circuit.builder().name("Bahrain International Circuit").country("Bahrain").city("Sakhir")
                        .type(CircuitType.PERMANENT).totalLaps(57).lengthKm(5.412f).lapRecordSec(91.447f)
                        .lapRecordHolder("Pedro de la Rosa").turnCount(15).build(),
                Circuit.builder().name("Jeddah Corniche Circuit").country("Saudi Arabia").city("Jeddah")
                        .type(CircuitType.STREET).totalLaps(50).lengthKm(6.174f).lapRecordSec(73.643f)
                        .lapRecordHolder("Lewis Hamilton").turnCount(27).build(),
                Circuit.builder().name("Miami International Autodrome").country("United States").city("Miami")
                        .type(CircuitType.STREET).totalLaps(57).lengthKm(5.412f).lapRecordSec(90.135f)
                        .lapRecordHolder("Max Verstappen").turnCount(19).build(),
                Circuit.builder().name("Circuit Gilles-Villeneuve").country("Canada").city("Montreal")
                        .type(CircuitType.STREET).totalLaps(70).lengthKm(4.361f).lapRecordSec(73.078f)
                        .lapRecordHolder("Valtteri Bottas").turnCount(14).build(),
                Circuit.builder().name("Circuit de Monaco").country("Monaco").city("Monte Carlo")
                        .type(CircuitType.STREET).totalLaps(78).lengthKm(3.337f).lapRecordSec(71.382f)
                        .lapRecordHolder("Rubens Barrichello").turnCount(19).build(),
                Circuit.builder().name("Circuit de Barcelona-Catalunya").country("Spain").city("Barcelona")
                        .type(CircuitType.PERMANENT).totalLaps(66).lengthKm(4.655f).lapRecordSec(82.797f)
                        .lapRecordHolder("Max Verstappen").turnCount(14).build(),
                Circuit.builder().name("Red Bull Ring").country("Austria").city("Spielberg")
                        .type(CircuitType.PERMANENT).totalLaps(71).lengthKm(4.318f).lapRecordSec(64.984f)
                        .lapRecordHolder("Carlos Sainz").turnCount(10).build(),
                Circuit.builder().name("Silverstone Circuit").country("United Kingdom").city("Silverstone")
                        .type(CircuitType.PERMANENT).totalLaps(52).lengthKm(5.891f).lapRecordSec(85.731f)
                        .lapRecordHolder("Max Verstappen").turnCount(18).build(),
                Circuit.builder().name("Circuit de Spa-Francorchamps").country("Belgium").city("Spa")
                        .type(CircuitType.PERMANENT).totalLaps(44).lengthKm(7.004f).lapRecordSec(103.069f)
                        .lapRecordHolder("Valtteri Bottas").turnCount(19).build(),
                Circuit.builder().name("Hungaroring").country("Hungary").city("Budapest")
                        .type(CircuitType.PERMANENT).totalLaps(70).lengthKm(4.381f).lapRecordSec(75.271f)
                        .lapRecordHolder("Lewis Hamilton").turnCount(14).build(),
                Circuit.builder().name("Circuit Zandvoort").country("Netherlands").city("Zandvoort")
                        .type(CircuitType.PERMANENT).totalLaps(72).lengthKm(4.259f).lapRecordSec(72.097f)
                        .lapRecordHolder("Max Verstappen").turnCount(14).build(),
                Circuit.builder().name("Autodromo Nazionale Monza").country("Italy").city("Monza")
                        .type(CircuitType.PERMANENT).totalLaps(53).lengthKm(5.793f).lapRecordSec(79.905f)
                        .lapRecordHolder("Rubens Barrichello").turnCount(11).build(),
                Circuit.builder().name("Madring Circuit").country("Spain").city("Madrid")
                        .type(CircuitType.STREET).totalLaps(55).lengthKm(5.474f).lapRecordSec(0f)
                        .lapRecordHolder("TBD").turnCount(20).build(),
                Circuit.builder().name("Baku City Circuit").country("Azerbaijan").city("Baku")
                        .type(CircuitType.STREET).totalLaps(51).lengthKm(6.003f).lapRecordSec(103.055f)
                        .lapRecordHolder("Charles Leclerc").turnCount(20).build(),
                Circuit.builder().name("Marina Bay Street Circuit").country("Singapore").city("Singapore")
                        .type(CircuitType.STREET).totalLaps(62).lengthKm(4.940f).lapRecordSec(93.931f)
                        .lapRecordHolder("Lewis Hamilton").turnCount(23).build(),
                Circuit.builder().name("Circuit of the Americas").country("United States").city("Austin")
                        .type(CircuitType.PERMANENT).totalLaps(56).lengthKm(5.513f).lapRecordSec(95.395f)
                        .lapRecordHolder("Charles Leclerc").turnCount(20).build(),
                Circuit.builder().name("Autodromo Hermanos Rodriguez").country("Mexico").city("Mexico City")
                        .type(CircuitType.PERMANENT).totalLaps(71).lengthKm(4.304f).lapRecordSec(79.135f)
                        .lapRecordHolder("Valtteri Bottas").turnCount(17).build(),
                Circuit.builder().name("Interlagos Circuit").country("Brazil").city("Sao Paulo")
                        .type(CircuitType.PERMANENT).totalLaps(71).lengthKm(4.309f).lapRecordSec(74.015f)
                        .lapRecordHolder("Rubens Barrichello").turnCount(15).build(),
                Circuit.builder().name("Las Vegas Strip Circuit").country("United States").city("Las Vegas")
                        .type(CircuitType.STREET).totalLaps(50).lengthKm(6.201f).lapRecordSec(93.456f)
                        .lapRecordHolder("Oscar Piastri").turnCount(17).build(),
                Circuit.builder().name("Lusail International Circuit").country("Qatar").city("Lusail")
                        .type(CircuitType.PERMANENT).totalLaps(57).lengthKm(5.380f).lapRecordSec(82.087f)
                        .lapRecordHolder("Max Verstappen").turnCount(16).build(),
                Circuit.builder().name("Yas Marina Circuit").country("UAE").city("Abu Dhabi")
                        .type(CircuitType.PERMANENT).totalLaps(58).lengthKm(5.281f).lapRecordSec(88.391f)
                        .lapRecordHolder("Max Verstappen").turnCount(16).build()
        ));
        log.info("[Pitwall] 24 circuits seeded");
        return circuits;
    }

    private void seedRaces(List<Circuit> circuits) {
        Map<String, Circuit> circuitMap = circuits.stream()
                .collect(Collectors.toMap(Circuit::getName, c -> c));

        raceRepo.saveAll(List.of(
                Race.builder().name("Australian Grand Prix").date(LocalDate.of(2026,3,8))
                        .season(2026).roundNumber(1).status(RaceStatus.COMPLETED).circuit(circuitMap.get("Albert Park Circuit")).build(),
                Race.builder().name("Chinese Grand Prix").date(LocalDate.of(2026,3,15))
                        .season(2026).roundNumber(2).status(RaceStatus.COMPLETED).circuit(circuitMap.get("Shanghai International Circuit")).build(),
                Race.builder().name("Japanese Grand Prix").date(LocalDate.of(2026,3,29))
                        .season(2026).roundNumber(3).status(RaceStatus.COMPLETED).circuit(circuitMap.get("Suzuka International Racing Course")).build(),
                Race.builder().name("Bahrain Grand Prix").date(LocalDate.of(2026,4,12))
                        .season(2026).roundNumber(4).status(RaceStatus.CANCELLED).circuit(circuitMap.get("Bahrain International Circuit")).build(),
                Race.builder().name("Saudi Arabian Grand Prix").date(LocalDate.of(2026,4,19))
                        .season(2026).roundNumber(5).status(RaceStatus.CANCELLED).circuit(circuitMap.get("Jeddah Corniche Circuit")).build(),
                Race.builder().name("Miami Grand Prix").date(LocalDate.of(2026,5,3))
                        .season(2026).roundNumber(6).status(RaceStatus.SCHEDULED).circuit(circuitMap.get("Miami International Autodrome")).build(),
                Race.builder().name("Canadian Grand Prix").date(LocalDate.of(2026,5,24))
                        .season(2026).roundNumber(7).status(RaceStatus.SCHEDULED).circuit(circuitMap.get("Circuit Gilles-Villeneuve")).build(),
                Race.builder().name("Monaco Grand Prix").date(LocalDate.of(2026,6,7))
                        .season(2026).roundNumber(8).status(RaceStatus.SCHEDULED).circuit(circuitMap.get("Circuit de Monaco")).build(),
                Race.builder().name("Barcelona-Catalunya Grand Prix").date(LocalDate.of(2026,6,14))
                        .season(2026).roundNumber(9).status(RaceStatus.SCHEDULED).circuit(circuitMap.get("Circuit de Barcelona-Catalunya")).build(),
                Race.builder().name("Austrian Grand Prix").date(LocalDate.of(2026,6,28))
                        .season(2026).roundNumber(10).status(RaceStatus.SCHEDULED).circuit(circuitMap.get("Red Bull Ring")).build(),
                Race.builder().name("British Grand Prix").date(LocalDate.of(2026,7,5))
                        .season(2026).roundNumber(11).status(RaceStatus.SCHEDULED).circuit(circuitMap.get("Silverstone Circuit")).build(),
                Race.builder().name("Belgian Grand Prix").date(LocalDate.of(2026,7,19))
                        .season(2026).roundNumber(12).status(RaceStatus.SCHEDULED).circuit(circuitMap.get("Circuit de Spa-Francorchamps")).build(),
                Race.builder().name("Hungarian Grand Prix").date(LocalDate.of(2026,7,26))
                        .season(2026).roundNumber(13).status(RaceStatus.SCHEDULED).circuit(circuitMap.get("Hungaroring")).build(),
                Race.builder().name("Dutch Grand Prix").date(LocalDate.of(2026,8,23))
                        .season(2026).roundNumber(14).status(RaceStatus.SCHEDULED).circuit(circuitMap.get("Circuit Zandvoort")).build(),
                Race.builder().name("Italian Grand Prix").date(LocalDate.of(2026,9,6))
                        .season(2026).roundNumber(15).status(RaceStatus.SCHEDULED).circuit(circuitMap.get("Autodromo Nazionale Monza")).build(),
                Race.builder().name("Spanish Grand Prix").date(LocalDate.of(2026,9,13))
                        .season(2026).roundNumber(16).status(RaceStatus.SCHEDULED).circuit(circuitMap.get("Madring Circuit")).build(),
                Race.builder().name("Azerbaijan Grand Prix").date(LocalDate.of(2026,9,26))
                        .season(2026).roundNumber(17).status(RaceStatus.SCHEDULED).circuit(circuitMap.get("Baku City Circuit")).build(),
                Race.builder().name("Singapore Grand Prix").date(LocalDate.of(2026,10,11))
                        .season(2026).roundNumber(18).status(RaceStatus.SCHEDULED).circuit(circuitMap.get("Marina Bay Street Circuit")).build(),
                Race.builder().name("United States Grand Prix").date(LocalDate.of(2026,10,25))
                        .season(2026).roundNumber(19).status(RaceStatus.SCHEDULED).circuit(circuitMap.get("Circuit of the Americas")).build(),
                Race.builder().name("Mexico City Grand Prix").date(LocalDate.of(2026,11,1))
                        .season(2026).roundNumber(20).status(RaceStatus.SCHEDULED).circuit(circuitMap.get("Autodromo Hermanos Rodriguez")).build(),
                Race.builder().name("São Paulo Grand Prix").date(LocalDate.of(2026,11,15))
                        .season(2026).roundNumber(21).status(RaceStatus.SCHEDULED).circuit(circuitMap.get("Interlagos Circuit")).build(),
                Race.builder().name("Las Vegas Grand Prix").date(LocalDate.of(2026,11,21))
                        .season(2026).roundNumber(22).status(RaceStatus.SCHEDULED).circuit(circuitMap.get("Las Vegas Strip Circuit")).build(),
                Race.builder().name("Qatar Grand Prix").date(LocalDate.of(2026,11,29))
                        .season(2026).roundNumber(23).status(RaceStatus.SCHEDULED).circuit(circuitMap.get("Lusail International Circuit")).build(),
                Race.builder().name("Abu Dhabi Grand Prix").date(LocalDate.of(2026,12,6))
                        .season(2026).roundNumber(24).status(RaceStatus.SCHEDULED).circuit(circuitMap.get("Yas Marina Circuit")).build(),

                // Sprint races — 6 rounds with sprints in the 2026 season
                Race.builder().name("Chinese Grand Prix Sprint").date(LocalDate.of(2026,3,22))
                        .season(2026).roundNumber(2).status(RaceStatus.COMPLETED).circuit(circuitMap.get("Shanghai International Circuit")).build(),
                Race.builder().name("Miami Grand Prix Sprint").date(LocalDate.of(2026,5,2))
                        .season(2026).roundNumber(6).status(RaceStatus.COMPLETED).circuit(circuitMap.get("Miami International Autodrome")).build(),
                Race.builder().name("Canadian Grand Prix Sprint").date(LocalDate.of(2026,5,23))
                        .season(2026).roundNumber(7).status(RaceStatus.SCHEDULED).circuit(circuitMap.get("Circuit Gilles-Villeneuve")).build(),
                Race.builder().name("British Grand Prix Sprint").date(LocalDate.of(2026,7,4))
                        .season(2026).roundNumber(11).status(RaceStatus.SCHEDULED).circuit(circuitMap.get("Silverstone Circuit")).build(),
                Race.builder().name("Dutch Grand Prix Sprint").date(LocalDate.of(2026,8,22))
                        .season(2026).roundNumber(14).status(RaceStatus.SCHEDULED).circuit(circuitMap.get("Circuit Zandvoort")).build(),
                Race.builder().name("Singapore Grand Prix Sprint").date(LocalDate.of(2026,10,10))
                        .season(2026).roundNumber(18).status(RaceStatus.SCHEDULED).circuit(circuitMap.get("Marina Bay Street Circuit")).build()
        ));
        log.info("[Pitwall] 30 races seeded (24 GP + 6 Sprint)");
    }

    private void seedChampionships() {
        champRepo.saveAll(List.of(
                Championship.builder().season(2026).type(ChampionshipType.DRIVERS)
                        .leaderName("Lando Norris").leaderPoints(0f).p2Gap(0f).p3Gap(0f).build(),
                Championship.builder().season(2026).type(ChampionshipType.CONSTRUCTORS)
                        .leaderName("McLaren").leaderPoints(0f).p2Gap(0f).p3Gap(0f).build()
        ));
        log.info("[Pitwall] Championships seeded (2026)");
    }
}
