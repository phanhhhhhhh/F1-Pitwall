---
phase: 1
title: "Baseline measurement"
status: completed
priority: P1
effort: "2h"
dependencies: []
---

# Phase 1: Baseline measurement

## Overview
Record current bundle and page-load numbers so later phases are judged on data, not guesses.

## Requirements
- Functional: reproducible numbers for route JS sizes and Lighthouse (mobile) on `/`, `/standings`, `/races`, `/telemetry`, `/circuits`.
- Non-functional: no source changes; analyzer tooling not committed unless kept as a dev script.

## Architecture
`next build` route table (first-load JS) + `@next/bundle-analyzer` (run ad hoc via `ANALYZE=true`, or `npx` without adding a dependency) + Lighthouse CLI against `next start`. Separate TTFB (backend/cold start) from JS/render cost.

## Related Code Files
- Modify: none (optionally `f1-pitwall-client/next.config.ts` behind an env flag for the analyzer)
- Create: `plans/reports/perf-baseline-260924.md`

## Implementation Steps
1. `cd f1-pitwall-client && npm run build`; save the route/first-load JS table.
2. Run the analyzer; list top 10 modules in the shared chunk and in `/telemetry`.
3. Lighthouse mobile x3 per route against `next start` with API pointed at the same backend; record LCP, TBT, transfer size, TTFB.
4. Write the report: numbers plus which phase-2/3 candidates are actually large.

## Success Criteria
- [ ] Baseline report exists with build table + Lighthouse medians.
- [ ] Confirms or refutes: stomp/sockjs in shared chunk, recharts/three sizes, framer-motion size.

## Risk Assessment
Noisy Lighthouse runs (use median of 3, same machine). Backend cold start skews LCP: record TTFB separately.
