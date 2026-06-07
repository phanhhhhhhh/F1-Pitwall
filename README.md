# 🏎️ F1 Pitwall SaaS

> **Live F1 Command Center** — a full-stack Formula 1 management platform built with **Spring Boot 4** & **Next.js 16**, featuring a broadcast-grade *Pit Wall OS* interface, real-time WebSocket telemetry, OpenF1 live-race integration, Google OAuth sign-in, pit-strategy simulation, championship standings, and a full 2026 season dataset.

🌐 **Live Demo:** [f1-pitwall-tau.vercel.app](https://f1-pitwall-tau.vercel.app)
🔌 **API:** [f1-pitwall-backend.onrender.com](https://f1-pitwall-backend.onrender.com)

---

## ✨ Features

### 🎨 "Pit Wall OS" Design System
A custom broadcast-inspired UI language applied across the whole app:
- **Authentic F1 red** (`#E10600`) — not generic red — plus tyre-compound and sector accent colors
- **Saira Condensed** display type for big timing-tower numbers and titles; mono for technical readouts
- Atmospheric backdrop: red radial glow, animated blueprint grid, carbon-fiber weave, vignette, and red "speed-line" streaks
- Signature components: **chamfered cards**, **timing-tower rows** with team-color spines, checkered-flag progress bars, medal-colored top-3, animated count-ups and staggered entrances
- Fully responsive — including a mobile hamburger navbar

### 🔐 Authentication & Security
- **Google OAuth 2.0** sign-in (one-click) **+** classic username/password
- JWT **access + refresh token rotation**
- BCrypt password hashing
- Role-based authorization: **ADMIN / ENGINEER / VIEWER**
- Route protection via Next.js middleware

### 👤 Profile & Account Management
- Editable profile: display name, email, phone, date of birth, location, and bio
- **Avatar upload** to Supabase Storage (with instant navbar preview + localStorage caching)
- **Security tab**: change password with live strength meter and match validation
- Role-accent theming throughout the profile hero

### 📡 Real-time WebSocket Telemetry
Live speed, RPM, gear, throttle, brake, and DRS via **STOMP over SockJS**, updated every second:
- **Single mode** — full telemetry detail for the selected driver
- **Compare mode** — overlay two drivers' speed/throttle/RPM with head-to-head stats
- **Tyres mode** — tyre life %, temperature status, and pit-window countdown per driver

### 🔴 OpenF1 Live Race Integration
- Auto-detects live race sessions via the OpenF1 API (polled every 30s)
- During race weekends the Tyres tab switches to **real live data** automatically (actual compound, tyre age, stint number)
- Gracefully falls back to the simulator when no session is active

### 🏆 Race Management & Championship
- Submit race results (P1–P22) with automatic F1 points (25-18-15-12-10-8-6-4-2-1 + fastest lap)
- **Driver Championship Standings** — live table with wins, podiums, fastest laps, and gap to leader
- **Constructor Championship Standings** — team points with per-driver breakdown
- **Top-6 standings** surfaced directly on the Overview dashboard
- **CSV & PDF export** of driver and constructor standings
- Pre-seeded completed 2026 rounds (Australia → Russell, China → Antonelli, Japan → Antonelli); further rounds (e.g. Canada) pulled in via the admin sync endpoint

### 🛞 Pit Strategy Simulator
- Compare up to **5 strategies** simultaneously
- Pick tyre compound (S/M/H/I/W) and laps per stint
- Auto-calculates race time: base lap + tyre pace delta + degradation + pit-stop loss (~22s)
- Visual timeline bars + delta table, with the optimal strategy flagged **★ FASTEST**

### 🏁 2026 Season Data
- **22 drivers · 11 teams · 24 circuits**
- **22 Grand Prix + 6 Sprints**, with Grand Prix and Sprint counts tracked separately across the dashboard and calendar
- Accurate 2026 lineup: Cadillac & Audi debut, Kimi Antonelli at Mercedes, Lando Norris as reigning champion
- 2 cancelled races (Bahrain, Saudi Arabia) reflected in season progress

---

## 🛠️ Tech Stack

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Java | 21 LTS | Core language |
| Spring Boot | 4.0.5 | Application framework |
| Spring Security | 7.0.4 | JWT auth, OAuth2 client & role-based access |
| Spring WebSocket | 7.0.6 | Real-time STOMP messaging |
| Spring Data JPA | 4.0.4 | ORM & repository layer |
| Hibernate | 7.2.7 | Database ORM |
| PostgreSQL | 15 | Primary database |
| JJWT | 0.12.6 | JWT generation & validation |
| SpringDoc OpenAPI | 2.8.6 | Swagger API docs |
| Lombok | 1.18.44 | Boilerplate reduction |

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.2.1 | React framework (App Router) |
| React | 19.2.4 | UI library |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 4 | Styling (CSS-first, no config file) |
| Saira / Saira Condensed | — | Pit Wall OS display typography |
| SockJS + STOMP.js | 1 / 6 | WebSocket transport |

### Infrastructure
| Service | Purpose |
|---|---|
| Render | Backend (Docker, Java) |
| Vercel | Frontend hosting (edge) |
| Supabase | PostgreSQL database + Storage (avatars) |
| Google Cloud | OAuth 2.0 identity provider |
| UptimeRobot | Backend uptime monitoring |
| OpenF1 API | Live race data |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  Next.js Frontend (Vercel)                    │
│  Overview · Drivers · Teams · Races · Standings · Strategy    │
│  Circuits · Telemetry (Single / Compare / Tyres) · Profile    │
│            "Pit Wall OS" design system + OAuth                │
└───────────────────────┬──────────────────────────────────────┘
                        │ HTTP REST + WebSocket (STOMP/SockJS)
┌───────────────────────▼──────────────────────────────────────┐
│               Spring Boot Backend (Render)                    │
│  REST Controllers · WebSocket STOMP · JWT + OAuth2 Security   │
│  Services · TelemetrySimulator · OpenF1LiveSync · Schedulers  │
│  Repositories (JPA)                                           │
└───────────┬───────────────────────────────┬──────────────────┘
            │                               │
   ┌────────▼─────────┐            ┌────────▼─────────┐
   │ Supabase Postgres │            │ Supabase Storage │
   │   (Session Pool)  │            │     (avatars)    │
   └───────────────────┘            └──────────────────┘
```

---

## 📁 Project Structure

```
F1-Pitwall/
├── backend/src/main/java/backend/
│   ├── config/           # SecurityConfig, DataSeeder
│   ├── controller/       # 10 REST Controllers (incl. AuthController)
│   ├── dto/              # Request/Response DTOs
│   ├── model/            # 18 JPA Entities + enums (User w/ profile fields)
│   ├── repository/       # 18 Repositories
│   ├── scheduler/        # TelemetrySimulator
│   ├── security/         # JWT Filter & Service, OAuth2SuccessHandler
│   ├── service/          # Business logic + OpenF1SyncService
│   └── websocket/        # WebSocketConfig, TelemetryPayload
│
├── f1-pitwall-client/src/app/
│   ├── components/       # Navbar, RaceWeekendWidget, NotificationBell, ExportButton
│   ├── context/          # AuthContext
│   ├── lib/              # pitwall-auth, export (CSV/PDF)
│   ├── drivers/          # Driver Roster
│   ├── teams/            # Constructors / The Grid
│   ├── races/            # Race Calendar (timeline)
│   │   └── [raceId]/      # qualifying + results submission
│   ├── standings/        # Championship Standings (drivers + constructors)
│   ├── strategy/         # Pit Strategy Simulator
│   ├── circuits/         # Circuit Database
│   ├── telemetry/        # Live Telemetry
│   ├── profile/          # Profile & account management
│   ├── admin/            # Admin tools
│   ├── login/  register/ # Auth (password + Google OAuth)
│   └── Middleware.ts     # Route protection
│
├── render.yaml           # Render deployment
└── docker-compose.yml    # Local dev (PostgreSQL)
```

---

## 🚀 Getting Started

### Prerequisites
- Java 21+, Node.js 18+, Docker Desktop

```bash
git clone https://github.com/phanhhhhhhh/F1-Pitwall.git
cd F1-Pitwall

# Start local database
docker compose up -d

# Run backend
cd backend && mvn spring-boot:run

# Run frontend
cd f1-pitwall-client && npm install && npm run dev
```

> **Note:** local dev uses dummy OAuth credentials in `application.properties`; production reads real Google OAuth + Supabase env vars from `application-prod.properties`.

### Login
| Username | Password | Role |
|---|---|---|
| admin | pitwall2024 | ADMIN |
| engineer | telemetry2024 | ENGINEER |

…or sign in with **Google**.

### Swagger UI
```
http://localhost:8080/swagger-ui/index.html
```

---

## 📡 Key API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user (with profile) |
| PATCH | `/api/auth/profile` | Update profile fields |
| POST | `/api/auth/change-password` | Change password |
| GET | `/api/drivers` | All 2026 drivers |
| GET | `/api/teams` | All constructors |
| GET | `/api/circuits` | Circuit database |
| GET | `/api/races/season/2026` | Race calendar |
| POST | `/api/race-results/race/{id}` | Submit results (ADMIN) |
| GET | `/api/race-results/standings/drivers/2026` | Driver standings |
| GET | `/api/race-results/standings/constructors/2026` | Constructor standings |
| GET | `/api/race-results/winners/2026` | Race winners map |
| GET | `/api/openf1/status` | Live race status |
| POST | `/api/sync/all` | Sync past races (ADMIN) |

**WebSocket:** `wss://f1-pitwall-backend.onrender.com/ws` → `/topic/telemetry`

---

## 🔑 Key Technical Decisions

- **Spring Boot 4** — Jakarta EE 11, Spring Security 7, modular architecture on the cutting edge of the Java ecosystem.
- **JWT + Refresh tokens** — stateless auth, horizontal scaling, secure long-lived sessions.
- **Google OAuth 2.0** — frictionless sign-in alongside credential login, handled by a custom success handler that issues app tokens.
- **WebSocket + STOMP** — pub/sub messaging with SockJS HTTP fallback and selective per-driver subscriptions.
- **OpenF1 integration** — auto-detects live sessions with graceful fallback to the simulator when no race is active.
- **Supabase** — managed Postgres (Session Pooler) plus object Storage for avatars, keeping the backend stateless.
- **Pit Wall OS design system** — a single broadcast-grade visual language (tokens, typography, motion) reused across every page.

---

## 🎯 What I Learned

- Full-stack architecture: REST API design, JPA relationships, React state management
- Enterprise security: JWT lifecycle, OAuth2 flows, BCrypt, Spring Security filter chains, production CORS
- Real-time systems: WebSocket, STOMP pub/sub, scheduled broadcasting
- External API integration: polling, caching, graceful fallback
- Cloud storage & managed databases with Supabase
- Production deployment: Docker multi-stage builds, env config, health checks
- Building and applying a cohesive, responsive design system from scratch
- Canvas API for real-time data visualization

---

*F1 Pitwall SaaS · 2026 Season · Spring Boot 4 + Next.js 16*
