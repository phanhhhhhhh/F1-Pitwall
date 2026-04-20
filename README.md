# 🏎️ F1 Pitwall SaaS

> **Live Roster Telemetry Platform** — A full-stack Formula 1 management system built with Spring Boot 4 & Next.js 16, featuring real-time WebSocket telemetry, JWT authentication, and a comprehensive 2026 season dataset.

---

## 📸 Screenshots

> Dashboard Overview · Driver Roster · Live Telemetry

---

## ✨ Features

- 🔐 **JWT Authentication** — Access token + Refresh token, BCrypt password hashing, role-based authorization (ADMIN / ENGINEER / VIEWER)
- 📡 **Real-time WebSocket Telemetry** — Live speed, RPM, gear, throttle, brake, DRS data via STOMP over SockJS, updated every second
- 🏁 **2026 Season Data** — Full grid of 22 drivers, 11 teams, 24 circuits, 22 active races (accurate lineup including Cadillac & Audi debut)
- 🗄️ **18-Entity Data Model** — Comprehensive schema covering Drivers, Teams, Circuits, Races, RaceResults, LapTelemetry, PitStops, CarSetups, WeatherConditions, Penalties, Incidents, StrategyPlans, TyreCompounds, Championships, Sponsorships, DriverContracts, Engineers
- 🎨 **Dark Dashboard UI** — 6-page Next.js app with team color accents, live race calendar, constructor standings, circuit database

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
| Redis | 7 | Cache layer (infrastructure ready) |
| JJWT | 0.12.6 | JWT token generation & validation |
| Lombok | 1.18.44 | Boilerplate reduction |
| Docker | — | Containerized PostgreSQL & Redis |

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.2.1 | React framework (App Router) |
| React | 19.2.4 | UI library |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 4 | Styling |
| SockJS | 1 | WebSocket transport |
| STOMP.js | 6 | WebSocket messaging protocol |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                      │
│   Overview · Drivers · Teams · Races · Circuits · Live  │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP REST + WebSocket (STOMP)
┌──────────────────────▼──────────────────────────────────┐
│                  Spring Boot Backend                     │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  REST API   │  │  WebSocket   │  │  JWT Security  │  │
│  │ Controllers │  │  STOMP       │  │  Filter Chain  │  │
│  └──────┬──────┘  └──────┬───────┘  └────────────────┘  │
│         │                │                               │
│  ┌──────▼──────┐  ┌──────▼───────┐                      │
│  │  Services   │  │  Telemetry   │                      │
│  │  (Domain)   │  │  Simulator   │                      │
│  └──────┬──────┘  └──────────────┘                      │
│         │                                                │
│  ┌──────▼──────┐  ┌──────────────┐                      │
│  │ Repositories│  │    Redis     │                      │
│  │   (JPA)     │  │    Cache     │                      │
│  └──────┬──────┘  └──────────────┘                      │
└─────────┼───────────────────────────────────────────────┘
          │
┌─────────▼───────┐
│   PostgreSQL 15  │
│  (Docker)        │
└─────────────────┘
```

---

## 🗃️ Database Schema (18 Entities)

```
Users ──────────────────────────────────────── Auth
Teams ──────┬── Drivers ──── RaceResults ────── LapTelemetry
            │       │              │
            │       └── Contracts  └── PitStops
            │
            ├── Engineers ── StrategyPlans
            └── Sponsorships

Circuits ── Races ──┬── RaceResults
                    ├── WeatherConditions
                    ├── Incidents
                    └── CarSetups

TyreCompounds ──── LapTelemetry
               └── PitStops

Championships ──── RaceResults
```

---

## 🚀 Getting Started

### Prerequisites
- Java 21+
- Node.js 18+
- Docker Desktop

### 1. Clone the repository
```bash
git clone https://github.com/<your-username>/F1-Pitwall.git
cd F1-Pitwall
```

### 2. Start the database
```bash
docker compose up -d
```

### 3. Run the backend
```bash
cd backend
mvn clean install
mvn spring-boot:run
```

The backend will start on `http://localhost:8080` and automatically seed the database with 2026 F1 season data.

### 4. Run the frontend
```bash
cd f1-pitwall-client
npm install
npm run dev
```

The frontend will start on `http://localhost:3000`.

