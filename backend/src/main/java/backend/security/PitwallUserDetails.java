package backend.security;

import org.springframework.security.core.GrantedAuthority;

import java.time.Instant;
import java.util.Collection;

/** Spring's User plus the one extra fact JwtService needs to reject pre-password-change tokens. */
public class PitwallUserDetails extends org.springframework.security.core.userdetails.User {

    private final Instant passwordChangedAt;

    public PitwallUserDetails(String username, String password, boolean enabled,
                              Collection<? extends GrantedAuthority> authorities,
                              Instant passwordChangedAt) {
        super(username, password, enabled, true, true, true, authorities);
        this.passwordChangedAt = passwordChangedAt;
    }

    public Instant getPasswordChangedAt() {
        return passwordChangedAt;
    }
}
