package backend.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

import java.util.regex.Pattern;

/**
 * Carries the browser's login nonce through the Google round-trip inside OAuth's own
 * {@code state} parameter.
 *
 * The SPA and the API live on different sites (Vercel / Render), so a cookie set by the SPA is
 * never sent to the API and can't bind the callback to the browser that started the login. The
 * SPA instead passes its nonce as {@code client_state} when starting the flow; it is appended to
 * Spring's own random state ("&lt;random&gt;.&lt;nonce&gt;"), which Google returns untouched, and the
 * success handler echoes it back to the SPA. Spring still validates the whole value against the
 * stored request, so the CSRF check on the callback itself is unchanged.
 */
public class ClientStateAuthorizationRequestResolver implements OAuth2AuthorizationRequestResolver {

    static final String PARAM = "client_state";
    private static final Pattern NONCE = Pattern.compile("^[A-Za-z0-9-]{16,64}$");

    private final OAuth2AuthorizationRequestResolver delegate;

    public ClientStateAuthorizationRequestResolver(ClientRegistrationRepository registrations, String authorizationBaseUri) {
        this.delegate = new DefaultOAuth2AuthorizationRequestResolver(registrations, authorizationBaseUri);
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
        return withClientState(delegate.resolve(request), request);
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String clientRegistrationId) {
        return withClientState(delegate.resolve(request, clientRegistrationId), request);
    }

    private static OAuth2AuthorizationRequest withClientState(OAuth2AuthorizationRequest authRequest, HttpServletRequest request) {
        if (authRequest == null) return null;
        String nonce = request.getParameter(PARAM);
        if (nonce == null || !NONCE.matcher(nonce).matches()) return authRequest;
        return OAuth2AuthorizationRequest.from(authRequest).state(authRequest.getState() + "." + nonce).build();
    }

    /** The SPA's nonce from a returned {@code state} value, or null if it carries none. */
    public static String clientStateFrom(String state) {
        if (state == null) return null;
        int dot = state.lastIndexOf('.');
        if (dot < 0) return null;
        String nonce = state.substring(dot + 1);
        return NONCE.matcher(nonce).matches() ? nonce : null;
    }
}
