---
name: nextjs-client-conventions
description: Next.js conventions in f1-pitwall-client — AuthContext usage, API call patterns, Tailwind + design system approach
triggers:
  - authcontext
  - useauth
  - authfetch
  - api call
  - api client
  - add page
  - new page
  - route guard
  - tailwind pattern
  - design system
  - styling convention
  - pitwall client
  - nextjs convention
  - add new feature client
---

# F1 Pitwall — Next.js Client Conventions

Extracted from `f1-pitwall-client/src/app/`. Apply these patterns exactly when adding new pages or features to the frontend.

---

## 1. Page Setup Checklist

Every page in this project follows the same five-part structure:

1. `"use client";` at the top — all pages are client components
2. Route guard in `useEffect` — redirect to `/login` if no token
3. Data fetch in same `useEffect` (or a separate one for dependent data)
4. `<Navbar />` + full-bleed background shell
5. Per-page `<style>` block injecting Saira fonts + shared keyframes

---

## 2. Auth: Route Guard Pattern

**Never** use `useAuth()` for route guarding — it introduces a loading flash. Use `getAccessToken()` directly in `useEffect`:

```tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getAccessToken } from "../lib/pitwall-auth";
import { BASE_URL as API } from "../lib/api-client";

export default function MyPage() {
  const router = useRouter();
  const [data, setData] = useState<MyType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) { router.push("/login"); return; }
    authFetch(`${API}/api/my-resource`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);
  // ...
}
```

**Why `getAccessToken()` not `useAuth()`:**
`useAuth()` waits for `AuthContext` to fetch `/api/auth/me` before setting `isAuthenticated`. On first render, `isAuthenticated` is `false` even when a token exists. `getAccessToken()` reads `localStorage` synchronously — no flicker, no redirect on valid sessions.

---

## 3. Auth: When to Use `useAuth()`

Use `useAuth()` only when you need the `User` object fields (displayName, role, avatarUrl):

```tsx
import { useAuth } from "../context/AuthContext";

const { user, isLoading, logout } = useAuth();

// Access user fields (all optional except id/username/role/createdAt):
user?.displayName
user?.avatarUrl
user?.role        // "ADMIN" | "ENGINEER" | "VIEWER"
user?.phone
user?.bio
user?.location
user?.dateOfBirth
```

**User interface** (`lib/pitwall-auth.ts`):
```ts
interface User {
  id: number; username: string; email: string; role: string; createdAt: string;
  displayName?: string; avatarUrl?: string;
  phone?: string; bio?: string; location?: string; dateOfBirth?: string;
}
```

---

## 4. API: `authFetch` — The Only HTTP Client

**Always use `authFetch`** from `lib/pitwall-auth` (re-exported from `lib/api-client`). Never use raw `fetch` for authenticated endpoints.

```ts
import { authFetch } from "../lib/pitwall-auth";
import { BASE_URL as API } from "../lib/api-client";

// GET
const res = await authFetch(`${API}/api/drivers`);
const drivers = await res.json();

// POST with body
const res = await authFetch(`${API}/api/race-results`, {
  method: "POST",
  body: JSON.stringify(payload),   // Content-Type: application/json is set automatically
});

// PATCH
const res = await authFetch(`${API}/api/auth/profile`, {
  method: "PATCH",
  body: JSON.stringify({ displayName: "New Name" }),
});
```

**What `authFetch` does automatically:**
- Adds `Authorization: Bearer <token>` header
- Sets `Content-Type: application/json`
- Enforces 10-second timeout (aborts via `AbortController`)
- On 401: attempts token refresh once, retries the request
- On refresh failure: calls `clearTokens()` and redirects to `/login`
- Throws `ApiError(status, message)` on non-2xx (except 401, which is handled)

---

## 5. API: Parallel Fetch Pattern

Use `Promise.all` for independent concurrent fetches:

```ts
useEffect(() => {
  if (!getAccessToken()) { router.push("/login"); return; }
  Promise.all([
    authFetch(`${API}/api/teams`).then(r => r.json()),
    authFetch(`${API}/api/drivers`).then(r => r.json()),
  ])
    .then(([teams, drivers]) => { setTeams(teams); setDrivers(drivers); })
    .catch(console.error)
    .finally(() => setLoading(false));
}, []);
```

---

## 6. API: `api` Object (Typed Shortcuts)

`lib/api-client.ts` exports a typed `api` object for common endpoints:

