package backend.service;

import backend.model.Circuit;

import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static backend.service.FeedValues.doubleOf;
import static backend.service.FeedValues.nullSafe;

/**
 * Matches our circuit records against external feeds (OpenF1 sessions, the GeoJSON map dataset)
 * by significant name words, falling back to coordinates. Pure logic — no I/O — so it is
 * unit-tested on its own.
 */
final class CircuitMatching {

    private CircuitMatching() {}

    static final Map<String, String> COUNTRY_ALIASES = Map.of(
            "UAE", "United Arab Emirates",
            "USA", "United States",
            "UK", "United Kingdom"
    );

    /** Words that appear in almost every circuit name and so carry no matching signal. */
    static final Set<String> STOPWORDS = Set.of(
            "circuit", "de", "international", "autodromo", "autodrome", "nazionale", "street",
            "racing", "course", "grand", "prix", "the", "of", "city", "park", "ring"
    );

    static Optional<Map<String, Object>> matchGeoJsonCircuit(Circuit circuit, List<Map<String, Object>> locations) {
        Set<String> ours = tokens(circuit.getName() + " " + nullSafe(circuit.getCity()));

        Optional<Map<String, Object>> best = locations.stream()
                .max(Comparator.comparingInt(l -> overlap(ours,
                        tokens(l.getOrDefault("name", "") + " " + l.getOrDefault("location", "")))));

        if (best.isPresent()) {
            Set<String> theirs = tokens(best.get().getOrDefault("name", "")
                    + " " + best.get().getOrDefault("location", ""));
            if (overlap(ours, theirs) > 0) return best;
        }

        // Fall back to proximity when the names share nothing — circuits get renamed, coordinates do not.
        if (circuit.getLatitude() != null && circuit.getLongitude() != null) {
            return locations.stream()
                    .filter(l -> haversineKm(circuit.getLatitude(), circuit.getLongitude(),
                            doubleOf(l.get("lat")), doubleOf(l.get("lon"))) < 30)
                    .findFirst();
        }
        return Optional.empty();
    }

    static String normaliseCountry(String country) {
        if (country == null) return "";
        return COUNTRY_ALIASES.getOrDefault(country, country);
    }

    /** Significant words of a circuit name, used to match our records against an external feed. */
    static Set<String> tokens(Object text) {
        String cleaned = OpenF1SyncService.stripAccents(String.valueOf(text))
                .toLowerCase()
                .replaceAll("[^a-z0-9 ]", " ");
        Set<String> out = new HashSet<>();
        for (String token : cleaned.split("\\s+")) {
            if (token.length() > 2 && !STOPWORDS.contains(token)) out.add(token);
        }
        return out;
    }

    /** Number of significant words two circuit names share. */
    static int overlap(Set<String> a, Set<String> b) {
        int count = 0;
        for (String token : a) if (b.contains(token)) count++;
        return count;
    }

    private static double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
