package backend.controller;

import backend.model.User;
import backend.repository.UserRepository;
import backend.repository.DriverRepository;
import backend.repository.TeamRepository;
import backend.repository.RaceRepository;
import backend.repository.RaceResultRepository;
import backend.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final UserRepository userRepo;
    private final DriverRepository driverRepo;
    private final TeamRepository teamRepo;
    private final RaceRepository raceRepo;
    private final RaceResultRepository raceResultRepo;
    private final NotificationRepository notificationRepo;
    private final PasswordEncoder passwordEncoder;

    // ─── Dashboard Stats ─────────────────────────────────────────────────

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalUsers", userRepo.count());
        stats.put("totalDrivers", driverRepo.count());
        stats.put("totalTeams", teamRepo.count());
        stats.put("totalRaces", raceRepo.count());
        stats.put("totalRaceResults", raceResultRepo.count());
        stats.put("totalNotifications", notificationRepo.count());
        stats.put("unreadNotifications", notificationRepo.countByReadFalse());

        // Users by role
        Map<String, Long> byRole = new LinkedHashMap<>();
        byRole.put("ADMIN", userRepo.countByRole(User.Role.ADMIN));
        byRole.put("ENGINEER", userRepo.countByRole(User.Role.ENGINEER));
        byRole.put("VIEWER", userRepo.countByRole(User.Role.VIEWER));
        stats.put("usersByRole", byRole);

        return ResponseEntity.ok(stats);
    }

    // ─── User Management ─────────────────────────────────────────────────

    @GetMapping("/users")
    public ResponseEntity<List<Map<String, Object>>> getUsers() {
        List<Map<String, Object>> users = userRepo.findAll().stream().map(u -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", u.getId());
            map.put("username", u.getUsername());
            map.put("email", u.getEmail());
            map.put("role", u.getRole().name());
            return map;
        }).toList();
        return ResponseEntity.ok(users);
    }

    @PatchMapping("/users/{id}/role")
    public ResponseEntity<Map<String, Object>> updateRole(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        User user = userRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));

        try {
            User.Role newRole = User.Role.valueOf(body.get("role").toUpperCase());
            user.setRole(newRole);
            userRepo.save(user);
            return ResponseEntity.ok(Map.of(
                "id", user.getId(),
                "username", user.getUsername(),
                "role", user.getRole().name(),
                "message", "Role updated successfully"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid role"));
        }
    }

    @PatchMapping("/users/{id}/password")
    public ResponseEntity<Map<String, Object>> resetPassword(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        User user = userRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));

        String newPassword = body.get("password");
        if (newPassword == null || newPassword.length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("error", "Password must be at least 6 characters"));
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepo.save(user);
        return ResponseEntity.ok(Map.of("message", "Password reset successfully"));
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Map<String, Object>> deleteUser(@PathVariable Long id) {
        User user = userRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Prevent deleting the only admin
        if (user.getRole() == User.Role.ADMIN && userRepo.countByRole(User.Role.ADMIN) <= 1) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot delete the only admin"));
        }

        userRepo.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "User deleted"));
    }

    @PostMapping("/users")
    public ResponseEntity<Map<String, Object>> createUser(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");
        String email = body.get("email");
        String role = body.get("role");

        if (userRepo.existsByUsername(username)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username already exists"));
        }

        User user = User.builder()
                .username(username)
                .password(passwordEncoder.encode(password))
                .email(email)
                .role(User.Role.valueOf(role != null ? role.toUpperCase() : "VIEWER"))
                .build();

        User saved = userRepo.save(user);
        return ResponseEntity.ok(Map.of(
            "id", saved.getId(),
            "username", saved.getUsername(),
            "email", saved.getEmail(),
            "role", saved.getRole().name()
        ));
    }
}
