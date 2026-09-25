# Frontend load perf: baseline vs after (2026-09-24)

Method: `next build` + `next start` locally, Lighthouse mobile, 3 runs/route, median. Cookie `pitwall_session=1` to pass the proxy gate; API calls fail in those runs (backend on Render unreachable), so numbers show JS/render cost, not data load.

| Route | JS transferred before -> after | TBT before -> after | LCP before -> after |
|---|---|---|---|
| /login | 235 -> 224 KB | 21 -> 13 ms | 3079 -> 3392 ms (noise) |
| /standings | 259 -> 257 KB | 14 -> 8 ms | 2785 -> 2773 ms |
| /races | 245 -> 238 KB | 27 -> 16 ms | 3727 -> 3843 ms (noise) |
| /telemetry | 362 -> 269 KB (-26%) | 31 -> 17 ms | 4282 -> 3997 ms |
| /circuits | 379 -> 374 KB | 16 -> 10 ms | 2931 -> 2773 ms |

Changes: lazy sockjs/stompjs (`lib/stomp.ts`), dynamic recharts/LiveTrackMap/TelemetryComparator on /telemetry, `LazyMotion` + `m` (domMax loaded after first paint).

Findings
- Real win is /telemetry (-93 KB). Shared-route gain is small (5-10 KB): domMax still loads after paint because layoutId is used (login, profile, telemetry).
- LCP deltas are within run-to-run noise (~+-400 ms); no LCP claim.
- Phase 3 (fetch dedupe/server shells) not run: no waterfall data because backend was unreachable.

Verification
- Local: tsc, eslint, vitest (62) pass; Playwright e2e against local prod build + local H2 backend: login, 8 routes render, no console errors, no failed chunks, STOMP sockets open, /telemetry shows LIVE, mode switches load lazy chunks.
- Vercel preview (project f1-pitwall, deployment protection on): build Ready; /login /standings /telemetry /circuits 200 via `vercel curl`; all 11 script chunks of /telemetry 200 application/javascript.

Unresolved
- https://f1-pitwall-backend.onrender.com timed out (15 s and 60 s): service suspended/down. Vercel preview could not be tested with live data; preview origin also not in backend CORS list.
- .next inspection is blocked by the scout-block hook, so per-library chunk attribution was not done; sizes come from Lighthouse transfer.
