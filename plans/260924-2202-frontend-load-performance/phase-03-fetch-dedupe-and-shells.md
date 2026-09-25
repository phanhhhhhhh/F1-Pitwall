---
phase: 3
title: "Fetch dedupe and shells (conditional)"
status: pending   # not run: no waterfall data (backend unreachable)
priority: P2
effort: "4h"
dependencies: [1]
---

# Phase 3: Fetch dedupe and shells (conditional)

## Overview
Only run this phase if Phase 1 shows time-to-content dominated by client-side waterfalls (client component mounts, then fetches) rather than JS size. Goal: less duplicated fetching and faster first paint.

## Requirements
- Functional: same data shown; auth-required endpoints keep using `authFetch`.
- Non-functional: no new dependency by default (YAGNI); introduce a tiny in-memory cache with TTL only for slow-changing lists (teams, drivers, circuits, races by season).

## Architecture
- Small helper next to `lib/f1-data.ts`: `cachedFetch(key, fn, ttlMs)` with in-flight promise dedupe. Consumers: pages that refetch the same static lists on every navigation.
- Public, non-personalized pages (`/races`, `/standings`, `/circuits`, `/drivers`, `/teams`) evaluated for a server component shell that renders the frame immediately and hands data fetching to a small client child. Skip any page where auth state is needed for first render.
- Parallelize independent `await`s inside `useEffect` loaders (`Promise.all`) where found sequential.

## Related Code Files
- Modify: `src/app/lib/f1-data.ts`, pages that duplicate list fetches (to be named from Phase 1 network traces), `src/app/context/SeasonContext.tsx` if it refetches per mount
- Create: `src/app/lib/cached-fetch.ts` (+ `.test.ts`) only if justified
- Delete: none

## Implementation Steps
1. From Phase 1 traces, list endpoints fetched more than once per session/navigation and sequential waterfalls.
2. Add `cached-fetch` with tests (TTL expiry, in-flight dedupe, error not cached).
3. Apply to the listed endpoints; `Promise.all` the sequential ones.
4. Evaluate the server-shell change per page; skip if it complicates auth/season context.

## Success Criteria
- [ ] Duplicate requests per navigation eliminated for the targeted endpoints (verified in devtools network).
- [ ] Unit tests for the cache helper pass; existing tests unaffected.
- [ ] Stale data bounded by TTL; mutation flows (admin edits) invalidate or bypass the cache.

## Risk Assessment
Stale data after admin edits -> short TTL plus explicit invalidate on mutate. Cache must never store per-user/authenticated responses across logout: key by nothing personal, and clear on logout.
