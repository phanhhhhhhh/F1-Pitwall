package backend.config;

import backend.dto.RaceResultRequest;
import backend.model.*;
import backend.model.enums.*;
import backend.repository.*;
import backend.service.RaceResultService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final TeamRepository teamRepo;
    private final DriverRepository driverRepo;
    private final CircuitRepository circuitRepo;
    private final RaceRepository raceRepo;
    private final TyreCompoundRepository tyreRepo;
    private final ChampionshipRepository champRepo;
    private final UserRepository userRepo;
    private final EngineerRepository engineerRepo;
    private final PasswordEncoder passwordEncoder;
    private final RaceResultRepository raceResultRepo;
    private final RaceResultService raceResultService;

    @Override
    public void run(String... args) {
        System.out.println("🚀 [Pitwall] DataSeeder starting...");
        try {
            seedUsers();
            System.out.println("✅ Users seeded");
            if (teamRepo.count() > 0) {
                System.out.println("⚠️ Data already exists, skipping...");
                return;
            }
            seedTyres();
            List<Team> teams = seedTeams();
            seedDrivers(teams);
            seedEngineers(teams);
            List<Circuit> circuits = seedCircuits();
            seedRaces(circuits);
            seedChampionships();
            seedRaceResults(raceRepo.findAll(), driverRepo.findAll());
        } catch (Exception e) {
            System.err.println("❌ DataSeeder failed: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void seedUsers() {
        if (!userRepo.existsByUsername("admin")) {
            userRepo.save(User.builder().username("admin")
                    .password(passwordEncoder.encode("pitwall2024"))
                    .email("admin@pitwall.f1").role(User.Role.ADMIN).build());
            System.out.println("🏁 [Pitwall] Admin seeded");
        }
        if (!userRepo.existsByUsername("engineer")) {
            userRepo.save(User.builder().username("engineer")
                    .password(passwordEncoder.encode("telemetry2024"))
                    .email("engineer@pitwall.f1").role(User.Role.ENGINEER).build());
        }
    }

    private void seedTyres() {
        tyreRepo.saveAll(List.of(
                TyreCompound.builder().name("Pirelli C1 Hard").type(TyreType.HARD)
                        .optimalTempMin(100f).optimalTempMax(130f).degradationRate(0.3f).maxLaps(40).build(),
                TyreCompound.builder().name("Pirelli C3 Medium").type(TyreType.MEDIUM)
                        .optimalTempMin(90f).optimalTempMax(120f).degradationRate(0.5f).maxLaps(30).build(),
                TyreCompound.builder().name("Pirelli C5 Soft").type(TyreType.SOFT)
                        .optimalTempMin(80f).optimalTempMax(110f).degradationRate(0.8f).maxLaps(20).build(),
                TyreCompound.builder().name("Pirelli Intermediate").type(TyreType.INTERMEDIATE)
                        .optimalTempMin(50f).optimalTempMax(80f).degradationRate(0.6f).maxLaps(25).build(),
                TyreCompound.builder().name("Pirelli Full Wet").type(TyreType.WET)
                        .optimalTempMin(30f).optimalTempMax(60f).degradationRate(0.4f).maxLaps(30).build()
        ));
    }

    private List<Team> seedTeams() {
        List<Team> teams = teamRepo.saveAll(List.of(
                Team.builder().name("McLaren").country("United Kingdom").colorHex("#FF8000")
                        .championships(9).annualBudgetM(350f).base("Woking").foundedYear(1966).build(),
                Team.builder().name("Ferrari").country("Italy").colorHex("#E8002D")
                        .championships(16).annualBudgetM(450f).base("Maranello").foundedYear(1950).build(),
                Team.builder().name("Red Bull Racing").country("Austria").colorHex("#3671C6")
                        .championships(6).annualBudgetM(400f).base("Milton Keynes").foundedYear(2005).build(),
                Team.builder().name("Mercedes-AMG Petronas").country("Germany").colorHex("#27F4D2")
                        .championships(8).annualBudgetM(430f).base("Brackley").foundedYear(1954).build(),
                Team.builder().name("Aston Martin").country("United Kingdom").colorHex("#358C75")
                        .championships(0).annualBudgetM(280f).base("Silverstone").foundedYear(2021).build(),
                Team.builder().name("Williams").country("United Kingdom").colorHex("#005AFF")
                        .championships(9).annualBudgetM(180f).base("Grove").foundedYear(1977).build(),
                Team.builder().name("Haas").country("United States").colorHex("#B6BABD")
                        .championships(0).annualBudgetM(140f).base("Kannapolis").foundedYear(2016).build(),
                Team.builder().name("Racing Bulls").country("Italy").colorHex("#6692FF")
                        .championships(0).annualBudgetM(160f).base("Faenza").foundedYear(2006).build(),
                Team.builder().name("Alpine").country("France").colorHex("#FF69B4")
                        .championships(0).annualBudgetM(200f).base("Enstone").foundedYear(2021).build(),
                Team.builder().name("Audi").country("Germany").colorHex("#BB0000")
                        .championships(0).annualBudgetM(250f).base("Hinwil").foundedYear(2026).build(),
                Team.builder().name("Cadillac").country("United States").colorHex("#CC0000")
                        .championships(0).annualBudgetM(220f).base("Banbury").foundedYear(2026).build()
        ));
        System.out.println("🏎️ [Pitwall] 11 teams seeded (2026 grid)");
        return teams;
    }

    private void seedDrivers(List<Team> teams) {
        Team mclaren  = teams.get(0);
        Team ferrari  = teams.get(1);
        Team redbull  = teams.get(2);
        Team mercedes = teams.get(3);
        Team aston    = teams.get(4);
        Team williams = teams.get(5);
        Team haas     = teams.get(6);
        Team rb       = teams.get(7);
        Team alpine   = teams.get(8);
        Team audi     = teams.get(9);
        Team cadillac = teams.get(10);

        driverRepo.saveAll(List.of(

                Driver.builder().name("Lando Norris").carNumber(1).nationality("British")
                        .dateOfBirth(LocalDate.of(1999,11,13)).careerPoints(771).careerWins(8).careerPoles(7).team(mclaren).build(),
                Driver.builder().name("Oscar Piastri").carNumber(81).nationality("Australian")
                        .dateOfBirth(LocalDate.of(2001,4,6)).careerPoints(406).careerWins(5).careerPoles(3).team(mclaren).build(),

                Driver.builder().name("Lewis Hamilton").carNumber(44).nationality("British")
                        .dateOfBirth(LocalDate.of(1985,1,7)).careerPoints(4749).careerWins(104).careerPoles(104).team(ferrari).build(),
                Driver.builder().name("Charles Leclerc").carNumber(16).nationality("Monegasque")
                        .dateOfBirth(LocalDate.of(1997,10,16)).careerPoints(1137).careerWins(8).careerPoles(24).team(ferrari).build(),

                Driver.builder().name("Max Verstappen").carNumber(3).nationality("Dutch")
                        .dateOfBirth(LocalDate.of(1997,9,30)).careerPoints(2860).careerWins(63).careerPoles(42).team(redbull).build(),
                Driver.builder().name("Isack Hadjar").carNumber(6).nationality("French")
                        .dateOfBirth(LocalDate.of(2004,2,3)).careerPoints(0).careerWins(0).careerPoles(0).team(redbull).build(),

                Driver.builder().name("George Russell").carNumber(63).nationality("British")
                        .dateOfBirth(LocalDate.of(1998,2,15)).careerPoints(661).careerWins(4).careerPoles(4).team(mercedes).build(),
                Driver.builder().name("Kimi Antonelli").carNumber(12).nationality("Italian")
                        .dateOfBirth(LocalDate.of(2006,8,25)).careerPoints(0).careerWins(0).careerPoles(0).team(mercedes).build(),

                Driver.builder().name("Fernando Alonso").carNumber(14).nationality("Spanish")
                        .dateOfBirth(LocalDate.of(1981,7,29)).careerPoints(2264).careerWins(32).careerPoles(22).team(aston).build(),
                Driver.builder().name("Lance Stroll").carNumber(18).nationality("Canadian")
                        .dateOfBirth(LocalDate.of(1998,10,29)).careerPoints(270).careerWins(0).careerPoles(1).team(aston).build(),

                Driver.builder().name("Carlos Sainz").carNumber(55).nationality("Spanish")
                        .dateOfBirth(LocalDate.of(1994,9,1)).careerPoints(1166).careerWins(4).careerPoles(5).team(williams).build(),
                Driver.builder().name("Alexander Albon").carNumber(23).nationality("Thai")
                        .dateOfBirth(LocalDate.of(1996,3,23)).careerPoints(258).careerWins(0).careerPoles(0).team(williams).build(),

                Driver.builder().name("Esteban Ocon").carNumber(31).nationality("French")
                        .dateOfBirth(LocalDate.of(1996,9,17)).careerPoints(395).careerWins(1).careerPoles(0).team(haas).build(),
                Driver.builder().name("Oliver Bearman").carNumber(87).nationality("British")
                        .dateOfBirth(LocalDate.of(2005,5,8)).careerPoints(0).careerWins(0).careerPoles(0).team(haas).build(),

                Driver.builder().name("Liam Lawson").carNumber(30).nationality("New Zealand")
                        .dateOfBirth(LocalDate.of(2002,2,11)).careerPoints(16).careerWins(0).careerPoles(0).team(rb).build(),
                Driver.builder().name("Arvid Lindblad").carNumber(41).nationality("British")
                        .dateOfBirth(LocalDate.of(2007,6,12)).careerPoints(0).careerWins(0).careerPoles(0).team(rb).build(),

                Driver.builder().name("Pierre Gasly").carNumber(10).nationality("French")
                        .dateOfBirth(LocalDate.of(1996,2,7)).careerPoints(421).careerWins(1).careerPoles(0).team(alpine).build(),
                Driver.builder().name("Franco Colapinto").carNumber(43).nationality("Argentine")
                        .dateOfBirth(LocalDate.of(2003,5,27)).careerPoints(5).careerWins(0).careerPoles(0).team(alpine).build(),

                Driver.builder().name("Nico Hulkenberg").carNumber(27).nationality("German")
                        .dateOfBirth(LocalDate.of(1987,8,19)).careerPoints(530).careerWins(0).careerPoles(1).team(audi).build(),
                Driver.builder().name("Gabriel Bortoleto").carNumber(5).nationality("Brazilian")
                        .dateOfBirth(LocalDate.of(2004,10,14)).careerPoints(0).careerWins(0).careerPoles(0).team(audi).build(),

                Driver.builder().name("Sergio Perez").carNumber(11).nationality("Mexican")
                        .dateOfBirth(LocalDate.of(1990,1,26)).careerPoints(1330).careerWins(6).careerPoles(3).team(cadillac).build(),
                Driver.builder().name("Valtteri Bottas").carNumber(77).nationality("Finnish")
                        .dateOfBirth(LocalDate.of(1989,8,28)).careerPoints(1795).careerWins(10).careerPoles(20).team(cadillac).build()
        ));
        System.out.println("🏎️ [Pitwall] 22 drivers seeded (2026 grid)");
    }

    private void seedEngineers(List<Team> teams) {
        engineerRepo.saveAll(List.of(
                Engineer.builder().name("Andrea Stella").specialization("Team Principal").nationality("Italian").team(teams.get(0)).build(),
                Engineer.builder().name("Frederic Vasseur").specialization("Team Principal").nationality("French").team(teams.get(1)).build(),
                Engineer.builder().name("Christian Horner").specialization("Team Principal").nationality("British").team(teams.get(2)).build(),
                Engineer.builder().name("Toto Wolff").specialization("Team Principal").nationality("Austrian").team(teams.get(3)).build(),
                Engineer.builder().name("Adrian Newey").specialization("Chief Technical Officer").nationality("British").team(teams.get(4)).build()
        ));
        System.out.println("🔧 [Pitwall] Engineers seeded");
    }

    private List<Circuit> seedCircuits() {
        List<Circuit> circuits = circuitRepo.saveAll(List.of(
                // R1
                Circuit.builder().name("Albert Park Circuit").country("Australia").city("Melbourne")
                        .type(CircuitType.STREET).totalLaps(58).lengthKm(5.278f).lapRecordSec(80.235f)
                        .lapRecordHolder("Charles Leclerc").turnCount(16).build(),
                // R2
                Circuit.builder().name("Shanghai International Circuit").country("China").city("Shanghai")
                        .type(CircuitType.PERMANENT).totalLaps(56).lengthKm(5.451f).lapRecordSec(93.018f)
                        .lapRecordHolder("Michael Schumacher").turnCount(16).build(),
                // R3
                Circuit.builder().name("Suzuka International Racing Course").country("Japan").city("Suzuka")
                        .type(CircuitType.PERMANENT).totalLaps(53).lengthKm(5.807f).lapRecordSec(90.983f)
                        .lapRecordHolder("Lando Norris").turnCount(18).build(),
                // R4 — CANCELLED
                Circuit.builder().name("Bahrain International Circuit").country("Bahrain").city("Sakhir")
                        .type(CircuitType.PERMANENT).totalLaps(57).lengthKm(5.412f).lapRecordSec(91.447f)
                        .lapRecordHolder("Pedro de la Rosa").turnCount(15).build(),
                // R5 — CANCELLED
                Circuit.builder().name("Jeddah Corniche Circuit").country("Saudi Arabia").city("Jeddah")
                        .type(CircuitType.STREET).totalLaps(50).lengthKm(6.174f).lapRecordSec(73.643f)
                        .lapRecordHolder("Lewis Hamilton").turnCount(27).build(),
                // R6
                Circuit.builder().name("Miami International Autodrome").country("United States").city("Miami")
                        .type(CircuitType.STREET).totalLaps(57).lengthKm(5.412f).lapRecordSec(90.135f)
                        .lapRecordHolder("Max Verstappen").turnCount(19).build(),
                // R7
                Circuit.builder().name("Circuit Gilles-Villeneuve").country("Canada").city("Montreal")
                        .type(CircuitType.STREET).totalLaps(70).lengthKm(4.361f).lapRecordSec(73.078f)
                        .lapRecordHolder("Valtteri Bottas").turnCount(14).build(),
                // R8
                Circuit.builder().name("Circuit de Monaco").country("Monaco").city("Monte Carlo")
                        .type(CircuitType.STREET).totalLaps(78).lengthKm(3.337f).lapRecordSec(71.382f)
                        .lapRecordHolder("Rubens Barrichello").turnCount(19).build(),
                // R9
                Circuit.builder().name("Circuit de Barcelona-Catalunya").country("Spain").city("Barcelona")
                        .type(CircuitType.PERMANENT).totalLaps(66).lengthKm(4.655f).lapRecordSec(82.797f)
                        .lapRecordHolder("Max Verstappen").turnCount(14).build(),
                // R10
                Circuit.builder().name("Red Bull Ring").country("Austria").city("Spielberg")
                        .type(CircuitType.PERMANENT).totalLaps(71).lengthKm(4.318f).lapRecordSec(64.984f)
                        .lapRecordHolder("Carlos Sainz").turnCount(10).build(),
                // R11
                Circuit.builder().name("Silverstone Circuit").country("United Kingdom").city("Silverstone")
                        .type(CircuitType.PERMANENT).totalLaps(52).lengthKm(5.891f).lapRecordSec(85.731f)
                        .lapRecordHolder("Max Verstappen").turnCount(18).build(),
                // R12
                Circuit.builder().name("Circuit de Spa-Francorchamps").country("Belgium").city("Spa")
                        .type(CircuitType.PERMANENT).totalLaps(44).lengthKm(7.004f).lapRecordSec(103.069f)
                        .lapRecordHolder("Valtteri Bottas").turnCount(19).build(),
                // R13
                Circuit.builder().name("Hungaroring").country("Hungary").city("Budapest")
                        .type(CircuitType.PERMANENT).totalLaps(70).lengthKm(4.381f).lapRecordSec(75.271f)
                        .lapRecordHolder("Lewis Hamilton").turnCount(14).build(),
                // R14
                Circuit.builder().name("Circuit Zandvoort").country("Netherlands").city("Zandvoort")
                        .type(CircuitType.PERMANENT).totalLaps(72).lengthKm(4.259f).lapRecordSec(72.097f)
                        .lapRecordHolder("Max Verstappen").turnCount(14).build(),
                // R15
                Circuit.builder().name("Autodromo Nazionale Monza").country("Italy").city("Monza")
                        .type(CircuitType.PERMANENT).totalLaps(53).lengthKm(5.793f).lapRecordSec(79.905f)
                        .lapRecordHolder("Rubens Barrichello").turnCount(11).build(),
                // R16 — NEW Madrid circuit
                Circuit.builder().name("Madring Circuit").country("Spain").city("Madrid")
                        .type(CircuitType.STREET).totalLaps(55).lengthKm(5.474f).lapRecordSec(0f)
                        .lapRecordHolder("TBD").turnCount(20).build(),
                // R17
                Circuit.builder().name("Baku City Circuit").country("Azerbaijan").city("Baku")
                        .type(CircuitType.STREET).totalLaps(51).lengthKm(6.003f).lapRecordSec(103.055f)
                        .lapRecordHolder("Charles Leclerc").turnCount(20).build(),
                // R18
                Circuit.builder().name("Marina Bay Street Circuit").country("Singapore").city("Singapore")
                        .type(CircuitType.STREET).totalLaps(62).lengthKm(4.940f).lapRecordSec(93.931f)
                        .lapRecordHolder("Lewis Hamilton").turnCount(23).build(),
                // R19
                Circuit.builder().name("Circuit of the Americas").country("United States").city("Austin")
                        .type(CircuitType.PERMANENT).totalLaps(56).lengthKm(5.513f).lapRecordSec(95.395f)
                        .lapRecordHolder("Charles Leclerc").turnCount(20).build(),
                // R20
                Circuit.builder().name("Autodromo Hermanos Rodriguez").country("Mexico").city("Mexico City")
                        .type(CircuitType.PERMANENT).totalLaps(71).lengthKm(4.304f).lapRecordSec(79.135f)
                        .lapRecordHolder("Valtteri Bottas").turnCount(17).build(),
                // R21
                Circuit.builder().name("Interlagos Circuit").country("Brazil").city("Sao Paulo")
                        .type(CircuitType.PERMANENT).totalLaps(71).lengthKm(4.309f).lapRecordSec(74.015f)
                        .lapRecordHolder("Rubens Barrichello").turnCount(15).build(),
                // R22 (Las Vegas — Saturday race)
                Circuit.builder().name("Las Vegas Strip Circuit").country("United States").city("Las Vegas")
                        .type(CircuitType.STREET).totalLaps(50).lengthKm(6.201f).lapRecordSec(93.456f)
                        .lapRecordHolder("Oscar Piastri").turnCount(17).build(),
                // R23
                Circuit.builder().name("Lusail International Circuit").country("Qatar").city("Lusail")
                        .type(CircuitType.PERMANENT).totalLaps(57).lengthKm(5.380f).lapRecordSec(82.087f)
                        .lapRecordHolder("Max Verstappen").turnCount(16).build(),
                // R24
                Circuit.builder().name("Yas Marina Circuit").country("UAE").city("Abu Dhabi")
                        .type(CircuitType.PERMANENT).totalLaps(58).lengthKm(5.281f).lapRecordSec(88.391f)
                        .lapRecordHolder("Max Verstappen").turnCount(16).build()
        ));
        System.out.println("🏁 [Pitwall] 24 circuits seeded");
        return circuits;
    }

    private void seedRaces(List<Circuit> circuits) {
        raceRepo.saveAll(List.of(
                Race.builder().name("Australian Grand Prix").date(LocalDate.of(2026,3,8))
                        .season(2026).roundNumber(1).status(RaceStatus.COMPLETED).circuit(circuits.get(0)).build(),
                Race.builder().name("Chinese Grand Prix").date(LocalDate.of(2026,3,15))
                        .season(2026).roundNumber(2).status(RaceStatus.COMPLETED).circuit(circuits.get(1)).build(),
                Race.builder().name("Japanese Grand Prix").date(LocalDate.of(2026,3,29))
                        .season(2026).roundNumber(3).status(RaceStatus.COMPLETED).circuit(circuits.get(2)).build(),
                Race.builder().name("Bahrain Grand Prix").date(LocalDate.of(2026,4,12))
                        .season(2026).roundNumber(4).status(RaceStatus.CANCELLED).circuit(circuits.get(3)).build(),
                Race.builder().name("Saudi Arabian Grand Prix").date(LocalDate.of(2026,4,19))
                        .season(2026).roundNumber(5).status(RaceStatus.CANCELLED).circuit(circuits.get(4)).build(),
                Race.builder().name("Miami Grand Prix").date(LocalDate.of(2026,5,3))
                        .season(2026).roundNumber(6).status(RaceStatus.SCHEDULED).circuit(circuits.get(5)).build(),
                Race.builder().name("Canadian Grand Prix").date(LocalDate.of(2026,5,24))
                        .season(2026).roundNumber(7).status(RaceStatus.SCHEDULED).circuit(circuits.get(6)).build(),
                Race.builder().name("Monaco Grand Prix").date(LocalDate.of(2026,6,7))
                        .season(2026).roundNumber(8).status(RaceStatus.SCHEDULED).circuit(circuits.get(7)).build(),
                Race.builder().name("Barcelona-Catalunya Grand Prix").date(LocalDate.of(2026,6,14))
                        .season(2026).roundNumber(9).status(RaceStatus.SCHEDULED).circuit(circuits.get(8)).build(),
                Race.builder().name("Austrian Grand Prix").date(LocalDate.of(2026,6,28))
                        .season(2026).roundNumber(10).status(RaceStatus.SCHEDULED).circuit(circuits.get(9)).build(),
                Race.builder().name("British Grand Prix").date(LocalDate.of(2026,7,5))
                        .season(2026).roundNumber(11).status(RaceStatus.SCHEDULED).circuit(circuits.get(10)).build(),
                Race.builder().name("Belgian Grand Prix").date(LocalDate.of(2026,7,19))
                        .season(2026).roundNumber(12).status(RaceStatus.SCHEDULED).circuit(circuits.get(11)).build(),
                Race.builder().name("Hungarian Grand Prix").date(LocalDate.of(2026,7,26))
                        .season(2026).roundNumber(13).status(RaceStatus.SCHEDULED).circuit(circuits.get(12)).build(),
                Race.builder().name("Dutch Grand Prix").date(LocalDate.of(2026,8,23))
                        .season(2026).roundNumber(14).status(RaceStatus.SCHEDULED).circuit(circuits.get(13)).build(),
                Race.builder().name("Italian Grand Prix").date(LocalDate.of(2026,9,6))
                        .season(2026).roundNumber(15).status(RaceStatus.SCHEDULED).circuit(circuits.get(14)).build(),
                Race.builder().name("Spanish Grand Prix").date(LocalDate.of(2026,9,13))
                        .season(2026).roundNumber(16).status(RaceStatus.SCHEDULED).circuit(circuits.get(15)).build(),
                Race.builder().name("Azerbaijan Grand Prix").date(LocalDate.of(2026,9,26))
                        .season(2026).roundNumber(17).status(RaceStatus.SCHEDULED).circuit(circuits.get(16)).build(),
                Race.builder().name("Singapore Grand Prix").date(LocalDate.of(2026,10,11))
                        .season(2026).roundNumber(18).status(RaceStatus.SCHEDULED).circuit(circuits.get(17)).build(),
                Race.builder().name("United States Grand Prix").date(LocalDate.of(2026,10,25))
                        .season(2026).roundNumber(19).status(RaceStatus.SCHEDULED).circuit(circuits.get(18)).build(),
                Race.builder().name("Mexico City Grand Prix").date(LocalDate.of(2026,11,1))
                        .season(2026).roundNumber(20).status(RaceStatus.SCHEDULED).circuit(circuits.get(19)).build(),
                Race.builder().name("São Paulo Grand Prix").date(LocalDate.of(2026,11,15))
                        .season(2026).roundNumber(21).status(RaceStatus.SCHEDULED).circuit(circuits.get(20)).build(),
                Race.builder().name("Las Vegas Grand Prix").date(LocalDate.of(2026,11,21))
                        .season(2026).roundNumber(22).status(RaceStatus.SCHEDULED).circuit(circuits.get(21)).build(),
                Race.builder().name("Qatar Grand Prix").date(LocalDate.of(2026,11,29))
                        .season(2026).roundNumber(23).status(RaceStatus.SCHEDULED).circuit(circuits.get(22)).build(),
                Race.builder().name("Abu Dhabi Grand Prix").date(LocalDate.of(2026,12,6))
                        .season(2026).roundNumber(24).status(RaceStatus.SCHEDULED).circuit(circuits.get(23)).build()
        ));
        System.out.println("🗓️ [Pitwall] 24 races seeded");
    }

    private void seedChampionships() {
        champRepo.saveAll(List.of(
                Championship.builder().season(2026).type(ChampionshipType.DRIVERS)
                        .leaderName("Lando Norris").leaderPoints(0f).p2Gap(0f).p3Gap(0f).build(),
                Championship.builder().season(2026).type(ChampionshipType.CONSTRUCTORS)
                        .leaderName("McLaren").leaderPoints(0f).p2Gap(0f).p3Gap(0f).build()
        ));
        System.out.println("🏆 [Pitwall] Championships seeded (2026)");
    }

    private void seedRaceResults(List<Race> races, List<Driver> drivers) {
        if (raceResultRepo.count() > 0) return;

        java.util.function.Function<Integer, Long> driverId = (carNum) ->
            drivers.stream()
                .filter(d -> d.getCarNumber() == carNum)
                .findFirst()
                .map(backend.model.Driver::getId)
                .orElse(null);

        Race ausGP = races.stream().filter(r -> r.getRoundNumber() == 1).findFirst().orElse(null);
        if (ausGP != null) {
            List<RaceResultRequest> ausResults = buildResults(new int[][]{
                {63, 2, 1, 0}, {12, 5, 2, 0}, {1,  1, 3, 0}, {81, 4, 4, 1},
                {44, 3, 5, 0}, {16, 6, 6, 0}, {3,  7, 7, 0}, {55, 9, 8, 0},
                {14, 8, 9, 0}, {6, 10, 10, 0}, {27, 11, 11, 0}, {5,  12, 12, 0},
                {10, 13, 13, 0}, {43, 14, 14, 0}, {18, 15, 15, 0}, {23, 16, 16, 0},
                {87, 17, 17, 0}, {30, 18, 18, 0}, {31, 19, 19, 0}, {41, 20, 20, 0},
                {11, 21, 0, 0}, {77, 22, 0, 0},
            }, driverId);
            raceResultService.submitResults(ausGP.getId(), ausResults);
            System.out.println("🏁 [Pitwall] Australian GP results seeded");
        }

        Race chinaGP = races.stream().filter(r -> r.getRoundNumber() == 2).findFirst().orElse(null);
        if (chinaGP != null) {
            List<RaceResultRequest> chinaResults = buildResults(new int[][]{
                {12, 1, 1, 1}, {63, 3, 2, 0}, {1,  2, 3, 0}, {81, 4, 4, 0},
                {3,  5, 5, 0}, {44, 6, 6, 0}, {16, 7, 7, 0}, {55, 8, 8, 0},
                {6,  9, 9, 0}, {14, 10, 10, 0}, {5,  11, 11, 0}, {27, 12, 12, 0},
                {10, 13, 13, 0}, {18, 14, 14, 0}, {43, 15, 15, 0}, {23, 16, 16, 0},
                {87, 17, 17, 0}, {30, 18, 18, 0}, {77, 19, 19, 0}, {41, 20, 20, 0},
                {31, 21, 0, 0}, {11, 22, 0, 0},
            }, driverId);
            raceResultService.submitResults(chinaGP.getId(), chinaResults);
            System.out.println("🏁 [Pitwall] Chinese GP results seeded");
        }

        Race japanGP = races.stream().filter(r -> r.getRoundNumber() == 3).findFirst().orElse(null);
        if (japanGP != null) {
            List<RaceResultRequest> japanResults = buildResults(new int[][]{
                {12, 2, 1, 1}, {1,  1, 2, 0}, {63, 3, 3, 0}, {81, 4, 4, 0},
                {44, 5, 5, 0}, {3,  6, 6, 0}, {16, 7, 7, 0}, {55, 8, 8, 0},
                {14, 9, 9, 0}, {6, 10, 10, 0}, {27, 11, 11, 0}, {5,  12, 12, 0},
                {10, 13, 13, 0}, {43, 14, 14, 0}, {18, 15, 15, 0}, {23, 16, 16, 0},
                {87, 17, 17, 0}, {41, 18, 18, 0}, {30, 19, 19, 0}, {77, 20, 20, 0},
                {31, 21, 0, 0}, {11, 22, 0, 0},
            }, driverId);
            raceResultService.submitResults(japanGP.getId(), japanResults);
            System.out.println("🏁 [Pitwall] Japanese GP results seeded");
        }

        System.out.println("🏆 [Pitwall] Race results seeded — standings ready!");
    }

    private List<RaceResultRequest> buildResults(
            int[][] data,
            java.util.function.Function<Integer, Long> driverIdFn) {
        List<RaceResultRequest> list = new ArrayList<>();
        for (int[] row : data) {
            int carNum = row[0];
            int start  = row[1];
            int finish = row[2];
            boolean fl = row[3] == 1;
            Long id = driverIdFn.apply(carNum);
            if (id == null) continue;
            RaceResultRequest req = new RaceResultRequest();
            req.setDriverId(id);
            req.setStartPosition(start);
            req.setFinishPosition(finish);
            req.setHasFastestLap(fl);
            req.setFastestLapTime(0f);
            req.setFastestLapNumber(0);
            req.setDnfReason(finish == 0 ? "Mechanical" : null);
            list.add(req);
        }
        return list;
    }
}
