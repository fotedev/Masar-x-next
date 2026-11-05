# 10 — PWA Service Worker & HTTP Caching Strategy

> Subagent auditor #10, 2026-11-02. Domain: apps/web sw.template.js, cache headers, SW lifecycle. Coordinator cross-check: measured prod headers (HTML no-store, wasm immutable+MIME) reconcile with the config sources read here.

## Findings

### [CACHE-1] SW offline fallback is dead code — offline navigation resolves to nothing

- **P1 · Impact M** — The navigation handler claims a cache fallback, but nothing ever writes navigations (or `/`) into the cache, so an offline user gets a raw browser error page instead of any fallback. The PWA has no offline story despite the code implying one.
- **Evidence:** `apps/web/public/sw.template.js:76-80` — `fetch(request).catch(() => caches.match(request).then((r) => r || caches.match("/")))`. Branch 1 (navigate, lines 74-82) never calls `cache.put`; branch 3 (lines 106-125) never sees `mode === "navigate"` requests, so `caches.match(request)` and `caches.match("/")` can never hit. Install comment confirms precaching was removed (`sw.template.js:21-22`). No offline route exists anywhere in `apps/web/src/app` (glob for `*offline*` returns nothing).
- **Current** · **Fix:** precache a minimal `/offline` page at install (`caches.open(CACHE_NAME).then(c => c.add("/offline"))`) and serve it in the navigate catch; or cache the last successful navigation HTML. · **Effort S** (note: under MVP Lock this is a feature addition — owner sign-off needed).

### [CACHE-2] Per-deploy commit-SHA cache name purges the entire SW cache on every deploy

- **P2 · Impact M** — Every deploy renames `CACHE_NAME` to the commit SHA, and activate deletes every other cache, forcing repeat users to rebuild the full SW cache. Mitigation exists: `/_next/static/*` URLs are content-hashed and HTTP-immutable, so unchanged chunks are usually re-served from the browser HTTP cache rather than re-downloaded — the real cost is SW-cache rebuild plus re-download only for HTTP-cache-evicted entries. Still, the SHA is doing two jobs (SW byte-change detection + total purge) when only the first is necessary.
- **Evidence:** `apps/web/public/sw.template.js:11` (`const CACHE_NAME = "__BUILD_ID__"`), `apps/web/scripts/inject-sw-version.mjs:29-35` (build id = `VERCEL_GIT_COMMIT_SHA`/`GITHUB_SHA` slice), `apps/web/public/sw.template.js:37-45` (activate deletes all caches `key !== CACHE_NAME`).
- **Current** · **Fix:** keep `CACHE_NAME` stable (e.g. `masarx-static-v1`) — stale hashed entries are harmless and self-limiting — while still injecting the SHA into a separate constant in sw.js so the byte-change → install/activate update cycle is preserved; optionally trim oversize caches. · **Effort S.**

### [CACHE-3] HTML must stay uncached — s-maxage/SWR on HTML would break the per-request CSP nonce chain (and is moot anyway due to Set-Cookie)

- **P2 · Impact M (verdict finding)** — Verified the full nonce chain: `src/proxy.ts:168` generates a nonce per request, writes it into the CSP response header (`src/proxy.ts:142`), forwards it as `x-nonce` into the render request (`src/proxy.ts:174`, `:208`), and it is consumed in `src/app/layout.tsx:112` (`headers().get("x-nonce")`) and applied to the inline ThemeScript (`src/components/ThemeScript.tsx:26`). Because the nonce is embedded **in the HTML body**, an edge-cached HTML response would either (a) replay one nonce to all users in the cache window — CSP3 nonces must be per-response, so reuse weakens the guarantee, and if any layer regenerated only the header the cached inline scripts would be blocked outright — or (b) skip middleware on hits, losing `updateSession` cookie rotation (`src/proxy.ts:176`, Set-Cookie appended at `:225`) and `intlMiddleware` locale negotiation (`src/proxy.ts:177`). Additionally these HTML responses carry Set-Cookie, which Vercel does not shared-cache, so `s-maxage` on HTML would mostly no-op for authenticated traffic and be a footgun for anon traffic. Keep HTML `no-store`; repeat-visit TTFB paying full server render is the accepted cost.
- **Evidence:** paths above; HTML header source `apps/web/next.config.mjs:159-170`.
- **Current** · **Fix (optional micro-win):** change HTML `Cache-Control` from `no-cache, no-store, must-revalidate` to `no-cache` so ETag/304 revalidation can cut repeat-visit HTML bytes (does not reduce TTFB compute; nonce/SWR conclusions unchanged). · **Effort S.**

### [CACHE-4] RSC payload fetches fall into the SW's catch-all branch and get cached per deploy

