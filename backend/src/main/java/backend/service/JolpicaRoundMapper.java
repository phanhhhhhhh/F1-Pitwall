package backend.service;

import java.util.Map;

/**
 * Shared mapping from DB round numbers to Jolpica (Ergast mirror) round numbers.
 * <p>
 * The 2026 F1 season has 2 cancelled rounds (R4 Bahrain, R5 Saudi Arabia).
 * Jolpica re-indexes by removing cancelled rounds, so DB rounds ≥ 6 are
 * offset by -2 compared to Jolpica.
 * <p>
 * Both {@link OpenF1SyncService} and {@link QualifyingService} use this mapper
 * to ensure consistent Jolpica API URLs.
 */
public final class JolpicaRoundMapper {

    public static final String JOLPICA_BASE = "https://api.jolpi.ca/ergast/f1";

    /** Sentinel value for cancelled rounds that have no Jolpica counterpart. */
    public static final int CANCELLED = -1;

    /** Number of cancelled rounds before DB round 6 (2026: R4 Bahrain + R5 Saudi). */
    private static final int CANCELLED_BEFORE_R6 = 2;

    // Explicit map for rounds 1-9; rounds ≥ 10 use the formula dbRound - CANCELLED_BEFORE_R6.
    private static final Map<Integer, Integer> DB_TO_JOLPICA = Map.ofEntries(
            Map.entry(1, 1),
            Map.entry(2, 2),
            Map.entry(3, 3),
            Map.entry(4, CANCELLED),
            Map.entry(5, CANCELLED),
            Map.entry(6, 4),
            Map.entry(7, 5),
            Map.entry(8, 6),
            Map.entry(9, 7)
    );

    private JolpicaRoundMapper() {
        // utility class
    }

    /**
     * Converts a DB round number to the corresponding Jolpica round number.
     *
     * @param dbRound race round number from the database
     * @return Jolpica round number, or {@value #CANCELLED} if the round was cancelled
     */
    public static int toJolpicaRound(int dbRound) {
        if (dbRound <= 0) return CANCELLED;
        if (DB_TO_JOLPICA.containsKey(dbRound)) {
            return DB_TO_JOLPICA.get(dbRound);
        }
        // Rounds 10+ — offset by the number of cancelled rounds that precede them
        return dbRound - CANCELLED_BEFORE_R6;
    }

    /**
     * Builds the Jolpica URL for race results / sprint results.
     *
     * @param dbRound  DB round number
     * @param season   season year (e.g. 2026)
     * @param isSprint true for sprint results, false for race results
     * @return full Jolpica API URL
     */
    public static String buildResultsUrl(int dbRound, int season, boolean isSprint) {
        int jolpicaRound = toJolpicaRound(dbRound);
        String endpoint = isSprint ? "/sprint" : "/results";
        return JOLPICA_BASE + "/" + season + "/" + jolpicaRound + endpoint + ".json";
    }

    /**
     * Builds the Jolpica URL for qualifying results.
     *
     * @param dbRound DB round number
     * @param season  season year (e.g. 2026)
     * @return full Jolpica API URL
     */
    public static String buildQualifyingUrl(int dbRound, int season) {
        int jolpicaRound = toJolpicaRound(dbRound);
        return JOLPICA_BASE + "/" + season + "/" + jolpicaRound + "/qualifying.json";
    }
}
