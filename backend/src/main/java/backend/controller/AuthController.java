package backend.controller;

import backend.dto.*;
import backend.model.OtpToken;
import backend.model.User;
import backend.repository.UserRepository;
import backend.security.AccountLockoutService;
import backend.security.JwtService;
import backend.security.OAuthLoginCodeStore;
import backend.security.PasswordPolicy;
import backend.security.TokenBlacklistService;
import backend.service.EmailOwnershipService;
import backend.service.OtpService;
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

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final java.util.regex.Pattern EMAIL_PATTERN =
            java.util.regex.Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final AuthenticationManager authManager;
    private final UserDetailsService userDetailsService;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final OtpService otpService;
    private final AccountLockoutService accountLockoutService;
    private final TokenBlacklistService tokenBlacklistService;
    private final EmailOwnershipService emailOwnershipService;
    private final OAuthLoginCodeStore oAuthLoginCodeStore;

    @Value("${app.jwt.access-token-expiration}")
    private long accessTokenExpiration;

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        String username = request.getUsername();

        if (accountLockoutService.isLocked(username)) {
            long unlockSeconds = accountLockoutService.getUnlockSeconds(username);
            // Return the SAME 401 shape as BadCredentialsException to prevent
            // username enumeration through lockout-vs-invalid response difference.
            // Legitimate locked-out users will see a generic message; the only
            // distinguishing information is logged server-side (see log line below).
            log.warn("[Auth] Account locked for user: {}", username);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "error", "Invalid username or password",
                    "message", "Too many attempts. Please try again.",
                    "retryAfterSeconds", unlockSeconds
            ));
        }

        try {
            authManager.authenticate(new UsernamePasswordAuthenticationToken(username, request.getPassword()));
            accountLockoutService.loginSucceeded(username);
            UserDetails userDetails = userDetailsService.loadUserByUsername(username);
            User user = userRepository.findByUsername(username).orElseThrow();
            String accessToken = jwtService.generateAccessToken(userDetails, user.getRole().name());
            String refreshToken = jwtService.generateRefreshToken(userDetails);
            return ResponseEntity.ok(AuthResponse.builder()
                    .accessToken(accessToken).refreshToken(refreshToken)
                    .username(user.getUsername()).role(user.getRole().name())
                    .expiresIn(accessTokenExpiration / 1000).build());
        } catch (BadCredentialsException e) {
            accountLockoutService.loginFailed(username);
            int remaining = accountLockoutService.getRemainingAttempts(username);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "error", "Invalid username or password",
                    "message", "Invalid credentials. " + remaining + " attempt(s) remaining before account lockout.",
                    "remainingAttempts", remaining
            ));
        }
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
        String passwordProblem = PasswordPolicy.violation(request.getPassword());
        if (passwordProblem != null)
            return ResponseEntity.badRequest().body(Map.of("error", passwordProblem));
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
        // Reject refresh tokens that have been revoked (logout)
        if (tokenBlacklistService.isBlacklisted(refreshToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Refresh token has been revoked. Please login again."));
        }

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
        return ResponseEntity.ok(buildUserResponse(user));
    }

    @PatchMapping("/profile")
    public ResponseEntity<?> updateProfile(@Valid @RequestBody UpdateProfileRequest body) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByUsername(username).orElseThrow();

        if (body.getDisplayName() != null) user.setDisplayName(blankToNull(body.getDisplayName()));
        if (body.getEmail() != null) {
            String email = body.getEmail().trim();
            if (email.isEmpty() || !EMAIL_PATTERN.matcher(email).matches())
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid email format"));
            if (!email.equalsIgnoreCase(user.getEmail())) {
                if (userRepository.existsByEmail(email))
                    return ResponseEntity.badRequest().body(Map.of("error", "Email is already in use"));
                user.setEmail(email);
                // A new address is unproven until its owner completes an OTP/Google login.
                user.setEmailVerified(false);
            }
        }
        if (body.getAvatarUrl() != null) user.setAvatarUrl(blankToNull(body.getAvatarUrl()));
        if (body.getPhone() != null) user.setPhone(blankToNull(body.getPhone()));
        if (body.getBio() != null) user.setBio(blankToNull(body.getBio()));
        if (body.getLocation() != null) user.setLocation(blankToNull(body.getLocation()));
        if (body.getDateOfBirth() != null) {
            String v = body.getDateOfBirth().trim();
            try {
                user.setDateOfBirth(v.isEmpty() ? null : LocalDate.parse(v));
            } catch (Exception e) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid date format. Use YYYY-MM-DD"));
            }
        }

        userRepository.save(user);
        log.info("[Auth] Profile updated for user: {}", username);
        return ResponseEntity.ok(buildUserResponse(user));
    }

    private static String blankToNull(String value) {
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(@RequestBody Map<String, String> body) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        String currentPassword = body.get("currentPassword");
        String newPassword     = body.get("newPassword");
        if (currentPassword == null || newPassword == null)
            return ResponseEntity.badRequest().body(Map.of("error", "currentPassword and newPassword are required"));
        String problem = PasswordPolicy.violation(newPassword);
        if (problem != null)
            return ResponseEntity.badRequest().body(Map.of("error", problem));
        User user = userRepository.findByUsername(username).orElseThrow();
        boolean isOAuthUser = user.getPassword() == null || user.getPassword().isEmpty();
        if (!isOAuthUser && !passwordEncoder.matches(currentPassword, user.getPassword()))
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Current password is incorrect"));
        user.setPassword(passwordEncoder.encode(newPassword));
        user.setPasswordChangedAt(Instant.now());
        userRepository.save(user);
        log.info("[Auth] Password changed for user: {}", username);
        // Every earlier token is now revoked (including the caller's), so hand back a fresh pair.
        AuthResponse fresh = buildAuthResponse(user);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Password changed successfully");
        response.put("accessToken", fresh.getAccessToken());
        response.put("refreshToken", fresh.getRefreshToken());
        return ResponseEntity.ok(response);
    }

    // ── Logout ─────────────────────────────────────────────────────────────────

    @PostMapping("/logout")
    public ResponseEntity<?> logout(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody(required = false) Map<String, String> body
    ) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing or invalid Authorization header"));
        }
        String accessToken = authHeader.substring(7);
        try {
            long remainingMs = jwtService.extractExpiration(accessToken).getTime() - System.currentTimeMillis();
            if (remainingMs > 0) {
                tokenBlacklistService.blacklist(accessToken, remainingMs);
            }
        } catch (Exception e) {
            log.warn("[Auth] Logout: could not extract expiration for access token: {}", e.getMessage());
        }

        // Also blacklist the refresh token if provided, so it cannot be used to mint new access tokens
        if (body != null && body.containsKey("refreshToken")) {
            String refreshToken = body.get("refreshToken");
            if (refreshToken != null && !refreshToken.isBlank()) {
                try {
                    long remainingMs = jwtService.extractExpiration(refreshToken).getTime() - System.currentTimeMillis();
                    if (remainingMs > 0) {
                        tokenBlacklistService.blacklist(refreshToken, remainingMs);
                        log.info("[Auth] Refresh token blacklisted on logout");
                    }
                } catch (Exception e) {
                    log.warn("[Auth] Logout: could not blacklist refresh token: {}", e.getMessage());
                }
            }
        }

        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    // ── Forgot password ──────────────────────────────────────────────────────

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null || email.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "Email is required"));
        // Only send if email exists — do NOT reveal whether it exists to the caller
        userRepository.findByEmail(email.trim()).ifPresent(user -> {
            try {
                otpService.sendOtp(email.trim(), OtpToken.OtpType.FORGOT_PASSWORD);
            } catch (Exception e) {
                log.warn("[Auth] Forgot-password OTP send failed for {}: {}", email, e.getMessage());
            }
        });
        return ResponseEntity.ok(Map.of("message", "If this email is registered, an OTP has been sent"));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> body) {
        String email       = body.get("email");
        String code        = body.get("otp");
        String newPassword = body.get("newPassword");
        if (email == null || code == null || newPassword == null)
            return ResponseEntity.badRequest().body(Map.of("error", "email, otp, and newPassword are required"));
        String problem = PasswordPolicy.violation(newPassword);
        if (problem != null)
            return ResponseEntity.badRequest().body(Map.of("error", problem));
        if (!otpService.verifyOtp(email.trim(), code.trim(), OtpToken.OtpType.FORGOT_PASSWORD))
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid or expired OTP"));
        User user = userRepository.findByEmail(email.trim()).orElse(null);
        if (user == null)
            return ResponseEntity.badRequest().body(Map.of("error", "User not found"));
        user.setPassword(passwordEncoder.encode(newPassword));
        user.setPasswordChangedAt(Instant.now());
        user.setEmailVerified(true); // the OTP proved control of the mailbox
        userRepository.save(user);
        log.info("[Auth] Password reset via OTP for email: {}", email);
        return ResponseEntity.ok(Map.of("message", "Password reset successfully"));
    }

    // ── OTP login (passwordless) ─────────────────────────────────────────────

    @PostMapping("/otp/send")
    public ResponseEntity<?> sendLoginOtp(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null || email.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "Email is required"));
        sendOtpQuietly(email.trim(), OtpToken.OtpType.LOGIN_OTP);
        return ResponseEntity.ok(Map.of("message", "If this email is registered, a code has been sent"));
    }

    /** Sends only to known addresses and never reports the outcome, so the response can't be used to probe for accounts. */
    private void sendOtpQuietly(String email, OtpToken.OtpType type) {
        if (!userRepository.existsByEmail(email)) return;
        try {
            otpService.sendOtp(email, type);
        } catch (Exception e) {
            log.warn("[Auth] {} OTP send failed for {}: {}", type, email, e.getMessage());
        }
    }

    @PostMapping("/otp/verify")
    public ResponseEntity<?> verifyLoginOtp(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String code  = body.get("otp");
        if (email == null || code == null)
            return ResponseEntity.badRequest().body(Map.of("error", "email and otp are required"));
        if (!otpService.verifyOtp(email.trim(), code.trim(), OtpToken.OtpType.LOGIN_OTP))
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid or expired OTP"));
        User user = userRepository.findByEmail(email.trim()).orElse(null);
        if (user == null)
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "User not found"));
        return ResponseEntity.ok(buildAuthResponse(emailOwnershipService.claim(user)));
    }

    // ── OAuth2 2FA ───────────────────────────────────────────────────────────

    @PostMapping("/oauth2/resend-otp")
    public ResponseEntity<?> resendOauth2Otp(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null || email.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "Email is required"));
        sendOtpQuietly(email.trim(), OtpToken.OtpType.OAUTH_2FA);
        return ResponseEntity.ok(Map.of("message", "OTP sent"));
    }

    @PostMapping("/oauth2/verify-otp")
    public ResponseEntity<?> verifyOauth2Otp(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String code  = body.get("otp");
        if (email == null || code == null)
            return ResponseEntity.badRequest().body(Map.of("error", "email and otp are required"));
        if (!otpService.verifyOtp(email.trim(), code.trim(), OtpToken.OtpType.OAUTH_2FA))
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid or expired OTP"));
        User user = userRepository.findByEmail(email.trim()).orElse(null);
        if (user == null)
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "User not found"));
        return ResponseEntity.ok(buildAuthResponse(emailOwnershipService.claim(user)));
    }

    /** Swaps the one-time code from the Google redirect for the real tokens. */
    @PostMapping("/oauth2/exchange")
    public ResponseEntity<?> exchangeOauth2Code(@RequestBody Map<String, String> body) {
        return oAuthLoginCodeStore.consume(body.get("code"))
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Invalid or expired login code")));
    }

    private AuthResponse buildAuthResponse(User user) {
        UserDetails userDetails = userDetailsService.loadUserByUsername(user.getUsername());
        String accessToken  = jwtService.generateAccessToken(userDetails, user.getRole().name());
        String refreshToken = jwtService.generateRefreshToken(userDetails);
        return AuthResponse.builder()
                .accessToken(accessToken).refreshToken(refreshToken)
                .username(user.getUsername()).role(user.getRole().name())
                .expiresIn(accessTokenExpiration / 1000).build();
    }

    private Map<String, Object> buildUserResponse(User user) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id",          user.getId());
        map.put("username",    user.getUsername());
        map.put("email",       user.getEmail() != null ? user.getEmail() : "");
        map.put("displayName", user.getDisplayName() != null ? user.getDisplayName() : "");
        map.put("avatarUrl",   user.getAvatarUrl() != null ? user.getAvatarUrl() : "");
        map.put("phone",       user.getPhone() != null ? user.getPhone() : "");
        map.put("bio",         user.getBio() != null ? user.getBio() : "");
        map.put("location",    user.getLocation() != null ? user.getLocation() : "");
        map.put("dateOfBirth", user.getDateOfBirth() != null ? user.getDateOfBirth().toString() : "");
        map.put("role",        user.getRole().name());
        map.put("createdAt",   user.getCreatedAt().toString());
        return map;
    }
}