- **P2 · Impact L** — Client-router navigations (RSC `GET`s with `RSC: 1`) are not `mode === "navigate"`, so they hit branch 3 ("everything else": network-first + `cache.put` when ok). Online behavior is correct (network-first), and the payload cache only serves offline — but entries are wiped on every deploy by CACHE-2 and correctness leans on `Vary` handling in `caches.match`.
- **Evidence:** `apps/web/public/sw.template.js:105-113` (catch-all network-first + put); only branch 1 checks `request.mode === "navigate"` (`:75`).
- **Current** · **Fix:** optionally skip caching requests with `RSC`/`Next-Router-State-Tree` headers for hygiene, or leave as-is (harmless). · **Effort S.**

### [CACHE-5] Header authority is split across three files with contradictory values

- **P2 · Impact L** — `X-Frame-Options` is `DENY` in `apps/web/vercel.json:16`, `SAMEORIGIN` in `apps/web/next.config.mjs:198`, and `DENY` again in `src/proxy.ts:146`; the wasm rule is duplicated too (`vercel.json:39-47` Content-Type only vs `next.config.mjs:182-191` Content-Type + immutable). Measured prod output is currently correct (merged/most-specific wins), but the drift is a maintenance trap: a future edit to one file can silently lose to another.
- **Evidence:** paths above.
- **Current** · **Fix:** consolidate header definitions in one layer (next.config.mjs, since it also serves the desktop standalone server) and reduce vercel.json to what Vercel-only needs. · **Effort S.**

## Healthy areas

- **/sw.js freshness:** `no-cache, no-store, must-revalidate` + Pragma/Expires (`next.config.mjs:144-154`, matches measured prod) combined with the SHA-injected byte change guarantees the browser re-fetches and reinstalls the SW each deploy — the update-detection half of CACHE-2 is sound.
- **dotlottie wasm:** immutable 1-year + `application/wasm` MIME (`next.config.mjs:182-191`), keeping `WebAssembly.instantiateStreaming` on the fast, CSP-friendly path (comment at `:173-181` documents why).
- **SW skips session-bearing traffic:** `/api/*`, `supabase`, `puter.com` bypassed (`sw.template.js:63-72`); non-GET bypassed (`:63`) — no auth tokens or mutations ever touch the cache.
- **`/_next/static` cache-first** with ok-only puts and 504 on total failure (`sw.template.js:85-103`) — correct for content-hashed immutable chunks.
- **Registration hygiene:** prod-only, `load`-deferred, non-throwing (`src/lib/sw-register.ts:17-27`); registered for all users via the NotificationProvider mount effect (`src/components/notifications/NotificationProvider.tsx:63-69`), not gated on notification permission.
- **SW registration survives the proxy:** `sw.js` (and wasm) excluded from the middleware matcher so next-intl can't locale-redirect the SW script (`src/proxy.ts:261-276`) — matches the SW spec's no-redirect rule for worker scripts.
- **Server-side caching:** no `unstable_cache`/`revalidate` misuse in apps/web/src; the only deliberate revalidates are `next: { revalidate: 3600 }` on GitHub release fetches (`src/lib/github-releases.ts:69`, `:95`) — appropriate for third-party metadata.
- **Cache lifecycle:** activate deletes all prior-version caches and `clients.claim()`s (`sw.template.js:35-48`) — no multi-version cache leak.

## Notes

- **Q1 (SHA purge):** answer in CACHE-2 — the SHA is needed for SW byte-change detection but not for the cache-name purge; a stable cache name + SHA elsewhere in the file achieves finer purge semantics at Effort S.
- **Q3 (RSC payloads):** not HTTP-cached (HTML `no-store` covers them server-side; the browser fetch is a plain GET that the SW caches per CACHE-4). Acceptable.
- **Q4 (uncached cacheables):** `masarx-shared` message JSONs are statically imported at build time (`src/i18n/request.ts`, `MESSAGE_LOADERS` via `import("masarx-shared/messages/ar/...")`), so they compile into `/_next/static` chunks already covered by cache-first + immutable HTTP — nothing to add. Public files (icons, `ai-robo.lottie`, logos) are **not** content-hashed, so Vercel's ETag/304 default plus SW network-first is the right ceiling; marking them immutable would risk staleness. `/api` GET routes are intentionally dynamic; `ai-chat` sets `no-cache, no-transform` correctly (`src/app/api/ai-chat/route.ts:128`).
- **Q5 (offline fallback):** does not exist — see CACHE-1.
- Measured headers (HTML no-store, wasm immutable+MIME, `/assets` immutable) all reconcile with the config sources read here; no discrepancy found between prod behavior and code.
