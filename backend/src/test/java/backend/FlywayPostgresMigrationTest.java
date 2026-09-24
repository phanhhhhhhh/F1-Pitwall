package backend;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The production path: Flyway builds the schema from V1..Vn on real PostgreSQL, then Hibernate
 * validates every entity against it (ddl-auto=validate). The other tests build their schema
 * from the entities on H2 and never exercise the migrations, so a migration/entity mismatch
 * would otherwise only surface at deploy time. Runs only when PG_TEST_URL points at an empty
 * database (CI provides one), e.g.
 *   PG_TEST_URL=jdbc:postgresql://localhost:5432/f1_pitwall_db ./mvnw test -Dtest=FlywayPostgresMigrationTest
 * Context startup is the main assertion — it fails if a migration or the schema check fails.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=${PG_TEST_URL}",
        "spring.datasource.username=${PG_TEST_USER:postgres}",
        "spring.datasource.password=${PG_TEST_PASSWORD:postgres}",
        "spring.datasource.driver-class-name=org.postgresql.Driver",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect",
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.flyway.enabled=true"
})
@ActiveProfiles("test")
@EnabledIfEnvironmentVariable(named = "PG_TEST_URL", matches = ".+")
class FlywayPostgresMigrationTest {

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    @DisplayName("every migration applies cleanly and the entities validate against the result")
    void migrationsApplyAndSchemaValidates() {
        Integer failed = jdbc.queryForObject("select count(*) from flyway_schema_history where success = false", Integer.class);
        Integer applied = jdbc.queryForObject("select count(*) from flyway_schema_history where success = true", Integer.class);
        assertThat(failed).isZero();
        assertThat(applied).isGreaterThanOrEqualTo(6);
    }

    @Test
    @DisplayName("seeders ran against the migrated schema")
    void seedersRan() {
        assertThat(jdbc.queryForObject("select count(*) from users", Integer.class)).isGreaterThanOrEqualTo(2);
        assertThat(jdbc.queryForObject("select count(*) from races", Integer.class)).isPositive();
    }
}
