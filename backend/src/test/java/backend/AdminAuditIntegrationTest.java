package backend;

import backend.model.User;
import backend.repository.UserRepository;
import backend.security.JwtService;
import backend.service.CustomUserDetailsService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("Admin audit log")
class AdminAuditIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;
    @Autowired CustomUserDetailsService details;
    @Autowired UserRepository users;

    private String bearer(String username, String role) {
        return "Bearer " + jwt.generateAccessToken(details.loadUserByUsername(username), role);
    }

    private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder b, String auth, String body) {
        return b.header("Authorization", auth).contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private String auditLog() throws Exception {
        return mvc.perform(get("/api/admin/audit").header("Authorization", bearer("admin", "ADMIN")))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }

    @Test
    @DisplayName("user create, role change, password reset and delete are recorded with the actor — never the password")
    void recordsAdminActions() throws Exception {
        String admin = bearer("admin", "ADMIN");
        String name = "audited" + System.nanoTime() % 100000;
        String secret = "s3cret-pass-value";

        mvc.perform(json(post("/api/admin/users"), admin,
                "{\"username\":\"" + name + "\",\"password\":\"" + secret + "\",\"email\":\"" + name + "@t.test\",\"role\":\"VIEWER\"}"))
                .andExpect(status().is2xxSuccessful());
        Long id = users.findByUsername(name).orElseThrow().getId();
        mvc.perform(json(patch("/api/admin/users/" + id + "/role"), admin, "{\"role\":\"ENGINEER\"}")).andExpect(status().isOk());
        mvc.perform(json(patch("/api/admin/users/" + id + "/password"), admin, "{\"password\":\"another-secret-1\"}")).andExpect(status().isOk());
        mvc.perform(delete("/api/admin/users/" + id).header("Authorization", admin)).andExpect(status().isOk());

        String log = auditLog();
        assertThat(log).contains("USER_CREATED", "USER_ROLE_CHANGED", "VIEWER -> ENGINEER", "USER_PASSWORD_RESET", "USER_DELETED")
                .contains("\"actor\":\"admin\"").contains(name);
        assertThat(log).doesNotContain(secret).doesNotContain("another-secret-1");
    }

    @Test
    @DisplayName("only admins can read it")
    void adminOnly() throws Exception {
        mvc.perform(get("/api/admin/audit")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/audit").header("Authorization", bearer("engineer", "ENGINEER"))).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("the only admin cannot be demoted or deleted")
    void lastAdminProtected() throws Exception {
        String admin = bearer("admin", "ADMIN");
        Long adminId = users.findByUsername("admin").orElseThrow().getId();
        assertThat(users.countByRole(User.Role.ADMIN)).isEqualTo(1);
        mvc.perform(json(patch("/api/admin/users/" + adminId + "/role"), admin, "{\"role\":\"VIEWER\"}")).andExpect(status().isBadRequest());
        mvc.perform(delete("/api/admin/users/" + adminId).header("Authorization", admin)).andExpect(status().isBadRequest());
    }
}
