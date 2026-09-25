---
title: "Frontend load performance (f1-pitwall-client)"
description: "Cut initial JS and first-load cost of the Next.js client via measured code-splitting, lazy realtime, and fetch dedupe"
status: in-progress
priority: P2
mode: fast
created: 2026-09-24
blockedBy: []
blocks: []
---

# Frontend load performance

## Outcome
Lower first-load JS and faster LCP on the main routes (`/`, `/standings`, `/races`, `/telemetry`, `/circuits`, `/strategy`) without changing behavior or public contracts.

## Non-goals
- Backend/API/DB tuning (separate plan if wanted).
- Visual redesign. No new state libs unless Phase 3 measurements justify it.
- Removing `framer-motion`, `three`, `recharts` (only deferring/slimming them).

## Scout findings (evidence)
- Every page is a client component (59 `"use client"` files); data loads via `useEffect` + `authFetch`, no shared cache or dedupe.
- `Navbar` -> `NotificationBell` -> `lib/stomp` statically imports `sockjs-client` + `@stomp/stompjs` into the global bundle.
- `telemetry/page.tsx` statically imports `recharts`, `TelemetryComparator`, `LiveTrackMap` (635 lines), `framer-motion`, `stomp`. Only `circuits` (Track3DViewer) and `standings` (GapToLeaderChart) already use `next/dynamic`.
- `framer-motion` `motion` imported in ~28 files (full feature bundle each route).
- `three`, `recharts` only reachable via dynamic/telemetry paths, but never measured.
- `next/image` used 0 times; 3 raw `<img>`. Fonts via `next/font` (fine). `next.config.ts` has no `experimental`/compression tweaks and no static-asset cache concerns beyond defaults.
- React Compiler plugin already present.
- No baseline numbers exist anywhere. Cause unproven -> measure first.

## Acceptance criteria
- Baseline and after numbers recorded in `plans/reports/` (route JS sizes from `next build`, Lighthouse mobile LCP/TBT for 4 routes).
- Shared first-load JS (all routes) down by a measurable amount; `sockjs`/`stompjs` absent from non-realtime routes' chunks.
- `/telemetry` initial chunk excludes `recharts` and comparator until needed.
- `npm run lint`, `npm test`, `npm run build` pass; no behavior regressions (manual smoke on listed routes; realtime notifications + live telemetry still connect).
- No targets are guessed: if a phase shows no measurable win, it is dropped.

## Phases
| # | Phase | Status | Depends |
|---|-------|--------|---------|
| 1 | [Baseline measurement](phase-01-baseline-measurement.md) | completed | - |
| 2 | [Code-splitting and lazy realtime](phase-02-code-splitting-lazy-realtime.md) | completed | 1 |
| 3 | [Fetch dedupe and shells (conditional)](phase-03-fetch-dedupe-and-shells.md) | pending | 1 |
| 4 | [Verify and lock in](phase-04-verify-and-lock-in.md) | completed (partial: img swap skipped) | 2, 3 |

## Open questions
- Where is the client deployed (Vercel per `vercel.json`, Docker per `Dockerfile`)? Affects how Lighthouse is run (prod build against the deployed API vs local).
- Is a slow backend (Render cold start, see `render.yaml`) the real bottleneck the user feels? If so, frontend gains are capped; Phase 1 will show TTFB vs JS cost.
