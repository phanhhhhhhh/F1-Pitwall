package backend.service;

/** Lenient accessors for values in decoded JSON feeds, where a field may be absent or the wrong type. */
final class FeedValues {

    private FeedValues() {}

    static String nullSafe(String s) {
        return s == null ? "" : s;
    }

    static int intOf(Object o) {
        return o instanceof Number n ? n.intValue() : 0;
    }

    static double doubleOf(Object o) {
        return o instanceof Number n ? n.doubleValue() : 0d;
    }
}