```ts
import { api } from "../lib/api-client";

// Examples:
api.drivers.getAll()
api.teams.getAll()
api.races.getBySeason(2026)
api.races.getById(raceId)
api.races.getWinners(2026)
api.circuits.getAll()
api.standings.drivers(2026)
api.standings.constructors(2026)
api.raceResults.getByRace(raceId)
api.raceResults.getQualifying(raceId)
api.notifications.getAll()
api.notifications.markRead(id)
api.notifications.markAllRead()
api.auth.me()
api.auth.updateProfile(data)
api.admin.users()
api.strategy.getByRace(raceId)
api.telemetry.getByRace(raceId)
```

All return `Promise<Response>` — still call `.then(r => r.json())` after.

For endpoints not in `api`, use `authFetch` directly with `BASE_URL`:
```ts
import { BASE_URL as API } from "../lib/api-client";
authFetch(`${API}/api/openf1/tyres`)
```

---

## 7. Error Handling in Pages

Standard pattern — state-driven error display:

```tsx
const [error, setError] = useState<string | null>(null);

// In fetch:
.catch((e: unknown) => {
  console.error(e);
  setError(e instanceof Error ? e.message : "Failed to load data.");
})

// In JSX:
{error && (
  <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-800/60 px-5 py-4"
    style={{ background: "rgba(225,6,0,.08)" }}>
    <span className="f-mono text-[11px] text-[#E10600] font-bold tracking-widest mt-0.5 shrink-0">ERROR</span>
    <p className="f-mono text-sm text-red-300">{error}</p>
  </div>
)}
```

---

## 8. Styling: Design Tokens

The app uses a dark, F1-themed design language. Core values:

| Token | Value | Usage |
|---|---|---|
| Background | `#0a0a0c` | Page root (inline `style`) |
| Brand red | `#E10600` | Accents, active states, CTAs |
| Brand red soft | `#ff5a3c` | Gradient endpoints |
| Zinc scale | `zinc-500/600/700/900/950` | Text, borders, secondary UI |
| Font — condensed | `f-cond` (Saira Condensed) | Headings, numbers, big labels |
| Font — mono | `f-mono` (Geist Mono) | Meta info, tags, caps labels |

---

## 9. Styling: Page Shell Template

Every page uses the same shell — copy this verbatim and customize the gradient position:

```tsx
<div className="min-h-screen text-white relative overflow-x-hidden" style={{ background: "#0a0a0c" }}>
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Saira:ital,wght@0,400;0,500;0,600;0,700;1,600;1,800&family=Saira+Condensed:wght@500;600;700;800;900&display=swap');
    .f-cond{font-family:'Saira Condensed','Saira',system-ui,sans-serif}
    .f-mono{font-family:var(--font-geist-mono),ui-monospace,monospace}
    @keyframes grid-pan{from{background-position:0 0}to{background-position:0 80px}}
    @keyframes rise{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    @keyframes streak{0%{transform:translateX(-100%);opacity:0}15%{opacity:1}85%{opacity:1}100%{transform:translateX(60vw);opacity:0}}
    .rise{animation:rise .45s cubic-bezier(.16,1,.3,1) both}
    .chamfer{clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px))}
  `}</style>

  {/* Ambient background — change radial-gradient position per page */}
  <div className="fixed inset-0 z-0 pointer-events-none">
    <div className="absolute inset-0"
      style={{ background: "radial-gradient(120% 80% at 50% -10%, rgba(225,6,0,.10), transparent 55%)" }} />
    <div className="absolute inset-0"
      style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)", backgroundSize: "80px 80px", animation: "grid-pan 6s linear infinite", maskImage: "radial-gradient(circle at 50% 20%,black,transparent 80%)" }} />
    <div className="absolute inset-0 opacity-50"
      style={{ backgroundImage: "repeating-linear-gradient(45deg,rgba(255,255,255,.012) 0 2px,transparent 2px 5px)" }} />
    <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 220px 60px rgba(0,0,0,.9)" }} />
    {Array.from({ length: 4 }).map((_, i) =>
      <div key={i} className="absolute h-px"
        style={{ width: `${120 + i * 50}px`, top: `${18 + i * 20}%`, left: "-10%", background: "linear-gradient(90deg,transparent,rgba(225,6,0,.5),transparent)", animation: `streak ${5 + i * 1.4}s linear infinite`, animationDelay: `${i * 1.3}s` }} />
    )}
  </div>

  <Navbar />

  <main className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
    {/* page content */}
  </main>
