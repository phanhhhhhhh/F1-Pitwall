package backend.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Name matching between our circuit records and the OpenF1 session feed.
 *
 * <p>This is the step that decides which real Grand Prix a circuit's 3D geometry is traced from, and
 * getting it wrong is silent: the page would render a plausible-looking racing line belonging to a
 * different track. Every circuit on the calendar is checked against the whole season's sessions, so
 * a matcher change that starts confusing two venues fails here rather than in production.
 */
@DisplayName("Circuit name matching")
class CircuitMatchingTest {

    /** A race session as the OpenF1 feed reports it. */
    private record Session(String country, String shortName, String location) {}

    /** The 2025 race calendar as OpenF1 publishes it — the feed the matcher runs against. */
    private static final List<Session> OPENF1_2025 = List.of(
            new Session("Australia", "Melbourne", "Melbourne"),
            new Session("China", "Shanghai", "Shanghai"),
            new Session("Japan", "Suzuka", "Suzuka"),
            new Session("Bahrain", "Sakhir", "Sakhir"),
            new Session("Saudi Arabia", "Jeddah", "Jeddah"),
            new Session("United States", "Miami", "Miami"),
            new Session("Italy", "Imola", "Imola"),
            new Session("Monaco", "Monte Carlo", "Monaco"),
            new Session("Spain", "Catalunya", "Barcelona"),
            new Session("Canada", "Montreal", "Montréal"),
            new Session("Austria", "Spielberg", "Spielberg"),
            new Session("United Kingdom", "Silverstone", "Silverstone"),
            new Session("Belgium", "Spa-Francorchamps", "Spa-Francorchamps"),
            new Session("Hungary", "Hungaroring", "Budapest"),
            new Session("Netherlands", "Zandvoort", "Zandvoort"),
            new Session("Italy", "Monza", "Monza"),
            new Session("Azerbaijan", "Baku", "Baku"),
            new Session("Singapore", "Singapore", "Singapore"),
            new Session("United States", "Austin", "Austin"),
            new Session("Mexico", "Mexico City", "Mexico City"),
            new Session("Brazil", "Interlagos", "São Paulo"),
            new Session("United States", "Las Vegas", "Las Vegas"),
            new Session("Qatar", "Lusail", "Lusail"),
            new Session("United Arab Emirates", "Yas Marina Circuit", "Yas Marina Circuit")
    );

    /** Picks the best session in a country, mirroring how the service scores candidates. */
    private static Session bestMatch(String circuitName, String city, String country) {
        Set<String> ours = CircuitMatching.tokens(circuitName + " " + city);

        List<Session> inCountry = OPENF1_2025.stream()
                .filter(s -> s.country().equalsIgnoreCase(country))
                .toList();

        Session best = null;
        int bestScore = 0;
        for (Session session : inCountry) {
            int score = CircuitMatching.overlap(
                    ours, CircuitMatching.tokens(session.shortName() + " " + session.location()));
            if (score > bestScore) {
                bestScore = score;
                best = session;
            }
        }
        return bestScore > 0 ? best : null;
    }

    @ParameterizedTest(name = "{0} → {3}")
    @CsvSource({
            "Albert Park Circuit,            Melbourne,   Australia,            Melbourne",
            "Shanghai International Circuit,  Shanghai,    China,                Shanghai",
            "Suzuka International Racing Course, Suzuka,   Japan,                Suzuka",
            "Bahrain International Circuit,   Sakhir,      Bahrain,              Sakhir",
            "Jeddah Corniche Circuit,         Jeddah,      Saudi Arabia,         Jeddah",
            "Miami International Autodrome,   Miami,       United States,        Miami",
            "Circuit Gilles-Villeneuve,       Montreal,    Canada,               Montreal",
            "Circuit de Monaco,               Monte Carlo, Monaco,               Monte Carlo",
            "Circuit de Barcelona-Catalunya,  Barcelona,   Spain,                Catalunya",
            "Red Bull Ring,                   Spielberg,   Austria,              Spielberg",
            "Silverstone Circuit,             Silverstone, United Kingdom,       Silverstone",
            "Circuit de Spa-Francorchamps,    Spa,         Belgium,              Spa-Francorchamps",
            "Hungaroring,                     Budapest,    Hungary,              Hungaroring",
            "Circuit Zandvoort,               Zandvoort,   Netherlands,          Zandvoort",
            "Autodromo Nazionale Monza,       Monza,       Italy,                Monza",
            "Baku City Circuit,               Baku,        Azerbaijan,           Baku",
            "Marina Bay Street Circuit,       Singapore,   Singapore,            Singapore",
            "Circuit of the Americas,         Austin,      United States,        Austin",
            "Autodromo Hermanos Rodriguez,    Mexico City, Mexico,               Mexico City",
            "Interlagos Circuit,              Sao Paulo,   Brazil,               Interlagos",
            "Las Vegas Strip Circuit,         Las Vegas,   United States,        Las Vegas",
            "Lusail International Circuit,    Lusail,      Qatar,                Lusail",
            "Yas Marina Circuit,              Abu Dhabi,   United Arab Emirates, Yas Marina Circuit",
    })
    @DisplayName("every calendar circuit resolves to its own session")
    void everyCircuitMatchesItself(String name, String city, String country, String expectedShortName) {
        Session match = bestMatch(name.trim(), city.trim(), country.trim());

        assertThat(match).as("no session matched %s", name).isNotNull();
        assertThat(match.shortName()).isEqualTo(expectedShortName.trim());
    }

