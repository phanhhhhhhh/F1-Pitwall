package backend.config.seeder;

import backend.model.User;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class UserSeeder {

    private final UserRepository userRepo;
    private final PasswordEncoder passwordEncoder;

    public void seed() {
        if (!userRepo.existsByUsername("admin")) {
            String adminPassword = System.getenv("ADMIN_PASSWORD") != null
                    ? System.getenv("ADMIN_PASSWORD") : "pitwall2024";
            userRepo.save(User.builder()
                    .username("admin")
                    .password(passwordEncoder.encode(adminPassword))
                    .email("admin@pitwall.f1")
                    .role(User.Role.ADMIN)
                    .build());
            System.out.println("[Pitwall] Admin seeded");
        }
        if (!userRepo.existsByUsername("engineer")) {
            String engineerPassword = System.getenv("ENGINEER_PASSWORD") != null
                    ? System.getenv("ENGINEER_PASSWORD") : "telemetry2024";
            userRepo.save(User.builder()
                    .username("engineer")
                    .password(passwordEncoder.encode(engineerPassword))
                    .email("engineer@pitwall.f1")
                    .role(User.Role.ENGINEER)
                    .build());
        }
    }
}
