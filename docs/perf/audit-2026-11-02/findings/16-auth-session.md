# 16 — Auth, Session & Background-Network Chatter (client runtime)

> Subagent auditor #16, 2026-11-02. Domain: client-side auth runtime — AuthContext, /api/auth/sync flow, realtime channels, timers/pings, rate-limit lib. Proxy/layout server-side auth covered by auditor #8 (MID). RENDER-1 (context churn) covered by auditor #3.

## Findings

### [AUTH-1] Every useNotifications mount pays 2 real network roundtrips to `/auth/v1/user` even on cache hits

- **P1 · Impact H** — `supabase.auth.getUser()` is a server roundtrip (unlike `getSession()` which reads local storage). Each hook instance calls it **twice** per mount, and the first call happens *before* the 1-min cache check, so cached notifications still cost 2 auth roundtrips. AuthContext already holds `user` from server props (`AppProviders.tsx:28-32`).
- Evidence: `apps/web/src/hooks/useNotifications.ts:29-31` (`const { data: { user } } = await supabase.auth.getUser()` inside `fetchNotifications`, run on mount at `:257-259`, before the cache check at `:38-46`), and again in the realtime setup at `:272-274`. Contrast: `apps/web/src/contexts/AuthContext.tsx:127-129` correctly uses `getSession()`.
- Current · Fix · Effort: 2 × auth HTTP + WS join per instance per mount · Read the user from `useAuth()` (or capture `session.user.id` from `getSession()`), pass it down, and move the cache check before any auth call · S (≡ LANDING-4 — one fix.)

### [AUTH-2] Duplicate per-instance realtime channels and fetches — same `notifications:${user.id}` topic joined N times

- **P1 · Impact M** — Three consumers each instantiate the hook: `news/page.tsx:37`, `components/AppealFormModal.tsx:27`, `hooks/useAppeals.ts:14` (used in `admin-dashboard/page.tsx` + `AppealFormModal` → 2 concurrent instances on the admin dashboard). Each creates its own channel (`useNotifications.ts:281`) and runs its own `fetchNotifications`, so admin pages join 2–3 identical channels and deliver 2–3 duplicate INSERT events per notification.
- Current · Fix · Effort: duplicate WS joins + duplicate event handling · Hoist the channel to a module-level/singleton provider (or dedupe by topic in a shared helper; the `inflightRequests` map at `:9,49-55` already shows the dedup pattern) · M

### [AUTH-3] `/api/auth/sync` re-does the profile fetch the server layout just did — 2 profile fetches + 3 auth roundtrips per page load

- **P1 · Impact H** — Server layout already did `getUser()` + `getProfile(user.id)` (`apps/web/src/app/[locale]/layout.tsx:96-102`) and passed the result as `initialProfile` (`AppProviders.tsx:29-30`). The client then fires `POST /api/auth/sync` on every logged-in load (forced via the recovery `SIGNED_IN` path, `AuthContext.tsx:186-188`; also `:137-138`), whose handler re-runs `getUser()` (`actions/auth.ts:24`) + `profiles` select (`:40-44`). The sync result is never used by the client — `triggerSync` discards the body and profile state is only updated "via layout revalidation" (`AuthContext.tsx:168`). Bootstrap total (logged-in, cold cache, /news): **7 HTTP + 2 WS joins** (sync, active_ping, platform_settings select, getUser ×2, notifications select, 2 WS); warm cache: 4 HTTP + 2 WS.
- Current · Fix · Effort: redundant auth+profile roundtrips every load · Skip the client call when `initialProfile` was provided (only force on genuine `SIGNED_IN`, i.e. after `sawInitialSessionRef` is set — which is already the exact signal distinguishing recovery from real sign-in), keeping the sync for first-login/profile-creation only · S–M

### [AUTH-4] `revalidatePath('/', 'layout')` runs on every successful sync, even when nothing was written

- **P2 · Impact M** — On the happy path (profile exists, nothing to fill), the route still invalidates the entire root layout cache on every page load.
- Evidence: `apps/web/src/actions/auth.ts:86` (`revalidatePath('/', 'layout');` is outside both the insert branch `:62-69` and the conditional-update branch `:77-84`). (Cross-ref QUERY-6.)
- Current · Fix · Effort: unnecessary cache invalidation per load · Move inside the `Object.keys(updates).length > 0` / insert branches · S

### [AUTH-5] `rateLimitStore` in-memory Map grows unboundedly for users never seen again

- **P2 · Impact L** — Pruning happens only on access (`getLocalWindow` deletes the key when the pruned window is empty, `rate-limit.ts:126-133`); a user who sends one AI-chat request and never returns leaves a `rate_limit:ai_chat:<userId>` entry (key string + ≤10 timestamps) forever. Growth is proportional to distinct user IDs — slow, authenticated-only leak. (Counter-check: `lastStoreErrorLogAt` is bounded — 3 scope strings, `:95-105` — fine.)
- Current · Fix · Effort: slow per-instance memory leak · Add a periodic sweep or cap the Map size (evict oldest) · S

