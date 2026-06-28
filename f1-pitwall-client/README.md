# 🏎️ F1 Pitwall — Client

Next.js 16 frontend for the F1 Pitwall race operations platform.

## Tech Stack

- **Next.js 16.2** (App Router) · **React 19** · **TypeScript 5**
- **Tailwind CSS 4** · **Framer Motion** · **Recharts 3.8**
- **Supabase JS** (avatar storage)

## Pages

| Route | Purpose |
|---|---|
| `/` | Dashboard — hero, standings top 6, next race countdown, calendar |
| `/login` | Password + OTP login, Google OAuth2 |
| `/register` | Account creation, Google OAuth2 |
| `/forgot-password` | 3-step email → OTP → new password |
| `/profile` | Edit profile, security (change password), avatar upload to Supabase |
| `/standings` | Driver & constructor standings, podium, gap-to-leader chart, CSV/PDF export |
| `/races` | Race calendar with GP/Sprint/Completed/Cancelled filters |
| `/races/[id]/weekend` | Race weekend hub — session tabs (FP1/FP2/FP3/SQ/Quali/Race), practice lap times |
| `/races/[id]/results` | Podium visualization, full classification table, manual entry, OpenF1 re-sync |
| `/races/[id]/qualifying` | Pole hero, starting grid, Q1/Q2/Q3 session times |
| `/drivers` | Driver cards with search, team filter, sort |
| `/teams` | Constructor grid with driver lineups, championships, budgets |
| `/circuits` | Circuit database with stats, track motifs, type filter |
| `/strategy` | Pit strategy simulator (local simulation) |
| `/telemetry` | WebSocket live telemetry — single/compare/tyres modes |
| `/admin` | Stats dashboard, user management, data sync |

## Architecture

```
src/
  app/
    types/f1.ts          ← Shared TypeScript interfaces (single source of truth)
    lib/
      api-client.ts      ← API endpoint definitions + authFetch re-export
      pitwall-auth.ts    ← JWT auth, token management, refresh, OTP, OAuth2
      f1-theme.ts        ← Design tokens, team colors, flags, tyre specs
      export.ts          ← CSV/PDF download helpers
    context/AuthContext.tsx ← Auth state provider
    components/          ← Shared UI components (Navbar, NotificationBell, charts, etc.)
    Middleware.ts         ← Auth guard — redirects unauthenticated users to /login
```

## Auth Flow

- **Password login**: `POST /api/auth/login` → JWT access + refresh tokens stored in `localStorage`
- **OTP login**: `POST /api/auth/otp/send` → `POST /api/auth/otp/verify`
- **OAuth2 (Google)**: Redirect → callback stores tokens → 2FA OTP on pending page
- **Middleware**: checks `pitwall_session` cookie; redirects to `/login` on protected routes
- **Token refresh**: automatic 401 retry with refresh token in `authFetch`

## Known Limitations

- **All pages are client components** — initial data is fetched client-side after mount. No SSR/SSG.
- **Strategy page is entirely local** — tyre degradation, pit loss times, and lap simulation run in the browser. Circuit data is real, but the physics model is a simplified linear approximation.
- **No tests** — zero test files, no test runner configured.
- **localStorage auth fallback** — when the backend is cold-starting (Render free tier), the AuthContext falls back to cached `localStorage` values to avoid flashing a logged-out UI. This could serve stale role data.
- **`any` types** — several pages use `Record<string, any>` for race/circuit data where the backend schema varies.

## Getting Started

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
```

Requires the backend running at `NEXT_PUBLIC_API_URL` (default: `http://localhost:8080`).

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | No | Backend API base URL (default: `http://localhost:8080`) |
| `NEXT_PUBLIC_SUPABASE_URL` | No* | Supabase project URL (avatar upload) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No* | Supabase anon key (avatar upload) |

*Required only if avatar upload is used in `/profile`.
