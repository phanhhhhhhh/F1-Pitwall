package backend.config;

import backend.model.*;
import backend.model.enums.*;
import backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
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

    @Override
    public void run(String... args) {
        seedUsers();
        if (teamRepo.count() > 0) return;
        seedTyres();
        List<Team> teams = seedTeams();
        seedDrivers(teams);
        seedEngineers(teams);
        List<Circuit> circuits = seedCircuits();
        seedRaces(circuits);
        seedChampionships();
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
                .optimalTempMin(80f).optimalTempMax(110f).degradationRate(0.8f).maxLaps(20).build()
        ));
    }

    private List<Team> seedTeams() {
        return teamRepo.saveAll(List.of(
            Team.builder().name("Red Bull Racing").country("Austria").colorHex("#3671C6")
                .championships(6).annualBudgetM(400f).base("Milton Keynes").foundedYear(2005).build(),
            Team.builder().name("Ferrari").country("Italy").colorHex("#E8002D")
                .championships(16).annualBudgetM(450f).base("Maranello").foundedYear(1950).build(),
            Team.builder().name("Mercedes-AMG Petronas").country("Germany").colorHex("#27F4D2")
                .championships(8).annualBudgetM(430f).base("Brackley").foundedYear(1954).build(),
            Team.builder().name("McLaren").country("United Kingdom").colorHex("#FF8000")
                .championships(8).annualBudgetM(300f).base("Woking").foundedYear(1966).build(),
            Team.builder().name("Aston Martin").country("United Kingdom").colorHex("#358C75")
                .championships(0).annualBudgetM(250f).base("Silverstone").foundedYear(2021).build()
        ));
    }

    private void seedDrivers(List<Team> teams) {
        Team rb = teams.get(0), fe = teams.get(1), me = teams.get(2), mc = teams.get(3), am = teams.get(4);
        driverRepo.saveAll(List.of(
            Driver.builder().name("Max Verstappen").carNumber(1).nationality("Dutch")
                .dateOfBirth(LocalDate.of(1997,9,30)).careerPoints(2586).careerWins(61).careerPoles(40).team(rb).build(),
            Driver.builder().name("Sergio Perez").carNumber(11).nationality("Mexican")
                .dateOfBirth(LocalDate.of(1990,1,26)).careerPoints(1330).careerWins(6).careerPoles(3).team(rb).build(),
            Driver.builder().name("Lewis Hamilton").carNumber(44).nationality("British")
                .dateOfBirth(LocalDate.of(1985,1,7)).careerPoints(4639).careerWins(103).careerPoles(104).team(fe).build(),
            Driver.builder().name("Charles Leclerc").carNumber(16).nationality("Monegasque")
                .dateOfBirth(LocalDate.of(1997,10,16)).careerPoints(1032).careerWins(8).careerPoles(24).team(fe).build(),
            Driver.builder().name("George Russell").carNumber(63).nationality("British")
                .dateOfBirth(LocalDate.of(1998,2,15)).careerPoints(551).careerWins(2).careerPoles(2).team(me).build(),
            Driver.builder().name("Lando Norris").carNumber(4).nationality("British")
                .dateOfBirth(LocalDate.of(1999,11,13)).careerPoints(662).careerWins(3).careerPoles(5).team(mc).build(),
            Driver.builder().name("Oscar Piastri").carNumber(81).nationality("Australian")
                .dateOfBirth(LocalDate.of(2001,4,6)).careerPoints(292).careerWins(2).careerPoles(1).team(mc).build(),
            Driver.builder().name("Fernando Alonso").carNumber(14).nationality("Spanish")
                .dateOfBirth(LocalDate.of(1981,7,29)).careerPoints(2264).careerWins(32).careerPoles(22).team(am).build()
        ));
        System.out.println("🏎️ [Pitwall] 8 drivers seeded");
    }

    private void seedEngineers(List<Team> teams) {
        engineerRepo.saveAll(List.of(
            Engineer.builder().name("Adrian Newey").specialization("Aerodynamics").nationality("British").team(teams.get(0)).build(),
            Engineer.builder().name("Enrico Cardile").specialization("Aerodynamics").nationality("Italian").team(teams.get(1)).build(),
            Engineer.builder().name("James Allison").specialization("Technical Director").nationality("British").team(teams.get(2)).build()
        ));
    }

    private List<Circuit> seedCircuits() {
        return circuitRepo.saveAll(List.of(
            Circuit.builder().name("Bahrain International Circuit").country("Bahrain").city("Sakhir")
                .type(CircuitType.PERMANENT).totalLaps(57).lengthKm(5.412f).lapRecordSec(91.447f)
                .lapRecordHolder("Pedro de la Rosa").turnCount(15).build(),
            Circuit.builder().name("Circuit de Monaco").country("Monaco").city("Monte Carlo")
                .type(CircuitType.STREET).totalLaps(78).lengthKm(3.337f).lapRecordSec(71.382f)
                .lapRecordHolder("Rubens Barrichello").turnCount(19).build(),
            Circuit.builder().name("Silverstone Circuit").country("United Kingdom").city("Silverstone")
                .type(CircuitType.PERMANENT).totalLaps(52).lengthKm(5.891f).lapRecordSec(85.731f)
                .lapRecordHolder("Max Verstappen").turnCount(18).build(),
            Circuit.builder().name("Autodromo Nazionale Monza").country("Italy").city("Monza")
                .type(CircuitType.PERMANENT).totalLaps(53).lengthKm(5.793f).lapRecordSec(79.905f)
                .lapRecordHolder("Rubens Barrichello").turnCount(11).build()
        ));
    }

    private void seedRaces(List<Circuit> circuits) {
        raceRepo.saveAll(List.of(
            Race.builder().name("Bahrain Grand Prix").date(LocalDate.of(2024,3,2))
                .season(2024).roundNumber(1).status(RaceStatus.COMPLETED).circuit(circuits.get(0)).build(),
            Race.builder().name("Monaco Grand Prix").date(LocalDate.of(2024,5,26))
                .season(2024).roundNumber(8).status(RaceStatus.COMPLETED).circuit(circuits.get(1)).build(),
            Race.builder().name("British Grand Prix").date(LocalDate.of(2024,7,7))
                .season(2024).roundNumber(12).status(RaceStatus.COMPLETED).circuit(circuits.get(2)).build(),
            Race.builder().name("Italian Grand Prix").date(LocalDate.of(2024,9,1))
                .season(2024).roundNumber(16).status(RaceStatus.COMPLETED).circuit(circuits.get(3)).build()
        ));
        System.out.println("🏁 [Pitwall] Circuits & Races seeded");
    }

    private void seedChampionships() {
        champRepo.saveAll(List.of(
            Championship.builder().season(2024).type(ChampionshipType.DRIVERS)
                .leaderName("Max Verstappen").leaderPoints(575f).p2Gap(63f).p3Gap(100f).build(),
            Championship.builder().season(2024).type(ChampionshipType.CONSTRUCTORS)
                .leaderName("Red Bull Racing").leaderPoints(860f).p2Gap(100f).p3Gap(180f).build()
        ));
        System.out.println("🏆 [Pitwall] Championships seeded");
    }
}