    @Test
    @DisplayName("Monza and Imola are not confused with each other")
    void italyIsDisambiguated() {
        assertThat(bestMatch("Autodromo Nazionale Monza", "Monza", "Italy").shortName())
                .isEqualTo("Monza");
        assertThat(bestMatch("Autodromo Enzo e Dino Ferrari", "Imola", "Italy").shortName())
                .isEqualTo("Imola");
    }

    @Test
    @DisplayName("the three United States rounds stay distinct")
    void americanRoundsAreDistinct() {
        assertThat(bestMatch("Miami International Autodrome", "Miami", "United States").shortName())
                .isEqualTo("Miami");
        assertThat(bestMatch("Circuit of the Americas", "Austin", "United States").shortName())
                .isEqualTo("Austin");
        assertThat(bestMatch("Las Vegas Strip Circuit", "Las Vegas", "United States").shortName())
                .isEqualTo("Las Vegas");
    }

    @Test
    @DisplayName("a new venue does not inherit the racing line of its country's other race")
    void newVenueDoesNotBorrowGeometry() {
        // Madrid joins the calendar in 2026 and has no OpenF1 history. Spain's only 2025 race was
        // Barcelona, so a country-only match would hand Madrid the wrong circuit entirely.
        assertThat(bestMatch("Madring Circuit", "Madrid", "Spain")).isNull();
    }

    @Test
    @DisplayName("a country with no session at all yields no match")
    void unknownCountryYieldsNothing() {
        assertThat(bestMatch("Kyalami Grand Prix Circuit", "Johannesburg", "South Africa")).isNull();
    }

    @Test
    @DisplayName("no circuit scores higher against another venue than against its own")
    void noCrossCircuitConfusion() {
        record Entry(String name, String city, String country, String expected) {}
        List<Entry> calendar = new ArrayList<>(List.of(
                new Entry("Autodromo Nazionale Monza", "Monza", "Italy", "Monza"),
                new Entry("Circuit de Barcelona-Catalunya", "Barcelona", "Spain", "Catalunya"),
                new Entry("Circuit de Spa-Francorchamps", "Spa", "Belgium", "Spa-Francorchamps"),
                new Entry("Yas Marina Circuit", "Abu Dhabi", "United Arab Emirates", "Yas Marina Circuit"),
                new Entry("Interlagos Circuit", "Sao Paulo", "Brazil", "Interlagos"),
                new Entry("Hungaroring", "Budapest", "Hungary", "Hungaroring")
        ));

        for (Entry entry : calendar) {
            Set<String> ours = CircuitMatching.tokens(entry.name() + " " + entry.city());
            int ownScore = OPENF1_2025.stream()
                    .filter(s -> s.shortName().equals(entry.expected()))
                    .mapToInt(s -> CircuitMatching.overlap(
                            ours, CircuitMatching.tokens(s.shortName() + " " + s.location())))
                    .max()
                    .orElse(0);

            assertThat(ownScore).as("%s must match its own session", entry.name()).isPositive();

            for (Session other : OPENF1_2025) {
                if (other.shortName().equals(entry.expected())) continue;
                int otherScore = CircuitMatching.overlap(
                        ours, CircuitMatching.tokens(other.shortName() + " " + other.location()));
                assertThat(otherScore)
                        .as("%s must not match %s more strongly than its own session",
                                entry.name(), other.shortName())
                        .isLessThan(ownScore);
            }
        }
    }

    @Test
    @DisplayName("strips accents so São Paulo and Montréal still match")
    void accentsDoNotBreakMatching() {
        assertThat(CircuitMatching.tokens("São Paulo")).contains("sao", "paulo");
        assertThat(CircuitMatching.tokens("Montréal")).contains("montreal");
    }

    @Test
    @DisplayName("drops filler words that every circuit name contains")
    void stopwordsCarryNoSignal() {
        Set<String> tokens = CircuitMatching.tokens("Circuit International de Racing Park");
        assertThat(tokens).isEmpty();
    }
}
