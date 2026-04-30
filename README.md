# 🏎️ F1 Pitwall SaaS

> **Live F1 Command Center** — A full-stack Formula 1 management platform built with Spring Boot 4 & Next.js 16, featuring real-time WebSocket telemetry, OpenF1 API integration, pit strategy simulation, championship standings, and a comprehensive 2026 season dataset.

🌐 **Live Demo:** [f1-pitwall-tau.vercel.app](https://f1-pitwall-tau.vercel.app)

---

## ✨ Features

### 🔐 Authentication & Security
- JWT Access token + Refresh token rotation
- BCrypt password hashing
- Role-based authorization: **ADMIN** / **ENGINEER** / **VIEWER**

### 📡 Real-time WebSocket Telemetry
- Live speed, RPM, gear, throttle, brake, DRS via STOMP over SockJS — updated every second
- **Single mode** — full telemetry detail for selected driver
- **Compare mode** — overlay 2 drivers' speed/throttle/RPM charts side by side with head-to-head stats
- **Tyres mode** — tyre life %, temperature status, pit window countdown per driver

### 🔴 OpenF1 Live Race Integration
- Auto-detects live race sessions via OpenF1 API (checks every 30s)
- During race weekends: Tyres tab switches to **real live data** automatically
- Shows actual compound, tyre age, stint number per driver
- Falls back to simulator when no race is active

### 🏆 Race Management & Championship
- Submit race results (P1–P22) with automatic F1 points calculation (25-18-15-12-10-8-6-4-2-1 + fastest lap)
- **Driver Championship Standings** — live table with wins, podiums, fastest laps, gap to leader
- **Constructor Championship Standings** — team points with per-driver breakdown
- 3 completed 2026 races pre-seeded (Australia → Russell, China → Antonelli, Japan → Antonelli)

### 🛞 Pit Strategy Simulator
- Compare up to 5 strategies simultaneously
- Choose tyre compound (S/M/H/I/W) and laps per stint
- Auto-calculates race time: base lap + tyre pace delta + degradation + pit stop loss (22s)
- Visual timeline bars + delta table
- Highlights optimal strategy with ★ FASTEST badge

### 🏁 2026 Season Data
- 22 drivers, 11 teams, 24 circuits, 24 races
- Accurate 2026 lineup: Cadillac & Audi debut, Kimi Antonelli at Mercedes, Lando Norris champion
- 2 cancelled races (Bahrain, Saudi Arabia)

---

## 🛠️ Tech Stack

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Java | 21 LTS | Core language |
| Spring Boot | 4.0.5 | Application framework |
| Spring Security | 7.0.4 | JWT auth & role-based access |
| Spring WebSocket | 7.0.6 | Real-time STOMP messaging |
| Spring Data JPA | 4.0.4 | ORM & repository layer |
| Hibernate | 7.2.7 | Database ORM |
| PostgreSQL | 15 | Primary database |
| JJWT | 0.12.6 | JWT token generation & validation |
| SpringDoc OpenAPI | 2.8.6 | Swagger API docs |
| Lombok | 1.18.44 | Boilerplate reduction |

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.2.1 | React framework (App Router) |
| React | 19.2.4 | UI library |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 4 | Styling |
| SockJS + STOMP.js | 1 / 6 | WebSocket transport |

### Infrastructure
| Service | Purpose |
|---|---|
| Render | Backend (Docker) + PostgreSQL |
| Vercel | Frontend hosting |
| UptimeRobot | Backend uptime monitoring |
| OpenF1 API | Live race data |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                 Next.js Frontend (Vercel)                     │
│  Overview · Drivers · Teams · Races · Standings · Strategy   │
│  Circuits · Telemetry (Single / Compare / Tyres)             │
└───────────────────────┬──────────────────────────────────────┘
                        │ HTTP REST + WebSocket (STOMP/SockJS)
┌───────────────────────▼──────────────────────────────────────┐
│              Spring Boot Backend (Render)                     │
│                                                               │
│  REST Controllers · WebSocket STOMP · JWT Security           │
│  Services · TelemetrySimulator · OpenF1LiveSync              │
│  Repositories (JPA) · Schedulers                             │
└───────────────────────┬──────────────────────────────────────┘
                        │
             ┌──────────▼──────────┐
             │  PostgreSQL (Render) │
             └─────────────────────┘
```

---

## 📁 Project Structure

```
F1-Pitwall/
├── backend/src/main/java/backend/
│   ├── config/           # SecurityConfig, DataSeeder
│   ├── controller/       # 10 REST Controllers
│   ├── dto/              # Request/Response DTOs
│   ├── model/            # 18 JPA Entities + enums
│   ├── repository/       # 18 Repositories
│   ├── scheduler/        # TelemetrySimulator
│   ├── security/         # JWT Filter & Service
│   ├── service/          # Business logic + OpenF1SyncService
│   └── websocket/        # WebSocketConfig, TelemetryPayload
│
├── f1-pitwall-client/src/app/
│   ├── components/       # Navbar
│   ├── drivers/          # Driver Roster
│   ├── teams/            # Constructor Standings
│   ├── races/            # Race Calendar
│   │   └── [raceId]/results/  # Race result submission
│   ├── standings/        # Championship Standings
│   ├── strategy/         # Pit Strategy Simulator
│   ├── circuits/         # Circuit Database
│   ├── telemetry/        # Live Telemetry
│   └── login/
│
├── render.yaml           # Render deployment
└── docker-compose.yml    # Local dev (PostgreSQL + Redis)
```

---

## 🚀 Getting Started

### Prerequisites
- Java 21+, Node.js 18+, Docker Desktop

```bash
git clone https://github.com/phanhhhhhhh/F1-Pitwall.git
cd F1-Pitwall

# Start database
docker compose up -d

# Run backend
cd backend && mvn spring-boot:run

# Run frontend
cd f1-pitwall-client && npm install && npm run dev
```

### Login
| Username | Password | Role |
|---|---|---|
| `admin` | `pitwall2024` | ADMIN |
| `engineer` | `telemetry2024` | ENGINEER |

### Swagger UI
```
http://localhost:8080/swagger-ui/index.html
```

---

## 📡 Key API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login |
| GET | `/api/drivers` | All 2026 drivers |
| GET | `/api/races/season/2026` | Race calendar |
| POST | `/api/race-results/race/{id}` | Submit results (ADMIN) |
| GET | `/api/race-results/standings/drivers/2026` | Driver standings |
| GET | `/api/race-results/standings/constructors/2026` | Constructor standings |
| GET | `/api/openf1/status` | Live race status |
| POST | `/api/sync/all` | Sync past races (ADMIN) |

**WebSocket:** `wss://f1-pitwall-backend.onrender.com/ws` → `/topic/telemetry`

---

## 🔑 Key Technical Decisions

**Spring Boot 4** — Jakarta EE 11, Spring Security 7, modular architecture — cutting-edge Java ecosystem.

**JWT + Refresh tokens** — Stateless auth, horizontal scaling, secure long-lived sessions.

**WebSocket + STOMP** — Pub/sub messaging, SockJS HTTP fallback, selective driver subscriptions.

**OpenF1 Integration** — Auto-detects live sessions, graceful fallback to simulator when no race active.

**Render + Vercel** — Backend on Render (Docker, Java), frontend on Vercel (edge, Next.js optimized).

---

## 🎯 What I Learned

- Full-stack architecture: REST API, JPA relationships, React state management
- Enterprise security: JWT lifecycle, BCrypt, Spring Security filter chains, CORS in production
- Real-time systems: WebSocket, STOMP pub/sub, scheduled broadcasting
- External API integration: polling, caching, graceful fallback
- Production deployment: Docker multi-stage builds, env config, health checks
- Canvas API for real-time data visualization

---

*F1 Pitwall SaaS · 2026 Season · Spring Boot 4 + Next.js 16*
