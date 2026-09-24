---
phase: 4
title: "Verify and lock in"
status: completed
priority: P2
effort: "2h"
dependencies: [2, 3]
---

# Phase 4: Verify and lock in

## Overview
Re-measure against the Phase 1 baseline, tidy small wins, and record results.

## Requirements
- Functional: before/after comparison; no regressions.
- Non-functional: keep guardrails cheap (no heavy CI additions).

## Architecture
Same tooling as Phase 1. Small extras only if measured worthwhile: replace the 3 raw `<img>` with `next/image` (remote patterns already configured for Supabase/Google avatars), verify `next/font` preload, confirm static assets carry immutable cache headers on the actual host (Vercel by default).

## Related Code Files
- Modify: the 3 files containing raw `<img>` (find via `grep -rn "<img" src`), optionally `next.config.ts`
- Create: `plans/reports/perf-after-260924.md`

## Implementation Steps
1. Rebuild; record route table and Lighthouse medians using the Phase 1 method.
2. Swap `<img>` -> `next/image` where dimensions are known; skip if it adds layout risk.
3. Run `npm run lint`, `npm test`, `npm run build`; smoke the 5 routes plus login, notifications, live telemetry.
4. Write the after-report with deltas; update `docs/` only if a documented command or config changed.

## Success Criteria
- [ ] After-report shows deltas vs baseline for each acceptance criterion in `plan.md`.
- [ ] All checks green; smoke test passes.
- [ ] Any phase-2/3 change without a measured win reverted.

## Risk Assessment
Regression hidden by lazy loading (e.g. realtime not connecting) -> explicit smoke items above. Review pass by a separate reviewer before merge.
