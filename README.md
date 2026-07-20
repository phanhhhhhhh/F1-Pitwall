# F1 Pitwall

A full-stack Formula 1 race engineering SaaS platform for the 2026 season — live WebSocket telemetry, driver/constructor standings, race weekend hub, race management, and a broadcast-grade "Pit Wall OS" design system.

**Live Demo:** [f1-pitwall-tau.vercel.app](https://f1-pitwall-tau.vercel.app) &nbsp;|&nbsp; **API:** [f1-pitwall-backend.onrender.com](https://f1-pitwall-backend.onrender.com)

---

## Features

- **Pit Wall OS Design System** — broadcast-inspired UI with F1 red, Saira Condensed typography, chamfered cards, timing-tower rows, animated count-ups, and responsive mobile layout
- **Authentication** — username/password login with JWT (access + refresh tokens), Google OAuth 2.0 with 2FA, passwordless OTP login, forgot/reset password flow; BCrypt hashing; role-based access (ADMIN / ENGINEER / VIEWER)
- **Live WebSocket Telemetry** — simulated speed, RPM, gear, throttle, brake, and DRS pushed every second via STOMP/SockJS; per-driver and aggregated topics
- **Race Weekend Hub** — dynamic session tabs (FP1/FP2/FP3) with fastest-lap results per driver fetched from the OpenF1 API; weekend schedule with LIVE / UPCOMING / COMPLETED status badges; 30-minute cache with manual refresh
- **OpenF1 Live Race Integration** — auto-detects currently-live sessions and switches the Tyres tab to real compound/age/stint data polled every 30 seconds; falls back to the telemetry simulator when no race is active
- **Driver & Constructor Championship Standings** — real 2026 points system; wins, podiums, fastest laps, gap to leader/previous; top-6 surfaced on the Overview dashboard; CSV and PDF export
- **Race Management** — submit P1–P22 results with automatic F1 points (including fastest-lap bonus); 2026 sprint points; race status lifecycle (SCHEDULED → ONGOING → COMPLETED / CANCELLED / RED_FLAGGED)
- **Qualifying Results** — Q1/Q2/Q3 times and grid positions synced from the Jolpica API; per-race and bulk sync
- **Pre-seeded 2026 Season** — 22 drivers, 11 teams, 24 circuits, 24 Grands Prix + 6 Sprint races auto-loaded on first startup
- **Notifications** — RACE_RESULT, DNF, and STATUS_CHANGE notifications broadcast via STOMP WebSocket; unread count badge, mark-read, bulk dismiss
- **Profile & Account Management** — editable display name, email, phone, date of birth, location, bio; avatar upload to Supabase Storage with instant navbar preview
- **Admin Panel** — dashboard stats, user CRUD + role management, data migration tools (seed sprints, fix duplicates, clear/recalculate results)
- **Auto-Sync** — scheduled OpenF1 live-data polling (30 s), weekend cache refresh (30 min), and Jolpica race-result sync (hourly)
- **Swagger UI** — interactive API docs at `/swagger-ui/index.html`

### Coming Soon

- **Pit Strategy Simulator** — compare multi-stop strategies with tyre degradation and pit-stop loss (data model ready, API in progress)

---

## Tech Stack

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Java | 21 LTS | Core language |
| Spring Boot | 4.0.5 | Application framework (Web, Security, JPA, WebSocket, Actuator, Validation) |
| Spring Security + OAuth2 Client | (managed by Boot) | JWT filters, Google OAuth 2.0, role-based access |
| Spring WebSocket (STOMP) | (managed by Boot) | Real-time telemetry & notification messaging |
| PostgreSQL | 15 | Primary database |
| JJWT | 0.12.6 | JWT generation & validation |
| SpringDoc OpenAPI | 2.8.6 | Swagger API docs |
| Resend | HTTP API | OTP email delivery |

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.2.1 | React framework (App Router) |
| React | 19.2.4 | UI library |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 4 | Utility-first CSS |
| Framer Motion | 12 | Animations |
| Recharts | 3 | Charts (standings, gaps, lap times) |
| Supabase JS | 2 | Avatar image uploads to Supabase Storage |

### Infrastructure

Render (backend Docker + PostgreSQL) · Vercel (frontend edge) · Supabase Storage (avatars) · Google Cloud (OAuth 2.0)

---

## Prerequisites

- Java 21+
- Node.js 18+
- PostgreSQL 15 (or Docker Desktop)
- Maven 3.9+

---

## Quick Start

### 1. Start PostgreSQL

```bash
docker compose -f docker-compose.full.yml up -d postgres
```

This creates a PostgreSQL 15 container named `f1_postgres` with database `f1_pitwall_db`, user `postgres`, password `postgres` on port 5432 — matching the defaults in `application.properties`.

(Optional: `docker compose -f docker-compose.full.yml up -d` starts Redis as well, but Redis is not yet integrated by the backend.)

### 2. Backend

```bash
cd backend

# Copy and configure environment variables
cp .env.example .env          # edit if you want to override JWT secret, OAuth, etc.

# Run
mvn spring-boot:run
```

- API: `http://localhost:8080`
- Swagger UI: `http://localhost:8080/swagger-ui/index.html`

> **Note:** Local dev uses hardcoded database credentials from `application.properties` — no database env vars are needed. See `backend/.env.example` for optional overrides (JWT secret, OAuth2, Resend API key, seeded user passwords).

### 3. Frontend

```bash
cd f1-pitwall-client

# Copy and configure environment variables
cp .env.example .env.local    # set NEXT_PUBLIC_API_URL=http://localhost:8080

# Install dependencies and start
npm install && npm run dev
```

- App: `http://localhost:3000`

---

## Default Credentials (local dev)

| Role | Username | Password |
|---|---|---|
| Admin | admin | pitwall2024 |
| Engineer | engineer | telemetry2024 |

A VIEWER account can be created via `POST /api/auth/register`.

Google OAuth requires real credentials — set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `backend/.env`.

---

## Environment Variables

### Backend (`backend/.env.example`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | Yes (prod) | `f1-pitwall-super-secret-key-...` | HS256 signing key — min 32 characters |
| `ADMIN_PASSWORD` | No | `pitwall2024` | Password seeded for the `admin` user on first startup |
| `ENGINEER_PASSWORD` | No | `telemetry2024` | Password seeded for the `engineer` user on first startup |
| `ALLOWED_ORIGINS` | No | `http://localhost:3000` | Comma-separated CORS origins |
| `GOOGLE_CLIENT_ID` | No (dev) | `dummy-local` | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | No (dev) | `dummy-local` | Google OAuth 2.0 client secret |
| `RESEND_API_KEY` | No (dev) | (empty — OTP disabled) | Resend API key for OTP email delivery |
| `RESEND_FROM` | No | `onboarding@resend.dev` | Sender address for OTP emails |
| `BACKEND_URL` | Yes (prod) | — | Full backend URL for OAuth2 redirect URI |
| `SPRING_PROFILES_ACTIVE` | No | (defaults) | Set to `prod` in production |

**Production-only database env vars** (read by `application-prod.properties`):

| Variable | Description |
|---|---|
| `PGHOST` | PostgreSQL host |
| `PGPORT` | PostgreSQL port |
| `PGDATABASE` | Database name (default: `f1_pitwall_db`) |
| `PGUSER` | Database user |
| `PGPASSWORD` | Database password |

### Frontend (`f1-pitwall-client/.env.example`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend base URL (e.g. `http://localhost:8080`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (for avatar uploads) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |

---

## Project Structure

```
├── backend/                        # Spring Boot API
│   ├── src/main/java/backend/
│   │   ├── config/                 # SecurityConfig, GlobalExceptionHandler, DataSeeder
│   │   ├── controller/             # 18 REST controllers
│   │   ├── dto/                    # Request/response DTOs
│   │   ├── model/                  # 21 JPA entities + enums
│   │   ├── repository/             # 21 Spring Data repositories
│   │   ├── scheduler/              # TelemetrySimulator (1 s tick)
│   │   ├── security/               # JwtService, JwtAuthenticationFilter, OAuth2SuccessHandler
│   │   ├── service/                # 18 service classes (business logic + external APIs)
│   │   └── websocket/              # WebSocketConfig, TelemetryPayload
│   ├── src/main/resources/
│   │   ├── application.properties       # Default (dev) config
│   │   └── application-prod.properties  # Production overrides
│   ├── Dockerfile
│   └── pom.xml
├── f1-pitwall-client/              # Next.js frontend
│   ├── src/
│   ├── next.config.ts              # output: "standalone"
│   ├── vercel.json
│   └── package.json
├── docker-compose.full.yml         # Full-stack local dev (PostgreSQL + Redis + backend + frontend)
├── render.yaml                     # Render IAC (backend + DB)
└── README.md
```

---

## Deployment

**Backend — Render:** Multi-stage Docker build via `backend/Dockerfile`. `render.yaml` is pre-configured. Set `SPRING_PROFILES_ACTIVE=prod` and provide all production env vars (`PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`) in the Render dashboard.

**Frontend — Vercel:** `vercel.json` configured with `output: standalone`. Connect the GitHub repo, set `NEXT_PUBLIC_API_URL` to your Render backend URL, and deploy.

---

## Known Limitations

### In-Memory State (lost on restart)

All of the following are stored in `ConcurrentHashMap` and are **lost on application restart** (Render free tier restarts frequently due to inactivity):

| Component | What's stored | Impact on restart |
|---|---|---|
| `TokenBlacklistService` | SHA-256 hashes of revoked JWT access + refresh tokens | Previously logged-out users can use their old tokens again until natural expiration |
| `AccountLockoutService` | Failed login attempts per username | Lockout counters reset — a brute-force attacker gets a fresh 5 attempts |
| `RateLimitFilter` | Bucket4j token buckets per IP | Rate-limit counters reset — a flooder gets a fresh 5 req/min allowance |
| `TelemetrySimulator` | Simulated speed/RPM/gear per driver | Simulation state resets from lap-start values |

**Mitigation (future):** Redis via Upstash free tier would persist these across restarts.

### Orphan Entities (model + repository, no feature code)

The following entities exist in the database schema but are **not wired to any API endpoint or service**:

| Entity | Repository | Notes |
|---|---|---|
| `StrategyPlan` | `StrategyPlanRepository` | Pit strategy simulator planned but not built |
| `CarSetup` | `CarSetupRepository` | Setup data model ready, no management UI |
| `DriverContract` | `DriverContractRepository` | Contract tracking, no UI yet |
| `Sponsorship` | `SponsorshipRepository` | Sponsor management, no UI yet |
| `Penalty` | `PenaltyRepository` | Penalty tracking, no UI yet |
| `Engineer` | `EngineerRepository` | Engineer profiles, no UI yet |
| `Championship` | `ChampionshipRepository` | Has controller but minimal functionality |

These are safe to leave in place (they only add schema weight via `ddl-auto=update`) but are candidates for either building out or removing to keep the codebase lean.

### Database Migration

The project currently uses `spring.jpa.hibernate.ddl-auto=update` even in production. This is convenient for development but risky for schema changes — there's no rollback capability. A migration to **Flyway** is planned for versioned, auditable schema changes.

---

## License

MIT
