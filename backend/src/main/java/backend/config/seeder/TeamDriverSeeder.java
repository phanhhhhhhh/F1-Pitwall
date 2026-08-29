package backend.config.seeder;

import backend.model.Driver;
import backend.model.Engineer;
import backend.model.Team;
import backend.model.TyreCompound;
import backend.model.enums.TyreType;
import backend.repository.DriverRepository;
import backend.repository.EngineerRepository;
import backend.repository.TeamRepository;
import backend.repository.TyreCompoundRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class TeamDriverSeeder {

    private final TeamRepository teamRepo;
    private final DriverRepository driverRepo;
    private final EngineerRepository engineerRepo;
    private final TyreCompoundRepository tyreRepo;

    /**
     * Seeds tyre compounds, teams, drivers and engineers.
     * Returns the list of saved teams so downstream seeders can reference them.
     */
    public List<Team> seed() {
        seedTyres();
        List<Team> teams = seedTeams();
        seedDrivers(teams);
        seedEngineers(teams);
        return teams;
    }

    private void seedTyres() {
        if (tyreRepo.count() > 0) {
            log.info("[Pitwall] Tyres already exist — skipping tyre seeding");
            return;
        }
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
        // Create missing teams one-by-one — the 2025 seeder runs first and may
        // already have created part of the grid under different names (RB,
        // Mercedes, Sauber). Skipping everything when "McLaren" exists left
        // the new 2026 teams (Racing Bulls, Cadillac, Audi, …) unseeded.
        List<Team> grid = List.of(
                Team.builder().name("McLaren").country("United Kingdom").colorHex("#FF8000")
                        .accentHex("#00E5FF").engineSupplier("Mercedes").carName("MCL40").teamPrincipal("Andrea Stella")
                        .championships(9).annualBudgetM(350f).base("Woking").foundedYear(1966).build(),
                Team.builder().name("Ferrari").country("Italy").colorHex("#E8002D")
                        .accentHex("#FFD200").engineSupplier("Ferrari").carName("SF-26").teamPrincipal("Frederic Vasseur")
                        .championships(16).annualBudgetM(450f).base("Maranello").foundedYear(1950).build(),
                Team.builder().name("Red Bull Racing").country("Austria").colorHex("#3671C6")
                        .accentHex("#E10600").engineSupplier("Red Bull Ford").carName("RB22").teamPrincipal("Laurent Mekies")
                        .championships(6).annualBudgetM(400f).base("Milton Keynes").foundedYear(2005).build(),
                Team.builder().name("Mercedes-AMG Petronas").country("Germany").colorHex("#27F4D2")
                        .accentHex("#C0C0C0").engineSupplier("Mercedes").carName("W17").teamPrincipal("Toto Wolff")
                        .championships(8).annualBudgetM(430f).base("Brackley").foundedYear(1954).build(),
                Team.builder().name("Aston Martin").country("United Kingdom").colorHex("#358C75")
                        .accentHex("#CEDC00").engineSupplier("Honda").carName("AMR26").teamPrincipal("Andy Cowell")
                        .championships(0).annualBudgetM(280f).base("Silverstone").foundedYear(2021).build(),
                Team.builder().name("Williams").country("United Kingdom").colorHex("#005AFF")
                        .accentHex("#00A0DE").engineSupplier("Mercedes").carName("FW48").teamPrincipal("James Vowles")
                        .championships(9).annualBudgetM(180f).base("Grove").foundedYear(1977).build(),
                Team.builder().name("Haas").country("United States").colorHex("#B6BABD")
                        .accentHex("#E10600").engineSupplier("Ferrari").carName("VF-26").teamPrincipal("Ayao Komatsu")
                        .championships(0).annualBudgetM(140f).base("Kannapolis").foundedYear(2016).build(),
                Team.builder().name("Racing Bulls").country("Italy").colorHex("#6692FF")
                        .accentHex("#FFFFFF").engineSupplier("Red Bull Ford").carName("VCARB 03").teamPrincipal("Alan Permane")
                        .championships(0).annualBudgetM(160f).base("Faenza").foundedYear(2006).build(),
                Team.builder().name("Alpine").country("France").colorHex("#FF69B4")
                        .accentHex("#0090FF").engineSupplier("Mercedes").carName("A526").teamPrincipal("Flavio Briatore")
                        .championships(0).annualBudgetM(200f).base("Enstone").foundedYear(2021).build(),
                Team.builder().name("Audi").country("Germany").colorHex("#BB0000")
                        .accentHex("#EDEDED").engineSupplier("Audi").carName("R26").teamPrincipal("Jonathan Wheatley")
                        .championships(0).annualBudgetM(250f).base("Hinwil").foundedYear(2026).build(),
                Team.builder().name("Cadillac").country("United States").colorHex("#CC0000")
                        .accentHex("#FFD200").engineSupplier("Ferrari").carName("C26").teamPrincipal("Graeme Lowdon")
                        .championships(0).annualBudgetM(220f).base("Banbury").foundedYear(2026).build()
        );
        Set<String> existingNames = teamRepo.findAll().stream()
                .map(Team::getName)
                .collect(Collectors.toSet());
        List<Team> toSave = grid.stream()
                .filter(t -> !existingNames.contains(t.getName()))
                .collect(Collectors.toList());
        if (!toSave.isEmpty()) {
            teamRepo.saveAll(toSave);
            log.info("[Pitwall] {} new teams seeded (2026 grid)", toSave.size());
        } else {
            log.info("[Pitwall] All 2026 grid teams already exist");
        }

        // Return the full grid (existing or freshly saved rows) so downstream
        // seeders can resolve every team by name.
        List<Team> resolved = grid.stream()
                .map(t -> teamRepo.findByName(t.getName()).orElse(t))
                .collect(Collectors.toList());

        backfillLivery(grid, resolved);
        return resolved;
    }

    /**
     * Fills in livery details on teams that were seeded before those columns existed.
     *
     * <p>The insert pass above skips any team that is already in the database, so on an existing
     * deployment every row would keep a null accent colour and engine supplier — which the 3D car
     * inspector needs. Only null fields are written, so an admin edit is never overwritten.
     */
    private void backfillLivery(List<Team> grid, List<Team> resolved) {
        Map<String, Team> defaults = grid.stream()
                .collect(Collectors.toMap(Team::getName, t -> t));

        List<Team> updated = new java.util.ArrayList<>();
        for (Team team : resolved) {
            if (team.getId() == null) continue; // freshly built row, already carries the defaults
            Team spec = defaults.get(team.getName());
            if (spec == null) continue;

            boolean dirty = false;
            if (isBlank(team.getAccentHex())) { team.setAccentHex(spec.getAccentHex()); dirty = true; }
            if (isBlank(team.getEngineSupplier())) { team.setEngineSupplier(spec.getEngineSupplier()); dirty = true; }
            if (isBlank(team.getCarName())) { team.setCarName(spec.getCarName()); dirty = true; }
            if (isBlank(team.getTeamPrincipal())) { team.setTeamPrincipal(spec.getTeamPrincipal()); dirty = true; }
            if (dirty) updated.add(team);
        }

        if (!updated.isEmpty()) {
            teamRepo.saveAll(updated);
            log.info("[Pitwall] Livery details backfilled for {} teams", updated.size());
        }
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private void seedDrivers(List<Team> teams) {
        Map<String, Team> teamMap = teams.stream()
                .collect(Collectors.toMap(Team::getName, t -> t));

        // Idempotency: skip drivers whose name or carNumber already exist (e.g. from Seeder2025)
        var allExisting = driverRepo.findAll();
        var existingNames = allExisting.stream()
                .map(Driver::getName).collect(Collectors.toSet());
        var existingCarNumbers = allExisting.stream()
                .map(Driver::getCarNumber).collect(Collectors.toSet());

        Team mclaren  = teamMap.get("McLaren");
        Team ferrari  = teamMap.get("Ferrari");
        Team redbull  = teamMap.get("Red Bull Racing");
        Team mercedes = teamMap.get("Mercedes-AMG Petronas");
        Team aston    = teamMap.get("Aston Martin");
        Team williams = teamMap.get("Williams");
        Team haas     = teamMap.get("Haas");
        Team rb       = teamMap.get("Racing Bulls");
        Team alpine   = teamMap.get("Alpine");
        Team audi     = teamMap.get("Audi");
        Team cadillac = teamMap.get("Cadillac");

        var drivers = List.of(
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
        );

        var toSave = drivers.stream()
                .filter(d -> !existingNames.contains(d.getName())
                        && !existingCarNumbers.contains(d.getCarNumber()))
                .collect(Collectors.toList());
        if (!toSave.isEmpty()) {
            driverRepo.saveAll(toSave);
        }
        log.info("[Pitwall] {} drivers seeded (2026 grid)", toSave.size());

        // Backfill: assign teams to drivers that were created without one
        // (e.g. rookies seeded before their 2026 teams existed on the first
        // deploy — Lindblad, Perez, Bottas).
        for (Driver gridDriver : drivers) {
            if (gridDriver.getTeam() == null) continue;
            driverRepo.findByCarNumber(gridDriver.getCarNumber()).ifPresent(existing -> {
                if (existing.getTeam() == null) {
                    existing.setTeam(gridDriver.getTeam());
                    driverRepo.save(existing);
                    log.info("[Pitwall] Backfilled team for {}: {}", existing.getName(), gridDriver.getTeam().getName());
                }
            });
        }
    }

    private void seedEngineers(List<Team> teams) {
        if (engineerRepo.count() > 0) {
            log.info("[Pitwall] Engineers already exist — skipping engineer seeding");
            return;
        }
        Map<String, Team> teamMap = teams.stream()
                .collect(Collectors.toMap(Team::getName, t -> t));

        engineerRepo.saveAll(List.of(
                Engineer.builder().name("Andrea Stella").specialization("Team Principal").nationality("Italian").team(teamMap.get("McLaren")).build(),
                Engineer.builder().name("Frederic Vasseur").specialization("Team Principal").nationality("French").team(teamMap.get("Ferrari")).build(),
                Engineer.builder().name("Christian Horner").specialization("Team Principal").nationality("British").team(teamMap.get("Red Bull Racing")).build(),
                Engineer.builder().name("Toto Wolff").specialization("Team Principal").nationality("Austrian").team(teamMap.get("Mercedes-AMG Petronas")).build(),
                Engineer.builder().name("Adrian Newey").specialization("Chief Technical Officer").nationality("British").team(teamMap.get("Aston Martin")).build()
        ));
        log.info("[Pitwall] Engineers seeded");
    }
}
