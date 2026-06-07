# F1 Pitwall

A full-stack Formula 1 race engineering SaaS platform for the 2026 season — live WebSocket telemetry, driver/constructor standings, pit strategy simulator, race management, and a broadcast-grade "Pit Wall OS" design system.

**Live Demo:** [f1-pitwall-tau.vercel.app](https://f1-pitwall-tau.vercel.app) &nbsp;|&nbsp; **API:** [f1-pitwall-backend.onrender.com](https://f1-pitwall-backend.onrender.com)

---

## Features

- **Pit Wall OS Design System** — broadcast-inspired UI with F1 red, Saira Condensed typography, chamfered cards, timing-tower rows, animated count-ups, and responsive mobile layout
- **Google OAuth 2.0 + JWT Auth** — one-click Google sign-in alongside username/password; access + refresh token rotation; BCrypt hashing; role-based access (ADMIN / ENGINEER / VIEWER)
- **Live WebSocket Telemetry** — speed, RPM, gear, throttle, brake, and DRS via STOMP/SockJS; Single, Compare, and Tyres modes updated every second
- **OpenF1 Live Race Integration** — auto-detects live sessions and switches Tyres tab to real compound/age/stint data; falls back to simulator when no race is active
- **Driver & Constructor Championship Standings** — wins, podiums, fastest laps, gap to leader; top-6 surfaced on the Overview dashboard; CSV & PDF export
- **Race Management** — submit P1–P22 results with automatic F1 points (including fastest-lap bonus); pre-seeded 2026 season (22 drivers, 11 teams, 24 circuits, 24 GPs + 6 Sprints)
- **Pit Strategy Simulator** — compare up to 5 strategies; pick tyre compound (S/M/H/I/W) and stint lengths; auto-calculates race time with degradation and pit-stop loss; flags optimal strategy
- **Profile & Account Management** — editable display name, email, phone, DOB, location, bio; avatar upload to Supabase Storage with instant navbar preview
- **Admin Panel** — sync past race results, manage season data via dedicated admin endpoints
- **Swagger UI** — interactive API docs at `/swagger-ui/index.html`

---

## Tech Stack

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Java | 21 LTS | Core language |
| Spring Boot | 4.0.5 | Application framework |
| Spring Security | 7 | JWT, OAuth2, role-based access |
| Spring WebSocket | 7 | STOMP real-time messaging |
| PostgreSQL | 15 | Primary database (Supabase) |
| JJWT | 0.12.6 | JWT generation & validation |
| SpringDoc OpenAPI | 2.8.6 | Swagger API docs |

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.2.1 | React framework (App Router) |
| React | 19.2.4 | UI library |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 4 | CSS-first styling |
| SockJS + STOMP.js | 1 / 6 | WebSocket transport |

### Infrastructure
Render (backend Docker deployment) · Vercel (frontend edge) · Supabase (PostgreSQL + avatar storage) · Google Cloud (OAuth 2.0)

---

## Prerequisites

- Java 21+
- Node.js 18+
- PostgreSQL 14+ (or Docker Desktop for `docker-compose`)
- Maven 3.9+

---

## Quick Start

### Backend

```bash
# 1. Navigate to backend directory
cd backend

# 2. Start a local PostgreSQL database (or use Docker)
docker compose up -d          # from project root — starts f1_pitwall_db on port 5432

# 3. Copy and configure environment variables
cp .env.example .env          # then edit .env with your values

# 4. Run the backend
mvn spring-boot:run
```

- API: `http://localhost:8080`
- Swagger UI: `http://localhost:8080/swagger-ui/index.html`

### Frontend

```bash
# 1. Navigate to frontend directory
cd f1-pitwall-client

# 2. Copy and configure environment variables
cp .env.example .env.local    # set NEXT_PUBLIC_API_URL=http://localhost:8080

# 3. Install dependencies and start
npm install && npm run dev
```

- App: `http://localhost:3000`

---

## Default Credentials (local dev)

| Role | Username | Password |
|---|---|---|
| Admin | admin | pitwall2024 |
| Engineer | engineer | telemetry2024 |

Or sign in with **Google** (requires real Google OAuth credentials — set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `backend/.env`).

---

## Environment Variables

### Backend (`backend/.env.example`)

| Variable | Description |
|---|---|
| `DB_URL` | PostgreSQL JDBC URL (default: `jdbc:postgresql://localhost:5432/f1_pitwall_db`) |
| `DB_USERNAME` | Database username |
| `DB_PASSWORD` | Database password |
| `JWT_SECRET` | HS256 signing key — minimum 32 characters |
| `ADMIN_PASSWORD` | Password seeded for the `admin` user on first startup |
| `ENGINEER_PASSWORD` | Password seeded for the `engineer` user on first startup |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (e.g. `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID (`dummy-local` disables OAuth) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret |
| `SPRING_PROFILES_ACTIVE` | `dev` (local) or `prod` (production) |

### Frontend (`f1-pitwall-client/.env.example`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend base URL (e.g. `http://localhost:8080`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (for avatar uploads) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |

---

## Deployment

**Backend — Render:** Docker multi-stage build; `render.yaml` and `Dockerfile` are pre-configured. Set `SPRING_PROFILES_ACTIVE=prod` and provide all production env vars in the Render dashboard.

**Frontend — Vercel:** `vercel.json` configured with `output: standalone`. Connect the GitHub repo, set `NEXT_PUBLIC_API_URL` to your Render backend URL, and deploy.

---

## License

MIT
