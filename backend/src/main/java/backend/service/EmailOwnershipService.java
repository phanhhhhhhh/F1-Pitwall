package backend.service;

import backend.model.User;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Registration and email edits don't verify the mailbox, so an attacker can register an account
 * under an address they don't own and wait for the real owner to sign in with Google or an
 * emailed OTP — which would land the owner in an account whose password the attacker knows.
 *
 * Whenever someone proves control of the mailbox (Google's verified email, an OTP, a password
 * reset) the account is marked verified, and if it still carried a password chosen before that
 * proof, the password is dropped and every earlier session revoked: from then on only the
 * mailbox owner can get in (via Google, OTP, or forgot-password).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailOwnershipService {

    private final UserRepository userRepository;

    @Transactional
    public User claim(User user) {
        if (user.isEmailVerified()) return user;
        user.setEmailVerified(true);
        if (user.getPassword() != null && !user.getPassword().isEmpty()) {
            user.setPassword("");
            user.setPasswordChangedAt(Instant.now());
            log.warn("[Auth] Mailbox owner claimed unverified account '{}': pre-verification password removed",
                    user.getUsername());
        }
        return userRepository.save(user);
    }
}
