package backend.security;

import java.nio.charset.StandardCharsets;

/** One place for the password rules every endpoint (register, change, reset, admin) shares. */
public final class PasswordPolicy {

    public static final int MIN_LENGTH = 8;
    /** BCrypt only uses the first 72 bytes and Spring's encoder rejects anything longer. */
    public static final int MAX_BYTES = 72;

    private PasswordPolicy() {}

    /** @return a user-facing message describing the violation, or null if the password is acceptable. */
    public static String violation(String password) {
        if (password == null || password.isEmpty()) return "Password is required";
        if (password.length() < MIN_LENGTH) return "Password must be at least " + MIN_LENGTH + " characters";
        if (password.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES) {
            return "Password must be at most " + MAX_BYTES + " bytes";
        }
        return null;
    }
}
