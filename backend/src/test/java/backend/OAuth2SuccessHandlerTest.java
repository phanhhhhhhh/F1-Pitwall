package backend;

import backend.dto.AuthResponse;
import backend.model.User;
import backend.repository.UserRepository;
import backend.security.JwtService;
import backend.security.OAuth2SuccessHandler;
import backend.security.OAuthLoginCodeStore;
import backend.service.EmailOwnershipService;
import backend.service.OtpService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.test.util.ReflectionTestUtils;

import java.net.URI;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@DisplayName("OAuth2SuccessHandler")
class OAuth2SuccessHandlerTest {

    private UserRepository users;
    private JwtService jwt;
    private UserDetailsService details;
    private OAuthLoginCodeStore codes;
    private OAuth2SuccessHandler handler;

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        jwt = mock(JwtService.class);
        details = mock(UserDetailsService.class);
        codes = new OAuthLoginCodeStore();
        when(users.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(jwt.generateAccessToken(any(), anyString())).thenReturn("SECRET.ACCESS.TOKEN");
        when(jwt.generateRefreshToken(any())).thenReturn("SECRET.REFRESH.TOKEN");
        when(details.loadUserByUsername(anyString())).thenReturn(mock(UserDetails.class));

        handler = new OAuth2SuccessHandler(users, mock(OtpService.class), jwt, details,
                new EmailOwnershipService(users), codes);
        ReflectionTestUtils.setField(handler, "allowedOrigins", "https://app.example.com");
        ReflectionTestUtils.setField(handler, "resendApiKey", ""); // no email service => direct login path
        ReflectionTestUtils.setField(handler, "accessTokenExpiration", 900_000L);
    }

    private Authentication google(String email, Object emailVerified) {
        Map<String, Object> attrs = new java.util.HashMap<>();
        attrs.put("sub", "123");
        attrs.put("email", email);
        if (emailVerified != null) attrs.put("email_verified", emailVerified);
        return new org.springframework.security.authentication.TestingAuthenticationToken(
                new DefaultOAuth2User(AuthorityUtils.createAuthorityList("ROLE_USER"), attrs, "sub"), null);
    }

    private String redirectOf(MockHttpServletResponse response) {
        return response.getRedirectedUrl();
    }

    @Test
    @DisplayName("redirects with a one-time code and never puts a token in the URL")
    void codeNotTokens() throws Exception {
        when(users.findByEmail("new@gmail.com")).thenReturn(Optional.empty());
        MockHttpServletResponse res = new MockHttpServletResponse();

        handler.onAuthenticationSuccess(new MockHttpServletRequest(), res, google("new@gmail.com", true));

        String url = redirectOf(res);
        assertThat(url).startsWith("https://app.example.com/oauth2/callback?code=");
        assertThat(url).doesNotContain("SECRET").doesNotContain("accessToken").doesNotContain("refreshToken");
        String code = URI.create(url).getQuery().replaceAll("^code=([^&]+).*", "$1");
        assertThat(codes.consume(code)).get().extracting(AuthResponse::getAccessToken).isEqualTo("SECRET.ACCESS.TOKEN");
    }

    @Test
    @DisplayName("echoes the browser nonce carried in the OAuth state back to the SPA")
    void echoesClientState() throws Exception {
        when(users.findByEmail("new@gmail.com")).thenReturn(Optional.empty());
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setParameter("state", "springRandom.0f8fad5b-d9cb-469f-a165-70867728950e");
        MockHttpServletResponse res = new MockHttpServletResponse();

        handler.onAuthenticationSuccess(req, res, google("new@gmail.com", true));

        assertThat(redirectOf(res)).endsWith("&state=0f8fad5b-d9cb-469f-a165-70867728950e");
    }

    @Test
    @DisplayName("sends no state when the flow did not start from the SPA")
    void noStateWithoutNonce() throws Exception {
        when(users.findByEmail("new@gmail.com")).thenReturn(Optional.empty());
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setParameter("state", "springRandomOnly");
        MockHttpServletResponse res = new MockHttpServletResponse();

        handler.onAuthenticationSuccess(req, res, google("new@gmail.com", true));

        assertThat(redirectOf(res)).doesNotContain("state=");
    }

    @Test
    @DisplayName("refuses a Google email that Google has not verified")
    void unverifiedGoogleEmailRefused() throws Exception {
        MockHttpServletResponse res = new MockHttpServletResponse();

        handler.onAuthenticationSuccess(new MockHttpServletRequest(), res, google("x@gmail.com", false));
        assertThat(redirectOf(res)).endsWith("/login?error=email_unverified");

        MockHttpServletResponse missing = new MockHttpServletResponse();
        handler.onAuthenticationSuccess(new MockHttpServletRequest(), missing, google("x@gmail.com", null));
        assertThat(redirectOf(missing)).endsWith("/login?error=email_unverified");
        verify(users, never()).save(any());
    }

    @Test
    @DisplayName("an account pre-registered with the victim's email loses its password when the real owner signs in with Google")
    void preRegisteredAccountIsClaimed() throws Exception {
        User squatted = User.builder().username("victim").email("victim@gmail.com")
                .password("$2a$10$attackerhash").role(User.Role.VIEWER).emailVerified(false).build();
        when(users.findByEmail("victim@gmail.com")).thenReturn(Optional.of(squatted));

        handler.onAuthenticationSuccess(new MockHttpServletRequest(), new MockHttpServletResponse(),
                google("victim@gmail.com", true));

        assertThat(squatted.getPassword()).isEmpty();
        assertThat(squatted.isEmailVerified()).isTrue();
        assertThat(squatted.getPasswordChangedAt()).isNotNull();
    }

    @Test
    @DisplayName("new Google accounts are created verified")
    void newAccountsVerified() throws Exception {
        when(users.findByEmail("fresh@gmail.com")).thenReturn(Optional.empty());

        handler.onAuthenticationSuccess(new MockHttpServletRequest(), new MockHttpServletResponse(),
                google("fresh@gmail.com", true));

        verify(users).save(argThat(u -> u.isEmailVerified() && u.getPassword().isEmpty()));
    }
}
