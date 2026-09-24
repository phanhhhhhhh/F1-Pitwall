package backend;

import backend.security.PasswordPolicy;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("PasswordPolicy")
class PasswordPolicyTest {

    @Test
    @DisplayName("accepts 8 to 72 bytes")
    void acceptsValid() {
        assertThat(PasswordPolicy.violation("12345678")).isNull();
        assertThat(PasswordPolicy.violation("a".repeat(72))).isNull();
    }

    @Test
    @DisplayName("rejects missing, empty and short passwords")
    void rejectsShort() {
        assertThat(PasswordPolicy.violation(null)).isNotNull();
        assertThat(PasswordPolicy.violation("")).isNotNull();
        assertThat(PasswordPolicy.violation("1234567")).contains("at least 8");
    }

    @Test
    @DisplayName("rejects anything BCrypt would refuse (over 72 bytes), counting bytes not characters")
    void rejectsTooLong() {
        assertThat(PasswordPolicy.violation("a".repeat(73))).contains("72");
        // 37 two-byte characters = 74 bytes but only 37 chars.
        assertThat(PasswordPolicy.violation("é".repeat(37))).contains("72");
    }
}
