package backend.config.seeder;

import backend.model.Championship;
import backend.model.Circuit;
import backend.model.Driver;
import backend.model.Race;
import backend.model.Team;
import backend.model.enums.ChampionshipType;
import backend.model.enums.CircuitType;
import backend.model.enums.RaceStatus;
import backend.repository.ChampionshipRepository;
import backend.repository.CircuitRepository;
import backend.repository.DriverRepository;
import backend.repository.RaceRepository;
import backend.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class Seeder2025 {

    private final TeamRepository teamRepo;
    private final DriverRepository driverRepo;
    private final CircuitRepository circuitRepo;
    private final RaceRepository raceRepo;
    private final ChampionshipRepository champRepo;

    public void seed() {
        if (!raceRepo.findBySeason(2025).isEmpty()) {
            System.out.println("[Pitwall] 2025 data already exists — skipping 2025 seeder");
            return;
        }
        System.out.println("[Pitwall] Seeder2025 starting...");

        List<Team> teams = seedTeams();
        seedDrivers(teams);
        List<Circuit> circuits = seedCircuits();
        seedRaces(circuits);
        seedChampionships();

        System.out.println("[Pitwall] 2025 season data seeded");
    }

    private List<Team> seedTeams() {
        Set<String> existingNames = teamRepo.findAll().stream()
                .map(Team::getName)
                .collect(Collectors.toSet());

        List<Team> newTeams = List.of(
                Team.builder().name("McLaren").country("United Kingdom").colorHex("#FF8000")
                        .championships(8).annualBudgetM(135f).base("Woking").foundedYear(1966).build(),
                Team.builder().name("Ferrari").country("Italy").colorHex("#DC0000")
                        .championships(16).annualBudgetM(150f).base("Maranello").foundedYear(1950).build(),
                Team.builder().name("Red Bull Racing").country("Austria").colorHex("#3671C6")
                        .championships(6).annualBudgetM(140f).base("Milton Keynes").foundedYear(2005).build(),
                Team.builder().name("Mercedes").country("Germany").colorHex("#27F1D2")
                        .championships(8).annualBudgetM(145f).base("Brackley").foundedYear(1954).build(),
                Team.builder().name("Aston Martin").country("United Kingdom").colorHex("#229971")
                        .championships(0).annualBudgetM(110f).base("Silverstone").foundedYear(2021).build(),
                Team.builder().name("Alpine").country("France").colorHex("#FF87BC")
                        .championships(0).annualBudgetM(90f).base("Enstone").foundedYear(2021).build(),
                Team.builder().name("Haas").country("United States").colorHex("#B6BABD")
                        .championships(0).annualBudgetM(75f).base("Kannapolis").foundedYear(2016).build(),
                Team.builder().name("RB").country("Italy").colorHex("#6692FF")
                        .championships(0).annualBudgetM(80f).base("Faenza").foundedYear(2006).build(),
                Team.builder().name("Williams").country("United Kingdom").colorHex("#64C4FF")
                        .championships(9).annualBudgetM(85f).base("Grove").foundedYear(1977).build(),
                Team.builder().name("Sauber").country("Switzerland").colorHex("#00E701")
                        .championships(0).annualBudgetM(70f).base("Hinwil").foundedYear(1993).build()
        );

        List<Team> teamsToSave = newTeams.stream()
                .filter(t -> !existingNames.contains(t.getName()))
                .collect(Collectors.toList());

        if (!teamsToSave.isEmpty()) {
            teamRepo.saveAll(teamsToSave);
        }

        System.out.println("[Pitwall] 10 teams seeded (2025 grid)");

        // Return all teams (existing + new)
        return newTeams.stream()
                .map(t -> teamRepo.findByName(t.getName()).orElse(t))
                .collect(Collectors.toList());
    }

    private void seedDrivers(List<Team> teams) {
        Map<String, Team> teamMap = teams.stream()
                .collect(Collectors.toMap(Team::getName, t -> t));

        Set<String> existingNames = driverRepo.findAll().stream()
                .map(Driver::getName)
                .collect(Collectors.toSet());

        Team mclaren  = teamMap.get("McLaren");
        Team ferrari  = teamMap.get("Ferrari");
        Team redbull  = teamMap.get("Red Bull Racing");
        Team mercedes = teamMap.get("Mercedes");
        Team aston    = teamMap.get("Aston Martin");
        Team alpine   = teamMap.get("Alpine");
        Team haas     = teamMap.get("Haas");
        Team rb       = teamMap.get("RB");
        Team williams = teamMap.get("Williams");
        Team sauber   = teamMap.get("Sauber");

        List<Driver> drivers = List.of(
                Driver.builder().name("Max Verstappen").carNumber(1).nationality("Dutch")
                        .dateOfBirth(LocalDate.of(1997,9,30)).careerPoints(2860).careerWins(63).careerPoles(42).team(redbull).build(),
                Driver.builder().name("Liam Lawson").carNumber(30).nationality("New Zealand")
                        .dateOfBirth(LocalDate.of(2002,2,11)).careerPoints(16).careerWins(0).careerPoles(0).team(redbull).build(),

                Driver.builder().name("Lando Norris").carNumber(4).nationality("British")
                        .dateOfBirth(LocalDate.of(1999,11,13)).careerPoints(771).careerWins(8).careerPoles(7).team(mclaren).build(),
                Driver.builder().name("Oscar Piastri").carNumber(81).nationality("Australian")
                        .dateOfBirth(LocalDate.of(2001,4,6)).careerPoints(406).careerWins(5).careerPoles(3).team(mclaren).build(),

                Driver.builder().name("Charles Leclerc").carNumber(16).nationality("Monegasque")
                        .dateOfBirth(LocalDate.of(1997,10,16)).careerPoints(1137).careerWins(8).careerPoles(24).team(ferrari).build(),
                Driver.builder().name("Lewis Hamilton").carNumber(44).nationality("British")
                        .dateOfBirth(LocalDate.of(1985,1,7)).careerPoints(4749).careerWins(104).careerPoles(104).team(ferrari).build(),

                Driver.builder().name("George Russell").carNumber(63).nationality("British")
                        .dateOfBirth(LocalDate.of(1998,2,15)).careerPoints(661).careerWins(4).careerPoles(4).team(mercedes).build(),
                Driver.builder().name("Andrea Kimi Antonelli").carNumber(12).nationality("Italian")
                        .dateOfBirth(LocalDate.of(2006,8,25)).careerPoints(0).careerWins(0).careerPoles(0).team(mercedes).build(),

                Driver.builder().name("Fernando Alonso").carNumber(14).nationality("Spanish")
                        .dateOfBirth(LocalDate.of(1981,7,29)).careerPoints(2264).careerWins(32).careerPoles(22).team(aston).build(),
                Driver.builder().name("Lance Stroll").carNumber(18).nationality("Canadian")
                        .dateOfBirth(LocalDate.of(1998,10,29)).careerPoints(270).careerWins(0).careerPoles(1).team(aston).build(),

                Driver.builder().name("Pierre Gasly").carNumber(10).nationality("French")
                        .dateOfBirth(LocalDate.of(1996,2,7)).careerPoints(421).careerWins(1).careerPoles(0).team(alpine).build(),
                Driver.builder().name("Jack Doohan").carNumber(7).nationality("Australian")
                        .dateOfBirth(LocalDate.of(2003,1,20)).careerPoints(0).careerWins(0).careerPoles(0).team(alpine).build(),

                Driver.builder().name("Oliver Bearman").carNumber(87).nationality("British")
                        .dateOfBirth(LocalDate.of(2005,5,8)).careerPoints(0).careerWins(0).careerPoles(0).team(haas).build(),
                Driver.builder().name("Esteban Ocon").carNumber(31).nationality("French")
                        .dateOfBirth(LocalDate.of(1996,9,17)).careerPoints(395).careerWins(1).careerPoles(0).team(haas).build(),

                Driver.builder().name("Yuki Tsunoda").carNumber(22).nationality("Japanese")
                        .dateOfBirth(LocalDate.of(2000,5,11)).careerPoints(80).careerWins(0).careerPoles(0).team(rb).build(),
                Driver.builder().name("Isack Hadjar").carNumber(6).nationality("French")
                        .dateOfBirth(LocalDate.of(2004,2,3)).careerPoints(0).careerWins(0).careerPoles(0).team(rb).build(),

                Driver.builder().name("Alexander Albon").carNumber(23).nationality("Thai")
                        .dateOfBirth(LocalDate.of(1996,3,23)).careerPoints(258).careerWins(0).careerPoles(0).team(williams).build(),
                Driver.builder().name("Carlos Sainz").carNumber(55).nationality("Spanish")
                        .dateOfBirth(LocalDate.of(1994,9,1)).careerPoints(1166).careerWins(4).careerPoles(5).team(williams).build(),

                Driver.builder().name("Nico Hulkenberg").carNumber(27).nationality("German")
                        .dateOfBirth(LocalDate.of(1987,8,19)).careerPoints(530).careerWins(0).careerPoles(1).team(sauber).build(),
                Driver.builder().name("Gabriel Bortoleto").carNumber(5).nationality("Brazilian")
                        .dateOfBirth(LocalDate.of(2004,10,14)).careerPoints(0).careerWins(0).careerPoles(0).team(sauber).build()
        );

        List<Driver> driversToSave = drivers.stream()
                .filter(d -> !existingNames.contains(d.getName()))
                .collect(Collectors.toList());

        if (!driversToSave.isEmpty()) {
            driverRepo.saveAll(driversToSave);
        }
        System.out.println("[Pitwall] 20 drivers seeded (2025 grid)");
    }

    private List<Circuit> seedCircuits() {
        Set<String> existingNames = circuitRepo.findAll().stream()
                .map(Circuit::getName)
                .collect(Collectors.toSet());

        List<Circuit> newCircuits = List.of(
                Circuit.builder().name("Albert Park Circuit").country("Australia").city("Melbourne")
                        .type(CircuitType.STREET).totalLaps(58).lengthKm(5.278f).lapRecordSec(80.235f)
                        .lapRecordHolder("Charles Leclerc").turnCount(16).build(),
                Circuit.builder().name("Shanghai International Circuit").country("China").city("Shanghai")
                        .type(CircuitType.PERMANENT).totalLaps(56).lengthKm(5.451f).lapRecordSec(92.018f)
                        .lapRecordHolder("Michael Schumacher").turnCount(16).build(),
                Circuit.builder().name("Suzuka Circuit").country("Japan").city("Suzuka")
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
                Circuit.builder().name("Autodromo Enzo e Dino Ferrari").country("Italy").city("Imola")
                        .type(CircuitType.PERMANENT).totalLaps(63).lengthKm(4.909f).lapRecordSec(78.844f)
                        .lapRecordHolder("Lewis Hamilton").turnCount(19).build(),
                Circuit.builder().name("Circuit de Monaco").country("Monaco").city("Monte Carlo")
                        .type(CircuitType.STREET).totalLaps(78).lengthKm(3.337f).lapRecordSec(71.382f)
                        .lapRecordHolder("Rubens Barrichello").turnCount(19).build(),
                Circuit.builder().name("Circuit de Barcelona-Catalunya").country("Spain").city("Barcelona")
                        .type(CircuitType.PERMANENT).totalLaps(66).lengthKm(4.655f).lapRecordSec(82.797f)
                        .lapRecordHolder("Max Verstappen").turnCount(14).build(),
                Circuit.builder().name("Circuit Gilles Villeneuve").country("Canada").city("Montreal")
                        .type(CircuitType.STREET).totalLaps(70).lengthKm(4.361f).lapRecordSec(73.078f)
                        .lapRecordHolder("Valtteri Bottas").turnCount(14).build(),
                Circuit.builder().name("Red Bull Ring").country("Austria").city("Spielberg")
                        .type(CircuitType.PERMANENT).totalLaps(71).lengthKm(4.318f).lapRecordSec(66.984f)
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
                Circuit.builder().name("Autodromo Jose Carlos Pace").country("Brazil").city("Sao Paulo")
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
        );

        List<Circuit> toSave = newCircuits.stream()
                .filter(c -> !existingNames.contains(c.getName()))
                .collect(Collectors.toList());

        if (!toSave.isEmpty()) {
            circuitRepo.saveAll(toSave);
        }

        System.out.println("[Pitwall] Circuits seeded (2025 calendar)");

        // Return all circuits (existing + new)
        return newCircuits.stream()
                .map(c -> circuitRepo.findAll().stream()
                        .filter(existing -> existing.getName().equals(c.getName()))
                        .findFirst().orElse(c))
                .collect(Collectors.toList());
    }

    private void seedRaces(List<Circuit> circuits) {
        Map<String, Circuit> circuitMap = circuits.stream()
                .collect(Collectors.toMap(Circuit::getName, c -> c));

        raceRepo.saveAll(List.of(
                Race.builder().name("Australian Grand Prix").date(LocalDate.of(2025,3,16))
                        .season(2025).roundNumber(1).status(RaceStatus.SCHEDULED)
                        .circuit(circuitMap.get("Albert Park Circuit")).build(),
                Race.builder().name("Chinese Grand Prix").date(LocalDate.of(2025,3,23))
                        .season(2025).roundNumber(2).status(RaceStatus.SCHEDULED)
                        .circuit(circuitMap.get("Shanghai International Circuit")).build(),
                Race.builder().name("Japanese Grand Prix").date(LocalDate.of(2025,4,6))
                        .season(2025).roundNumber(3).status(RaceStatus.SCHEDULED)
                        .circuit(circuitMap.get("Suzuka Circuit")).build(),
                Race.builder().name("Bahrain Grand Prix").date(LocalDate.of(2025,4,13))
                        .season(2025).roundNumber(4).status(RaceStatus.SCHEDULED)
                        .circuit(circuitMap.get("Bahrain International Circuit")).build(),
                Race.builder().name("Saudi Arabian Grand Prix").date(LocalDate.of(2025,4,20))
                        .season(2025).roundNumber(5).status(RaceStatus.SCHEDULED)
                        .circuit(circuitMap.get("Jeddah Corniche Circuit")).build(),
                Race.builder().name("Miami Grand Prix").date(LocalDate.of(2025,5,4))
                        .season(2025).roundNumber(6).status(RaceStatus.SCHEDULED)
                        .circuit(circuitMap.get("Miami International Autodrome")).build(),
                Race.builder().name("Emilia Romagna Grand Prix").date(LocalDate.of(2025,5,18))
                        .season(2025).roundNumber(7).status(RaceStatus.SCHEDULED)
                        .circuit(circuitMap.get("Autodromo Enzo e Dino Ferrari")).build(),
                Race.builder().name("Monaco Grand Prix").date(LocalDate.of(2025,5,25))
                        .season(2025).roundNumber(8).status(RaceStatus.SCHEDULED)
                        .circuit(circuitMap.get("Circuit de Monaco")).build(),
                Race.builder().name("Spanish Grand Prix").date(LocalDate.of(2025,6,8))
                        .season(2025).roundNumber(9).status(RaceStatus.SCHEDULED)
                        .circuit(circuitMap.get("Circuit de Barcelona-Catalunya")).build(),
                Race.builder().name("Canadian Grand Prix").date(LocalDate.of(2025,6,15))
                        .season(2025).roundNumber(10).status(RaceStatus.SCHEDULED)
                        .circuit(circuitMap.get("Circuit Gilles Villeneuve")).build(),
                Race.builder().name("Austrian Grand Prix").date(LocalDate.of(2025,6,29))
                        .season(2025).roundNumber(11).status(RaceStatus.SCHEDULED)
                        .circuit(circuitMap.get("Red Bull Ring")).build(),
                Race.builder().name("British Grand Prix").date(LocalDate.of(2025,7,6))
                        .season(2025).roundNumber(12).status(RaceStatus.SCHEDULED)
                        .circuit(circuitMap.get("Silverstone Circuit")).build(),
                Race.builder().name("Belgian Grand Prix").date(LocalDate.of(2025,7,27))
                        .season(2025).roundNumber(13).status(RaceStatus.SCHEDULED)
                        .circuit(circuitMap.get("Circuit de Spa-Francorchamps")).build(),
                Race.builder().name("Hungarian Grand Prix").date(LocalDate.of(2025,8,3))
                        .season(2025).roundNumber(14).status(RaceStatus.SCHEDULED)
                        .circuit(circuitMap.get("Hungaroring")).build(),
                Race.builder().name("Dutch Grand Prix").date(LocalDate.of(2025,8,31))
                        .season(2025).roundNumber(15).status(RaceStatus.SCHEDULED)
                        .circuit(circuitMap.get("Circuit Zandvoort")).build(),
                Race.builder().name("Italian Grand Prix").date(LocalDate.of(2025,9,7))
                        .season(2025).roundNumber(16).status(RaceStatus.SCHEDULED)
                        .circuit(circuitMap.get("Autodromo Nazionale Monza")).build(),
                Race.builder().name("Azerbaijan Grand Prix").date(LocalDate.of(2025,9,21))
                        .season(2025).roundNumber(17).status(RaceStatus.SCHEDULED)
                        .circuit(circuitMap.get("Baku City Circuit")).build(),
                Race.builder().name("Singapore Grand Prix").date(LocalDate.of(2025,10,5))
                        .season(2025).roundNumber(18).status(RaceStatus.SCHEDULED)
                        .circuit(circuitMap.get("Marina Bay Street Circuit")).build(),
                Race.builder().name("United States Grand Prix").date(LocalDate.of(2025,10,19))
                        .season(2025).roundNumber(19).status(RaceStatus.SCHEDULED)
                        .circuit(circuitMap.get("Circuit of the Americas")).build(),
                Race.builder().name("Mexico City Grand Prix").date(LocalDate.of(2025,10,26))
                        .season(2025).roundNumber(20).status(RaceStatus.SCHEDULED)
                        .circuit(circuitMap.get("Autodromo Hermanos Rodriguez")).build(),
                Race.builder().name("São Paulo Grand Prix").date(LocalDate.of(2025,11,9))
                        .season(2025).roundNumber(21).status(RaceStatus.SCHEDULED)
                        .circuit(circuitMap.get("Autodromo Jose Carlos Pace")).build(),
                Race.builder().name("Las Vegas Grand Prix").date(LocalDate.of(2025,11,22))
                        .season(2025).roundNumber(22).status(RaceStatus.SCHEDULED)
                        .circuit(circuitMap.get("Las Vegas Strip Circuit")).build(),
                Race.builder().name("Qatar Grand Prix").date(LocalDate.of(2025,11,30))
                        .season(2025).roundNumber(23).status(RaceStatus.SCHEDULED)
                        .circuit(circuitMap.get("Lusail International Circuit")).build(),
                Race.builder().name("Abu Dhabi Grand Prix").date(LocalDate.of(2025,12,7))
                        .season(2025).roundNumber(24).status(RaceStatus.SCHEDULED)
                        .circuit(circuitMap.get("Yas Marina Circuit")).build()
        ));
        System.out.println("[Pitwall] 24 races seeded (2025 season)");
    }

    private void seedChampionships() {
        champRepo.saveAll(List.of(
                Championship.builder().season(2025).type(ChampionshipType.DRIVERS)
                        .leaderName("TBD").leaderPoints(0f).p2Gap(0f).p3Gap(0f).build(),
                Championship.builder().season(2025).type(ChampionshipType.CONSTRUCTORS)
                        .leaderName("TBD").leaderPoints(0f).p2Gap(0f).p3Gap(0f).build()
        ));
        System.out.println("[Pitwall] Championships seeded (2025)");
    }
}
