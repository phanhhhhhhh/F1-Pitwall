---
phase: 2
title: "Code-splitting and lazy realtime"
status: completed
priority: P1
effort: "4h"
dependencies: [1]
---

# Phase 2: Code-splitting and lazy realtime

## Overview
Move heavy or rarely-needed code out of the initial/shared bundles. Apply only the items Phase 1 shows to be large.

## Requirements
- Functional: identical UI and behavior; notifications and live telemetry still connect and update.
- Non-functional: no layout shift from lazy loading (keep skeleton/placeholder of the same size).

## Architecture
1. **Lazy stomp/sockjs:** in `lib/stomp.ts`, replace static imports with dynamic `import()` inside the connect path so the libs load on first subscribe. `NotificationBell` (global) then stops pulling them into every route until a logged-in user subscribes.
2. **`/telemetry` splitting:** `next/dynamic` (`ssr: false`) for `TelemetryComparator`, `LiveTrackMap` and the recharts-heavy sections, following the existing pattern in `standings/page.tsx:23` and `circuits/page.tsx:13`.
3. **framer-motion slimming:** wrap the app in `LazyMotion features={domAnimation}` and switch `motion.*` to `m.*` (`import { m } from "framer-motion"`), only if Phase 1 shows framer-motion is a large shared cost. Mechanical but touches ~28 files: do it as one commit.
4. Below-the-fold/modal components on heavy pages (`strategy`, `admin`, `profile`) get `dynamic()` only when the analyzer shows a big chunk.

## Related Code Files
- Modify: `f1-pitwall-client/src/app/lib/stomp.ts`, `src/app/components/NotificationBell.tsx`, `src/app/telemetry/page.tsx`, `src/app/layout.tsx` (LazyMotion provider, if step 3), files importing `motion` (list from `grep -rn "from \"framer-motion\""`)
- Create: none expected (small client wrapper for LazyMotion if layout must stay a server component)
- Delete: none

## Implementation Steps
1. Make `stomp.ts` load `sockjs-client` and `@stomp/stompjs` lazily; keep the exported `subscribeToTopic` signature and its unit test (`lib/stomp.test.ts`) green; adjust test mocks only if needed for async import.
2. Dynamic-import comparator/map on `/telemetry` with same-height placeholders.
3. (Conditional) LazyMotion + `m` migration.
4. Re-run Phase 1 measurements after each step; keep only steps with a measurable win.

## Success Criteria
- [ ] `sockjs`/`stompjs` no longer in the shared first-load chunk.
- [ ] `/telemetry` first-load JS smaller by the recharts/comparator/map weight.
- [ ] `npm test`, `npm run lint`, `npm run build` pass; manual check: bell receives a notification, telemetry page streams live data.

## Risk Assessment
- Lazy stomp adds connection latency on first subscribe: acceptable, verify no missed first message (subscribe after connect resolved).
- CSP (`script-src 'self' 'unsafe-inline'`) allows same-origin chunks: no change needed.
- Async import changes test timing: fix by awaiting in tests, not weakening them.
