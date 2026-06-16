---
name: springboot-patterns
description: Spring Boot patterns used in F1 Pitwall — JWT filter chain, WebSocket STOMP, JPA repositories, DTO mapping
triggers:
  - spring boot pattern
  - jwt filter
  - stomp websocket
  - jpa repository
  - dto mapping
  - add new api endpoint
  - new spring boot feature
---

# F1 Pitwall — Spring Boot Patterns Reference

Extracted from `backend/src/main/java/backend/`. Apply these patterns exactly when adding new features to the Spring Boot backend.

---

## 1. JWT Filter Chain

### Architecture
```
Request → JwtAuthenticationFilter (OncePerRequestFilter)
             ↓ extracts Bearer token
          JwtService.extractUsername()
             ↓
          CustomUserDetailsService.loadUserByUsername()
             ↓
          JwtService.isTokenValid()  ← checks username + expiry + type="access"
             ↓
          SecurityContextHolder.setAuthentication()
```

### JwtAuthenticationFilter skeleton
```java
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        final String jwt = authHeader.substring(7);
        try {
            final String username = jwtService.extractUsername(jwt);
            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                UserDetails userDetails = userDetailsService.loadUserByUsername(username);
                if (jwtService.isTokenValid(jwt, userDetails)) {
                    UsernamePasswordAuthenticationToken authToken =
                            new UsernamePasswordAuthenticationToken(
                                    userDetails, null, userDetails.getAuthorities());
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }
        } catch (Exception e) {
            logger.warn("JWT validation failed: " + e.getMessage());
        }
        filterChain.doFilter(request, response);
    }
}
```

### JwtService key patterns
```java
// Two token types — always set "type" claim to distinguish them
extraClaims.put("type", "access");   // access token
extraClaims.put("type", "refresh");  // refresh token

// Validation MUST check type — prevents using refresh token as access token
public boolean isTokenValid(String token, UserDetails userDetails) {
    final String type = extractClaim(token, claims -> claims.get("type", String.class));
    return username.equals(userDetails.getUsername())
            && !isTokenExpired(token)
            && "access".equals(type);   // ← critical check
}

// Secret key minimum 32 bytes (256-bit for HS256)
private SecretKey getSigningKey() {
    byte[] keyBytes = secretKey.getBytes();
    if (keyBytes.length < 32) throw new IllegalStateException("JWT secret too short");
    return Keys.hmacShaKeyFor(keyBytes);
}
```

### SecurityConfig — RBAC authorization pattern
```java
.authorizeHttpRequests(auth -> auth
    .requestMatchers("/api/auth/**").permitAll()
    .requestMatchers("/ws/**", "/ws/info/**").permitAll()          // WebSocket handshake
    .requestMatchers(HttpMethod.GET, "/api/drivers/**")
        .hasAnyRole("ADMIN", "ENGINEER", "VIEWER")
    .requestMatchers(HttpMethod.POST, "/api/drivers/**").hasRole("ADMIN")
    .requestMatchers(HttpMethod.PUT, "/api/drivers/**").hasRole("ADMIN")
    .requestMatchers(HttpMethod.DELETE, "/api/drivers/**").hasRole("ADMIN")
    .requestMatchers("/api/admin/**").hasRole("ADMIN")
    .anyRequest().authenticated()
)
// Filter BEFORE UsernamePasswordAuthenticationFilter
.addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
```

**Pitfalls:**
- Spring Security `hasRole("ADMIN")` automatically prepends `ROLE_` — store roles as `ROLE_ADMIN` in DB or configure `GrantedAuthority` accordingly.
- `/ws/**` and `/ws/info/**` must be `permitAll()` — SockJS probes hit `/ws/info` before the WebSocket handshake.
- CORS `setAllowedOriginPatterns()` (not `setAllowedOrigins()`) is required when `allowCredentials = true`.

---

## 2. WebSocket STOMP Config

```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Value("${allowed.origins:http://localhost:3000}")
    private String[] allowedOrigins;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");          // broadcast destinations
        registry.setApplicationDestinationPrefixes("/app"); // client→server prefix
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(allowedOrigins)
                .withSockJS();   // SockJS fallback for browsers without native WS
    }
}
```

### Broadcasting from a service (TelemetrySimulator pattern)
```java
@Scheduled(fixedRate = 1000)
public void broadcast() {
    messagingTemplate.convertAndSend("/topic/telemetry", payload);
}
// Frontend subscribes: client.subscribe("/topic/telemetry", callback)
```

**Topic naming convention:** `/topic/<resource>` — e.g. `/topic/telemetry`, `/topic/notifications`.

**Pitfalls:**
- `enableSimpleBroker` is in-memory; for multi-instance production, replace with `enableStompBrokerRelay` pointing at RabbitMQ/ActiveMQ.
- SockJS probes `/ws/info` via HTTP — keep that path in `permitAll()` in SecurityConfig.
- `allowedOriginPatterns` on STOMP endpoint must match CORS `allowedOriginPatterns`; mismatches silently reject connections.

---

## 3. JPA Repository Conventions

### Minimal repository (read-only or simple CRUD)
```java
@Repository
public interface FooRepository extends JpaRepository<Foo, Long> {}
```

### Repository with custom queries (the RaceResultRepository pattern)
```java
@Repository
public interface RaceResultRepository extends JpaRepository<RaceResult, Long> {

    // Spring Data derived finder — no @Query needed for simple cases
    List<RaceResult> findByRaceIdOrderByFinishPosition(Long raceId);
    boolean existsByRaceId(Long raceId);

    // JOIN FETCH to avoid N+1 — always eager-load associations used in the same request
    @Query("SELECT r FROM RaceResult r " +
           "JOIN FETCH r.driver d LEFT JOIN FETCH d.team t " +
           "JOIN FETCH r.race rc " +
           "WHERE rc.season = :season AND rc.status = :status")
    List<RaceResult> findByRaceSeasonAndRaceStatus(int season, RaceStatus status);

    // Bulk delete — requires @Modifying + @Transactional
    @Modifying
    @Transactional
    @Query("DELETE FROM RaceResult r WHERE r.race.id = :raceId")
    void deleteByRaceId(Long raceId);
}
```

