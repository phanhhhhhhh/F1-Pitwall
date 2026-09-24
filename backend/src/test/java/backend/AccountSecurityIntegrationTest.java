package backend;

import backend.dto.AuthResponse;
import backend.model.User;
import backend.repository.UserRepository;
import backend.security.JwtService;
import backend.security.OAuthLoginCodeStore;
import backend.service.CustomUserDetailsService;
import backend.service.EmailOwnershipService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Account-security behaviour: 401 for anonymous callers, session revocation on password
 * change, no account enumeration, profile validation, mailbox-ownership claiming, and the
 * one-time OAuth login code. Runs on MockMvc (its own context, so its own rate-limit
 * bucket) with users created straight in the repository.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AccountSecurityIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    @Autowired JwtService jwt;
    @Autowired CustomUserDetailsService details;
    @Autowired EmailOwnershipService ownership;
    @Autowired OAuthLoginCodeStore codeStore;

    private static int counter = 0;

    private User newUser(String password, boolean verified) {
        String name = "acct" + (++counter) + "_" + System.nanoTime() % 100000;
        return users.save(User.builder()
                .username(name).email(name + "@test.com")
                .password(password == null ? "" : encoder.encode(password))
                .role(User.Role.VIEWER).emailVerified(verified).build());
    }

    private String access(User u) {
        return jwt.generateAccessToken(details.loadUserByUsername(u.getUsername()), u.getRole().name());
    }

    private String refresh(User u) {
        return jwt.generateRefreshToken(details.loadUserByUsername(u.getUsername()));
    }

    private static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder b, String body) {
        return b.contentType(MediaType.APPLICATION_JSON).content(body).with(r -> { r.setRemoteAddr("10.2.0.1"); return r; });
    }

    /** JWT iat has 1s resolution, so revocation is only observable once the clock ticks over. */
    private static void nextSecond() throws InterruptedException {
        Thread.sleep(1100);
    }

    @Test
    @DisplayName("anonymous callers get 401, not 500, on endpoints that need an identity")
    void anonymousIs401() throws Exception {
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        mvc.perform(json(patch("/api/auth/profile"), "{\"bio\":\"x\"}")).andExpect(status().isUnauthorized());
        mvc.perform(json(post("/api/auth/change-password"), "{\"currentPassword\":\"a\",\"newPassword\":\"bbbbbbbb\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("changing the password revokes every earlier token and returns a working fresh pair")
    void changePasswordRevokesSessions() throws Exception {
        User u = newUser("oldpassword1", true);
        String oldAccess = access(u);
        String oldRefresh = refresh(u);
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + oldAccess)).andExpect(status().isOk());
        nextSecond();

        String body = mvc.perform(json(post("/api/auth/change-password")
                        .header("Authorization", "Bearer " + oldAccess),
                        "{\"currentPassword\":\"oldpassword1\",\"newPassword\":\"newpassword2\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").exists())
                .andReturn().getResponse().getContentAsString();
        String freshAccess = body.replaceAll(".*\"accessToken\":\"([^\"]+)\".*", "$1");

        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + oldAccess)).andExpect(status().isUnauthorized());
        mvc.perform(json(post("/api/auth/refresh"), "{\"refreshToken\":\"" + oldRefresh + "\"}")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + freshAccess)).andExpect(status().isOk());
    }

    @Test
    @DisplayName("weak or over-long new passwords are rejected")
    void passwordPolicyEnforced() throws Exception {
        User u = newUser("oldpassword1", true);
        String token = "Bearer " + access(u);
        mvc.perform(json(post("/api/auth/change-password").header("Authorization", token),
                "{\"currentPassword\":\"oldpassword1\",\"newPassword\":\"short\"}")).andExpect(status().isBadRequest());
        mvc.perform(json(post("/api/auth/change-password").header("Authorization", token),
                "{\"currentPassword\":\"oldpassword1\",\"newPassword\":\"" + "a".repeat(80) + "\"}")).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("otp/send answers identically for known and unknown addresses")
    void otpSendDoesNotEnumerate() throws Exception {
        User u = newUser("password123", true);
        String known = mvc.perform(json(post("/api/auth/otp/send"), "{\"email\":\"" + u.getEmail() + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String unknown = mvc.perform(json(post("/api/auth/otp/send"), "{\"email\":\"nobody-here@nowhere.test\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(unknown).isEqualTo(known);
    }

    @Test
    @DisplayName("profile updates: partial, validated, and never touch role or username")
    void profileValidation() throws Exception {
        User u = newUser("password123", true);
        String auth = "Bearer " + access(u);

        mvc.perform(json(patch("/api/auth/profile").header("Authorization", auth),
                        "{\"displayName\":null,\"bio\":\"hello\",\"role\":\"ADMIN\",\"username\":\"evil\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bio").value("hello"))
                .andExpect(jsonPath("$.role").value("VIEWER"))
                .andExpect(jsonPath("$.username").value(u.getUsername()));

        mvc.perform(json(patch("/api/auth/profile").header("Authorization", auth),
                "{\"bio\":\"" + "a".repeat(5000) + "\"}")).andExpect(status().isBadRequest());
        mvc.perform(json(patch("/api/auth/profile").header("Authorization", auth),
                "{\"avatarUrl\":\"javascript:alert(1)\"}")).andExpect(status().isBadRequest());
        mvc.perform(json(patch("/api/auth/profile").header("Authorization", auth),
                "{\"email\":\"not-an-email\"}")).andExpect(status().isBadRequest());
        mvc.perform(json(patch("/api/auth/profile").header("Authorization", auth),
                "{\"avatarUrl\":\"https://x.supabase.co/a.png\"}")).andExpect(status().isOk());
    }

    @Test
    @DisplayName("changing email marks it unverified")
    void emailChangeUnverifies() throws Exception {
        User u = newUser("password123", true);
        mvc.perform(json(patch("/api/auth/profile").header("Authorization", "Bearer " + access(u)),
                "{\"email\":\"changed-" + u.getUsername() + "@test.com\"}")).andExpect(status().isOk());
        assertThat(users.findByUsername(u.getUsername()).orElseThrow().isEmailVerified()).isFalse();
    }

    @Test
    @DisplayName("the mailbox owner claiming an unverified account drops the squatter's password and sessions")
    void claimNeutralisesPreRegistration() throws Exception {
        User squatted = newUser("attackerpass1", false);
        String attackerToken = access(squatted);
        nextSecond();

        ownership.claim(squatted);

        User after = users.findByUsername(squatted.getUsername()).orElseThrow();
        assertThat(after.isEmailVerified()).isTrue();
        assertThat(after.getPassword()).isEmpty();
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + attackerToken)).andExpect(status().isUnauthorized());
        // A password login with the attacker's password no longer works.
        mvc.perform(json(post("/api/auth/login"), "{\"username\":\"" + squatted.getUsername() + "\",\"password\":\"attackerpass1\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("claiming an already verified account changes nothing")
    void claimVerifiedIsNoop() {
        User verified = newUser("keepthispass1", true);
        ownership.claim(verified);
        User after = users.findByUsername(verified.getUsername()).orElseThrow();
        assertThat(encoder.matches("keepthispass1", after.getPassword())).isTrue();
        assertThat(after.getPasswordChangedAt()).isNull();
    }

    @Test
    @DisplayName("the OAuth login code exchanges once for tokens and never again")
    void oauthCodeExchange() throws Exception {
        String code = codeStore.issue(AuthResponse.builder().accessToken("acc").refreshToken("ref")
                .username("someone").role("VIEWER").expiresIn(900).build());

        mvc.perform(json(post("/api/auth/oauth2/exchange"), "{\"code\":\"" + code + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("acc"))
                .andExpect(jsonPath("$.username").value("someone"));
        mvc.perform(json(post("/api/auth/oauth2/exchange"), "{\"code\":\"" + code + "\"}")).andExpect(status().isUnauthorized());
        mvc.perform(json(post("/api/auth/oauth2/exchange"), "{\"code\":\"bogus\"}")).andExpect(status().isUnauthorized());
        mvc.perform(json(post("/api/auth/oauth2/exchange"), "{}")).andExpect(status().isUnauthorized());
    }
}
