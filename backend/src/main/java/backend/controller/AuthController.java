package backend.controller;

import backend.dto.*;
import backend.model.User;
import backend.repository.UserRepository;
import backend.security.JwtService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final AuthenticationManager authManager;
    private final UserDetailsService userDetailsService;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.jwt.access-token-expiration}")
    private long accessTokenExpiration;

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        try {
            authManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
            );
            UserDetails userDetails = userDetailsService.loadUserByUsername(request.getUsername());
            User user = userRepository.findByUsername(request.getUsername()).orElseThrow();
            String accessToken = jwtService.generateAccessToken(userDetails, user.getRole().name());
            String refreshToken = jwtService.generateRefreshToken(userDetails);
            return ResponseEntity.ok(AuthResponse.builder()
                    .accessToken(accessToken).refreshToken(refreshToken)
                    .username(user.getUsername()).role(user.getRole().name())
                    .expiresIn(accessTokenExpiration / 1000).build());
        } catch (BadCredentialsException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid username or password"));
        }
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername()))
            return ResponseEntity.badRequest().body(Map.of("error", "Username '" + request.getUsername() + "' already exists"));
        if (userRepository.existsByEmail(request.getEmail()))
            return ResponseEntity.badRequest().body(Map.of("error", "Email is already in use"));

        User newUser = User.builder()
                .username(request.getUsername())
                .password(passwordEncoder.encode(request.getPassword()))
                .email(request.getEmail())
                .role(User.Role.VIEWER)
                .build();
        userRepository.save(newUser);

        UserDetails userDetails = userDetailsService.loadUserByUsername(newUser.getUsername());
        String accessToken = jwtService.generateAccessToken(userDetails, newUser.getRole().name());
        String refreshToken = jwtService.generateRefreshToken(userDetails);
        return ResponseEntity.status(HttpStatus.CREATED).body(AuthResponse.builder()
                .accessToken(accessToken).refreshToken(refreshToken)
                .username(newUser.getUsername()).role(newUser.getRole().name())
                .expiresIn(accessTokenExpiration / 1000).build());
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(@RequestBody Map<String, String> body) {
        String refreshToken = body.get("refreshToken");
        if (refreshToken == null || refreshToken.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "refreshToken is required"));
        try {
            String username = jwtService.extractUsername(refreshToken);
            UserDetails userDetails = userDetailsService.loadUserByUsername(username);
            if (jwtService.isRefreshTokenValid(refreshToken, userDetails)) {
                User user = userRepository.findByUsername(username).orElseThrow();
                String newAccessToken = jwtService.generateAccessToken(userDetails, user.getRole().name());
                return ResponseEntity.ok(Map.of("accessToken", newAccessToken, "expiresIn", accessTokenExpiration / 1000));
            }
        } catch (Exception e) {
            log.warn("Refresh token validation failed: {}", e.getMessage());
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid or expired refresh token"));
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser() {
        String username = Objects.requireNonNull(SecurityContextHolder.getContext().getAuthentication()).getName();
        User user = userRepository.findByUsername(username).orElseThrow();
        return ResponseEntity.ok(Map.of(
                "id",          user.getId(),
                "username",    user.getUsername(),
                "email",       user.getEmail() != null ? user.getEmail() : "",
                "displayName", user.getDisplayName() != null ? user.getDisplayName() : "",
                "avatarUrl",   user.getAvatarUrl() != null ? user.getAvatarUrl() : "",
                "role",        user.getRole().name(),
                "createdAt",   user.getCreatedAt().toString()
        ));
    }

    @PatchMapping("/profile")
    public ResponseEntity<?> updateProfile(@RequestBody Map<String, String> body) {
        String username = Objects.requireNonNull(SecurityContextHolder.getContext().getAuthentication()).getName();
        User user = userRepository.findByUsername(username).orElseThrow();

        if (body.containsKey("displayName")) {
            String dn = body.get("displayName").trim();
            user.setDisplayName(dn.isEmpty() ? null : dn);
        }

        if (body.containsKey("email")) {
            String newEmail = body.get("email").trim();
            if (!newEmail.equals(user.getEmail())) {
                if (userRepository.existsByEmail(newEmail))
                    return ResponseEntity.badRequest().body(Map.of("error", "Email is already in use"));
                user.setEmail(newEmail);
            }
        }

        if (body.containsKey("avatarUrl")) {
            String url = body.get("avatarUrl").trim();
            user.setAvatarUrl(url.isEmpty() ? null : url);
        }

        userRepository.save(user);
        log.info("[Auth] Profile updated for user: {}", username);

        return ResponseEntity.ok(Map.of(
                "id",          user.getId(),
                "username",    user.getUsername(),
                "email",       user.getEmail() != null ? user.getEmail() : "",
                "displayName", user.getDisplayName() != null ? user.getDisplayName() : "",
                "avatarUrl",   user.getAvatarUrl() != null ? user.getAvatarUrl() : "",
                "role",        user.getRole().name(),
                "createdAt",   user.getCreatedAt().toString()
        ));
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(@RequestBody Map<String, String> body) {
        String username = Objects.requireNonNull(SecurityContextHolder.getContext().getAuthentication()).getName();
        String currentPassword = body.get("currentPassword");
        String newPassword     = body.get("newPassword");

        if (currentPassword == null || newPassword == null)
            return ResponseEntity.badRequest().body(Map.of("error", "currentPassword and newPassword are required"));
        if (newPassword.length() < 6)
            return ResponseEntity.badRequest().body(Map.of("error", "New password must be at least 6 characters"));

        User user = userRepository.findByUsername(username).orElseThrow();
        boolean isOAuthUser = user.getPassword() == null || user.getPassword().isEmpty();
        if (!isOAuthUser && !passwordEncoder.matches(currentPassword, user.getPassword()))
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Current password is incorrect"));

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        log.info("[Auth] Password changed for user: {}", username);
        return ResponseEntity.ok(Map.of("message", "Password changed successfully"));
    }
}