</div>
```

---

## 10. Styling: Page Header Pattern

Consistent header with eyebrow + split-color title:

```tsx
<div className="flex items-end justify-between mb-10 flex-wrap gap-4 rise">
  <div>
    <div className="flex items-center gap-2 mb-3">
      <span className="inline-block w-8 h-[3px] bg-[#E10600]" />
      <span className="f-mono text-[11px] tracking-[0.3em] text-zinc-500">2026 SEASON · {count} ITEMS</span>
    </div>
    <h1 className="f-cond font-black tracking-tight leading-[0.82]"
      style={{ fontSize: "clamp(44px,6.5vw,80px)" }}>
      <span className="block text-white">PRIMARY</span>
      <span className="block text-transparent bg-clip-text"
        style={{ backgroundImage: "linear-gradient(90deg,#E10600,#ff5a3c)" }}>SECONDARY</span>
    </h1>
  </div>
</div>
```

---

## 11. Styling: Card Pattern

Cards use `chamfer` clip + team/brand color as border/glow on hover:

```tsx
const col = item.colorHex || "#666";

<div className="group relative rise" style={{ animationDelay: `${idx * 60}ms` }}
  onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
  {/* glow layer */}
  <div className="absolute inset-0 rounded-2xl transition-opacity duration-500 pointer-events-none"
    style={{ opacity: hov ? 1 : 0, boxShadow: `0 0 44px ${col}22` }} />
  {/* card */}
  <div className="relative border rounded-2xl overflow-hidden transition-all duration-300 chamfer"
    style={{
      borderColor: hov ? `${col}40` : "rgba(255,255,255,.06)",
      transform: hov ? "translateY(-3px)" : "none",
      background: "rgba(18,18,21,.78)",
    }}>
    {/* team color stripe at top */}
    <div className="h-1 w-full"
      style={{ background: col, boxShadow: hov ? `0 0 16px ${col}` : "none" }} />
    <div className="relative z-10 p-6">
      {/* card content */}
    </div>
  </div>
</div>
```

**`chamfer` cut sizes:** 14px (drivers), 16px (teams/circuits). Both defined in the `<style>` block.

---

## 12. `useCountUp` Hook

Used on every stats page to animate numbers on mount. Copy verbatim:

```ts
function useCountUp(target: number, delay = 0) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!target) return;
    let raf = 0;
    const t = setTimeout(() => {
      let s: number | null = null;
      const step = (ts: number) => {
        if (!s) s = ts;
        const p = Math.min((ts - s) / 800, 1);
        setV(Math.round((1 - Math.pow(1 - p, 3)) * target));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, [target, delay]);
  return v;
}

// Usage — stagger by card index:
const wins = useCountUp(driver.careerWins, idx * 40);
const pts  = useCountUp(driver.careerPoints, idx * 40 + 200);
```

---

## 13. Loading State

Use `SkeletonCard` while data is fetching:

```tsx
import { SkeletonCard } from "../components/LoadingSkeleton";

{loading ? (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
  </div>
) : (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {items.map((item, i) => <ItemCard key={item.id} item={item} idx={i} />)}
  </div>
)}
```

---

## 14. localStorage Keys Reference

| Key | Value | Set by |
|---|---|---|
| `pitwall_access` | JWT access token | `setTokens()` |
| `pitwall_refresh` | JWT refresh token | `setTokens()` |
| `pitwall_username` | username string | `login()` / `register()` |
| `pitwall_role` | `"ADMIN"` / `"ENGINEER"` / `"VIEWER"` | `login()` / `register()` |
| `pitwall_avatar` | avatar URL | `AuthContext.fetchUserWithRetry` |
| `pitwall_displayname` | display name | `AuthContext.fetchUserWithRetry` |

`clearTokens()` removes all six keys and clears the `pitwall_session` cookie.

---

## 15. Adding a New Authenticated Page — Checklist

1. Create `src/app/<route>/page.tsx` with `"use client";`
2. Paste the page shell from §9; set `background: "#0a0a0c"` on root div
3. Add route guard in `useEffect`: `if (!getAccessToken()) { router.push("/login"); return; }`
4. Fetch data with `authFetch(\`${API}/api/...\`)` in the same `useEffect`
5. Use `useState(true)` for `loading` — flip to `false` in `.finally()`
6. Render `<SkeletonCard>` grid while loading, real cards after
7. Apply `rise` class + `animationDelay` for stagger on list items
8. If cards show stats that change, use `useCountUp` with `idx * N` delay offsets
9. Backend path must be registered in `SecurityConfig` — check role requirement (see [[springboot-f1-pitwall-patterns]])

---

## Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:8080       # Spring Boot backend
NEXT_PUBLIC_SUPABASE_URL=...                    # For avatar upload (profile page only)
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```