### 5. Login
| Username | Password | Role |
|---|---|---|
| `admin` | `pitwall2024` | ADMIN — full CRUD access |
| `engineer` | `telemetry2024` | ENGINEER — view + strategy |

---

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login, returns JWT tokens |
| POST | `/api/auth/register` | Register new account |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user info |

### Drivers
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/drivers` | Any | Get all drivers |
| GET | `/api/drivers/{id}` | Any | Get driver by ID |
| GET | `/api/drivers/leaderboard` | Any | Get drivers by career points |
| POST | `/api/drivers` | ADMIN | Add new driver |
| PUT | `/api/drivers/{id}` | ADMIN | Update driver |
| DELETE | `/api/drivers/{id}` | ADMIN | Delete driver |

### Teams
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/teams` | Any | Get all teams |
| POST | `/api/teams` | ADMIN | Create team |
| PUT | `/api/teams/{id}` | ADMIN | Update team |
| DELETE | `/api/teams/{id}` | ADMIN | Delete team |

### Races
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/races` | Any | Get all races |
| GET | `/api/races/season/{year}` | Any | Get races by season |
| POST | `/api/races` | ADMIN | Create race |
| PATCH | `/api/races/{id}/status` | ADMIN/ENGINEER | Update race status |

### Telemetry
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/telemetry/race-result/{id}` | Any | Get lap telemetry |
| POST | `/api/telemetry/race-result/{id}` | ADMIN/ENGINEER | Add lap data |

### WebSocket
| Topic | Description |
|---|---|
| `ws://localhost:8080/ws` | STOMP endpoint (SockJS) |
| `/topic/telemetry` | Live telemetry for all 10 drivers |
| `/topic/telemetry/{carNumber}` | Live telemetry for specific driver |

---

## 📁 Project Structure

```
F1-Pitwall/
├── backend/
│   └── src/main/java/backend/
│       ├── config/           # Security, DataSeeder, ExceptionHandler
│       ├── controller/       # REST Controllers (8 controllers)
│       ├── dto/              # Data Transfer Objects
│       ├── model/            # JPA Entities (18 models)
│       │   └── enums/        # RaceStatus, TyreType, PenaltyType...
│       ├── repository/       # Spring Data JPA Repositories
│       ├── scheduler/        # TelemetrySimulator (WebSocket)
│       ├── security/         # JWT Filter & Service
│       ├── service/          # Business Logic Layer
│       └── websocket/        # WebSocket Config & Payload
│
├── f1-pitwall-client/
│   └── src/app/
│       ├── components/       # Shared Navbar
│       ├── context/          # AuthContext (React)
│       ├── lib/              # pitwall-auth.ts (token management)
│       ├── drivers/          # Driver Roster page
│       ├── teams/            # Constructor Standings page
│       ├── races/            # Race Calendar page
│       ├── circuits/         # Circuit Database page
│       ├── telemetry/        # Live Telemetry page
│       └── login/            # Login page
│
└── docker-compose.yml        # PostgreSQL + Redis
```

---

## 🔑 Key Technical Decisions

**Why Spring Boot 4?** — Latest generation with modular architecture, Jakarta EE 11, and Spring Security 7. Demonstrates familiarity with cutting-edge Java ecosystem.

**Why JWT over Sessions?** — Stateless authentication scales horizontally and suits SaaS architecture. Refresh token pattern provides secure long-lived sessions.

**Why WebSocket + STOMP?** — STOMP provides pub/sub messaging over WebSocket, allowing selective driver subscriptions. SockJS ensures fallback compatibility.

**Why `ddl-auto=update`?** — Simplifies local development. Production would use Flyway/Liquibase migrations.

---

## 🎯 What I Learned

- Full-stack data flow: Form → HTTP → Controller → JPA → PostgreSQL
- Enterprise security patterns: JWT, BCrypt, role-based access control
- Real-time architectures: WebSocket, STOMP pub/sub, scheduled broadcasting
- Spring Boot 4 modular architecture and breaking changes from 3.x
- Docker-based development workflow
- React state management for real-time data streams

---

## 📄 License

This project is for portfolio/educational purposes.

---

*Built with ❤️ as a portfolio project — F1 Pitwall SaaS · 2026 Season*