### [AUTH-6] PlatformSettings realtime subscribes at mount regardless of cache state

- **P2 · Impact L** — The realtime effect runs immediately and unconditionally (`PlatformSettingsContext.tsx:241` `setupRealtime()` with no dependency on `fetchSettings`), in parallel with the mount fetch (`:173-175`) which may be a localStorage/cache hit (24h TTL, `queryCache.ts` cacheTTL.settings). So every visitor — including anonymous bounce traffic — opens a persistent realtime WS for a value they may already have. Low value to change (logged-in tabs need the WS anyway), but the join precedes the cache read.
- Current · Fix · Effort: 1 WS join per tab from first paint · Optionally defer `setupRealtime()` until after the first fetch resolves · S

### [AUTH-7] useNotifications realtime setup promise shared across mounts → channel unsubscribed out from under the surviving mount (dev StrictMode)

- **P2 · Impact L** — First mount's cleanup subscribes `channelPromise.then(unsubscribe)` (`useNotifications.ts:335-343`) but never clears `realtimeSetupPromiseRef`; a fast remount (React StrictMode dev double-invoke) returns the *same* pending promise (`:266-268`), adopts its channel, and then the first cleanup unsubscribes it → notifications realtime silently dead. Prod fast unmount/remount races are theoretically possible too.
- Current · Fix · Effort: dev-only dead subscription · Clear `realtimeSetupPromiseRef` in cleanup, or ref-count subscribers before unsubscribing · S

### [AUTH-8] Unauthenticated `/api/auth/sync` returns 500 (not 401) with no rate limiting, costing a server auth roundtrip per hit

- **P2 · Impact L** — The route delegates straight to `syncUserProfile()`; an anon POST pays `getUser()` against Supabase before returning "Not authenticated" as a 500 (`actions/auth.ts:24-34` → `route.ts:29-42`). The rate-limit lib exists but is only wired for AI chat (`rate-limit.ts:376`).
- Current · Fix · Effort: free unauthenticated chatter + wrong status code · Early 401 on missing session in the route (before calling the action); optionally apply the existing lib · S

## Healthy areas

- **Metrics ping**: exactly one `POST /api/metrics/event` per app load, `keepalive`, fire-and-forget, double-send guarded by `activePingSent` ref (`AuthContext.tsx:71,139-142,190-193`; `metrics-client.ts:20-27`); `user_login` correctly not fabricated on session recovery via `sawInitialSessionRef` (`:182-184,198`) — the phantom-login fix works.
- **No hidden timers/retry loops**: the 10s `SYNC_COOLDOWN` (`AuthContext.tsx:63,75-77`) gates only same-load duplicate triggers (recovery-SIGNED_IN forced sync vs `getSession` sync — `syncInProgress` + cooldown dedupe them to 1 POST per load); nothing retries a failed sync in the background. Only timer found in the domain is the Navigator-LockManager resubscribe retry (`useNotifications.ts:311`).
- **Per-navigation cost is bounded**: AuthProvider/PlatformSettingsProvider/QueryProvider live in the persistent `[locale]` layout — no re-bootstrap on client navigation; `/api/auth/sync` runs once per full page load only. TanStack defaults are sane (staleTime 5m, gcTime 30m, retry 1, `QueryProvider.tsx:10-26`); `queryCache` prunes expired entries on access, including localStorage copies (`queryCache.ts:38-84`).
- **Subscription hygiene**: AuthContext unsubscribes on cleanup with `mounted` flag (`AuthContext.tsx:214-217`); PlatformSettings removes its channel with a random-suffix name to avoid topic collisions (`PlatformSettingsContext.tsx:198,243-249`); desktop deep-link handler dedupes codes and unsubscribes the bridge listener (`:231,243-244,256-258`); `SIGNED_OUT` clears role-scoped caches (`:174-180`).
- **Rate limiter remote path**: single batched Upstash pipeline per op with 5s timeout and documented fail-open (`rate-limit.ts:48,248-263`); Supabase backend demotes permanently on structural errors (`:337,355-361`).

## Notes

- Scope question "does AuthContext re-fetch profile that layout already fetched and passed as prop?" — **verified yes indirectly**: AuthContext itself never fetches profile, but the `/api/auth/sync` POST it triggers re-fetches it server-side (AUTH-3); the client discards the response.
- `syncUserProfile` per-call cost: 1 Supabase auth roundtrip + 1 `profiles` select + at most 1 update/insert + `revalidatePath` (`actions/auth.ts:24,40-44,62-84,86`).
- Duplicate-channel behavior of supabase-js with identical topic names is observed as N joins/events; server-side dedup behavior per SDK version not verified.
- ~14 files read (within cap).
