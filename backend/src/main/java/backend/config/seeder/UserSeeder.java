package backend.config.seeder;

import backend.model.User;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class UserSeeder {

    private final UserRepository userRepo;
    private final PasswordEncoder passwordEncoder;

    @Value("${ADMIN_PASSWORD:}")
    private String adminPassword;

    @Value("${ENGINEER_PASSWORD:}")
    private String engineerPassword;

    public void seed() {
        if (!userRepo.existsByUsername("admin")) {
            if (adminPassword == null || adminPassword.isBlank()) {
                throw new IllegalStateException(
                        "ADMIN_PASSWORD environment variable is required but not set. " +
                        "No default admin password is provided for security reasons.");
            }
            userRepo.save(User.builder()
                    .username("admin")
                    .password(passwordEncoder.encode(adminPassword))
                    .email("admin@pitwall.f1")
                    .role(User.Role.ADMIN)
                    .build());
            log.info("[Pitwall] Admin seeded");
        }
        if (!userRepo.existsByUsername("engineer")) {
            if (engineerPassword == null || engineerPassword.isBlank()) {
                throw new IllegalStateException(
                        "ENGINEER_PASSWORD environment variable is required but not set. " +
                        "No default engineer password is provided for security reasons.");
            }
            userRepo.save(User.builder()
                    .username("engineer")
                    .password(passwordEncoder.encode(engineerPassword))
                    .email("engineer@pitwall.f1")
                    .role(User.Role.ENGINEER)
                    .build());
        }
    }
}
