package backend;

import backend.security.RateLimitFilter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;

@DisplayName("RateLimitFilter")
class RateLimitFilterTest {

    private final RateLimitFilter filter = new RateLimitFilter();

    private int post(String path, String remoteAddr, String forwardedFor) throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", path);
        req.setRemoteAddr(remoteAddr);
        if (forwardedFor != null) req.addHeader("X-Forwarded-For", forwardedFor);
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(req, res, new MockFilterChain());
        return res.getStatus();
    }

    @Test
    @DisplayName("blocks the 6th login attempt from one address within a minute")
    void blocksAfterFive() throws Exception {
        for (int i = 0; i < 5; i++) assertEquals(200, post("/api/auth/login", "10.0.0.1", null));
        assertEquals(429, post("/api/auth/login", "10.0.0.1", null));
    }

    @Test
    @DisplayName("different client addresses get independent buckets")
    void separateBucketsPerAddress() throws Exception {
        for (int i = 0; i < 5; i++) post("/api/auth/login", "10.0.0.2", null);
        assertEquals(429, post("/api/auth/login", "10.0.0.2", null));
        assertEquals(200, post("/api/auth/login", "10.0.0.3", null));
    }

    @Test
    @DisplayName("a raw X-Forwarded-For header cannot mint a fresh bucket")
    void forwardedHeaderIsIgnoredByFilter() throws Exception {
        for (int i = 0; i < 5; i++) post("/api/auth/login", "10.0.0.4", "1.1.1." + i);
        assertEquals(429, post("/api/auth/login", "10.0.0.4", "9.9.9.9"));
    }

    @Test
    @DisplayName("non-auth paths are not rate limited")
    void otherPathsUnlimited() throws Exception {
        for (int i = 0; i < 20; i++) assertEquals(200, post("/api/drivers", "10.0.0.5", null));
    }
}