**Query selection heuristic:**
| Case | Use |
|---|---|
| Find by one FK, simple sort | Spring Data derived method (`findByXOrderByY`) |
| Needs JOIN FETCH to avoid N+1 | `@Query` JPQL with `JOIN FETCH` |
| Bulk delete/update | `@Modifying` + `@Transactional` + `@Query` |
| Complex aggregation | `@Query` JPQL or native SQL with `nativeQuery = true` |

**Pitfalls:**
- Omitting `JOIN FETCH` on a `@ManyToOne` inside a loop = N+1 queries. Always JOIN FETCH when you know the association will be accessed.
- `@Modifying` without `@Transactional` throws `InvalidDataAccessApiUsageException`.
- `application-prod.properties` must have `spring.jpa.open-in-view=false` to prevent lazy-loading outside transaction scope.

---

## 4. DTO Pattern

### Simple response DTO (Lombok @Data + @Builder)
```java
@Data
@Builder
public class AuthResponse {
    private String accessToken;
    private String refreshToken;
    private String username;
    private String role;
    private long expiresIn;
}
```

### Entity → DTO mapping in service (the toResponse() pattern)
```java
// Private helper method — called via method reference in stream
private RaceResultResponse toResponse(RaceResult r) {
    return RaceResultResponse.builder()
            .id(r.getId())
            .driverName(r.getDriver().getName())
            .teamName(r.getDriver().getTeam() != null ? r.getDriver().getTeam().getName() : "")
            .teamColor(r.getDriver().getTeam() != null ? r.getDriver().getTeam().getColorHex() : "#666")
            .finishPosition(r.getFinishPosition())
            .points(r.getPoints())
            .hasFastestLap(r.isHasFastestLap())
            .dnfReason(r.getDnfReason())
            .build();
}

// Usage in service method:
public List<RaceResultResponse> getResults(Long raceId) {
    return repository.findByRaceIdOrderByFinishPosition(raceId)
            .stream()
            .map(this::toResponse)   // ← method reference pattern
            .collect(Collectors.toList());
}
```

**DTO naming convention:**
- Request DTOs: `CreateFooRequest`, `UpdateFooRequest`
- Response DTOs: `FooResponse`, `FooSummaryResponse`
- Auth: `AuthResponse`, `LoginRequest`, `RegisterRequest`

**Pitfalls:**
- Never expose the entity directly from a `@RestController` — Hibernate proxy serialization causes infinite recursion on bidirectional relationships.
- Null-check associated entities in `toResponse()` — lazy associations not fetched yet throw `LazyInitializationException` if `open-in-view=false`.
- Use `@Builder` on the DTO, not on the entity — entity needs a no-arg constructor for JPA.

---

## 5. CORS + Security Headers (applied globally in SecurityConfig)

```java
// CORS — allowCredentials=true requires patterns not explicit origins
configuration.setAllowedOriginPatterns(allowedOrigins);  // from ${allowed.origins}
configuration.setAllowedMethods(List.of("GET","POST","PUT","DELETE","PATCH","OPTIONS"));
configuration.setAllowedHeaders(List.of("*"));
configuration.setAllowCredentials(true);

// Security headers added in SecurityConfig
.headers(headers -> headers
    .contentTypeOptions(contentTypeOptions -> {})   // X-Content-Type-Options: nosniff
    .frameOptions(frameOptions -> frameOptions.deny())  // X-Frame-Options: DENY
    .xssProtection(xss -> {})                           // X-XSS-Protection
    .referrerPolicy(referrer ->
        referrer.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
)
```

**Environment variable:** `ALLOWED_ORIGINS=https://my-frontend.vercel.app,http://localhost:3000`

---

## 6. Applying These Patterns to a New Feature

Checklist when adding a new API endpoint (e.g. `/api/circuits`):

1. **Entity** → `backend/model/Circuit.java` with `@Entity`, `@Table`, Lombok `@Data`/`@NoArgsConstructor`/`@AllArgsConstructor`
2. **Repository** → `backend/repository/CircuitRepository.java` extending `JpaRepository<Circuit, Long>`. Add `@Query` only if JOIN FETCH is needed.
3. **DTO** → `backend/dto/CircuitResponse.java` with `@Data @Builder`. Add `toResponse()` in service.
4. **Service** → `backend/service/CircuitService.java` with `@Service @RequiredArgsConstructor`. Call repository, map to DTO.
5. **Controller** → `backend/controller/CircuitController.java` with `@RestController @RequestMapping("/api/circuits")`.
6. **Security** — add the new path to `SecurityConfig.authorizeHttpRequests()` with appropriate role.
7. **Test** — verify the endpoint returns 401 without `Authorization: Bearer <token>` and 200 with a valid token.

---

## Key Libraries / Dependencies (from pom.xml)

| Purpose | Library |
|---|---|
| JWT | `io.jsonwebtoken:jjwt-api` + `jjwt-impl` + `jjwt-jackson` |
| Boilerplate reduction | Lombok (`@Data`, `@Builder`, `@RequiredArgsConstructor`) |
| WebSocket | Spring Boot Starter WebSocket (includes STOMP) |
| ORM | Spring Boot Starter Data JPA + PostgreSQL driver |
| Security | Spring Boot Starter Security + OAuth2 Client |
