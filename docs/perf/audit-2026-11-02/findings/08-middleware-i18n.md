# 08 — Middleware/Proxy & i18n Request Path

> Subagent auditor #8, 2026-11-02. Domain: apps/web src/proxy.ts, src/lib/supabase/proxy.ts, i18n request path, [locale]/layout.tsx auth chain. Coordinator spot-check: `proxy.ts` unconditional `getUser()` (line 57) verified verbatim. SDK versions verified against package.json: next 16.4.1, next-intl 4.14.7, @supabase/ssr 0.12.7, @supabase/supabase-js 2.118.0.

## Findings

### [MID-1] Proxy calls `supabase.auth.getUser()` — a Supabase Auth network roundtrip on every matched request for any session-carrying user

- **P1 · Impact H** — All routes are dynamic, so this runs on every page request, every RSC prefetch, every Server Action pass. It is *not* a cookie-only refresh: `getUser()` issues `GET {supabaseUrl}/user` whenever a session cookie exists. Verified in the installed SDK: `node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:2714` — `_request(this.fetch, 'GET',`${this.url}/user`, ...)`. Only cookie-less (anonymous) requests short-circuit locally (GoTrueClient.js:2712-2713, returns `AuthSessionMissingError` with no fetch).
- **Evidence:** `apps/web/src/lib/supabase/proxy.ts:57` — `const { data: { user } } = await supabase.auth.getUser();` — unconditional, before any route-protection check.
- **Current:** every authenticated request pays a Supabase Auth HTTP roundtrip inside the proxy (part of the measured 0.81s cold render).
- **Fix:** Switch the proxy to `supabase.auth.getClaims()` (available in the installed `@supabase/supabase-js@2.118.0`): verifies the JWT locally against the cached JWKS from `/auth/v1/.well-known/jwks.json` — one fetch, then zero network per request. The proxy only uses `user.app_metadata.show_extra_assets` (proxy.ts:72) and `user.app_metadata.role` (proxy.ts:94), both present in claims. Caveat: requires asymmetric JWT signing keys on the Supabase project; with a legacy HS256 secret `getClaims()` falls back to the same network call. **Effort M**

### [MID-2] Duplicate auth roundtrips per render: proxy getUser + `[locale]/layout` getUser + nested-layout revalidation run sequentially

- **P1 · Impact H** — For an authenticated page render: (1) proxy `getUser` (proxy.ts:57), (2) `[locale]/layout.tsx` calls `createClient()` then `supabase.auth.getUser()` again — a second `/user` roundtrip, (3) admin pages add a third: `admin-dashboard/layout.tsx` calls `getUser` again *and* re-queries the `admins` table even though the proxy already validated the role.
- **Evidence:** `apps/web/src/app/[locale]/layout.tsx:93-96` — `const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();` (not wrapped in `cache()`). `apps/web/src/app/[locale]/admin-dashboard/layout.tsx:21-34` — repeat `getUser()` + unconditional `supabase.from("admins").select("role")...maybeSingle()`, duplicating the proxy's check at `apps/web/src/lib/supabase/proxy.ts:99-103`.
- **Current:** 2 sequential auth roundtrips before any HTML for normal pages, 3 + 2 DB queries for admin pages. Also `getMessages()` (layout.tsx:91) and the `getUser` chain (lines 93-96) are independent and awaited sequentially.
- **Fix (minimal):** (a) export one `getCachedUser()` = `cache(async () => (await createClient()).auth.getUser())` and use it in all server layouts so a render pass dedupes; (b) for admin routes, trust the proxy's app_metadata role check and drop the always-on `admins` query in the nested layout (keep the proxy fallback); (c) `const [messages, { user }] = await Promise.all([getMessages(...), getCachedUser()])`. A per-request cache cannot span proxy→RSC (separate runtime), so reducing call count is the lever, not cross-runtime dedupe. **Effort S–M**

### [MID-3] `fs`-based namespace fallback is statically reachable in production → whole-project file tracing (the build warning), amplified by `output: "standalone"`

- **P1 · Impact H** — The build warning's import trace (`src/i18n/request.ts → next-intl getConfig → [locale]/downloads/page.tsx`) is caused by `readFile` from `fs/promises` fed a dynamic `path.join(process.cwd(), ...)`. The tracer cannot resolve it, so the entire project is traced into the output — and with `output: "standalone"` (next.config.mjs:25) that inflates the standalone bundle and cold-start working set, not just build time.
- **Evidence:** `apps/web/src/i18n/request.ts:4` (`import { readFile } from "fs/promises"`), `:121-125` (`path.join(process.cwd(), ...)` candidates), `:177` — the disk read is invoked in the prod catch-fallback of `safeImportNamespace` (not dev-only), so it can't be dead-code-eliminated.
- **Current:** `import()` loaders at request.ts:14-113 are fully static and self-tracing; the disk path exists only for dev HMR and a rare prod-failure fallback.
- **Fix:** Move `readNamespaceFromDisk` into a sibling module imported dynamically *only* inside the `process.env.NODE_ENV === "development"` branch (`await import("./i18n/messages-disk")`) and remove the prod catch-fallback disk read (a bundled `import()` of JSON cannot realistically fail; keep the English-fallback recursion). Next replaces `NODE_ENV` at build time, so the fs code disappears from the prod graph and the warning clears. **Effort S**

### [MID-4] Every request eagerly loads all ~47 namespaces (first-request warmup; steady state is cached)

- **P2 · Impact M** — `getRequestConfig` maps all loaders through `Promise.all` on every request. Steady state is cheap (`namespaceCache` prod path, request.ts:147-149, 169), but a cold server instance's first request per locale pays 47 dynamic module loads + JSON parses — part of the measured 0.81s. The provider-serialization cost of shipping all of it via `NextIntlClientProvider messages={messages}` (layout.tsx:126-130, ~75KB en / ~180KB ar) is covered by SPLIT-5.
- **Evidence:** `apps/web/src/i18n/request.ts:207-218` — "LOAD ALL NAMESPACES for the locale" comment + `Promise.all(allNamespaces.map(...))`.
- **Fix (request-path scope only):** keep the all-namespace contract but warm both locales' caches at server boot (module-level `Promise.all` fire-and-forget over `MESSAGE_LOADERS` keys) so the first user request hits warm cache. **Effort S**

### [MID-5] Matcher misses root-level non-HTML assets: `llms.txt` and the Google verification HTML get locale-redirected

- **P2 · Impact M** — The proxy's own comment documents that next-intl locale-redirects any non-excluded path (`sw.js` case, proxy.ts:263-266). `/llms.txt` and `/googlec58e80c40bab6a9f.html` in `public/` are not in the matcher exclusions, so crawlers requesting them get a 307 to `/ar/...` → breaks Search Console verification and llms.txt discovery, and each wasted attempt also runs `updateSession` (an auth roundtrip when cookies are present).
- **Evidence:** `apps/web/src/proxy.ts:276` matcher excludes only `api|_next/static|_next/image|favicon.ico|manifest.json|robots.txt|sitemap.xml|animations|sw\.js|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|wasm)$`; files confirmed present at `apps/web/public/`: `llms.txt`, `googlec58e80c40bab6a9f.html`, `sw.template.js`. (`/animations/ai-robo.lottie` is safe — covered by the `animations` prefix exclusion.)
- **Fix:** Add to the matcher's negative lookahead: `llms\.txt|googlec58e80c40bab6a9f\.html` (or `\.(?:txt|html|lottie)$` for root files). **Effort S**

### [MID-6] Dead `requestHeaders` clone allocated on every request

- **P2 · Impact L** — Lines 172-174 build and mutate a `Headers` clone that is never consumed: `updateSession(request)` receives the original request, and the downstream forward uses a separate `forwardedHeaders` clone (line 206). One wasted allocation + misleading code on the hot path.
- **Evidence:** `apps/web/src/proxy.ts:172-174` vs. `:176` (`updateSession(request)`) and `:206-214` (`forwardedHeaders`).
- **Fix:** Delete lines 172-174. **Effort S**

### [MID-7] Locale-redirect requests still pay the proxy auth roundtrip before being discarded

- **P2 · Impact M** — `updateSession` (network `getUser`) runs before `intlMiddleware` decides to redirect (e.g. `/` → `/ar`, stale links without prefix). The render is thrown away; the follow-up prefixed request repeats everything. Cookie-refresh-on-redirect is the only reason to run it first, and the follow-up request refreshes anyway.
- **Evidence:** `apps/web/src/proxy.ts:176-186` — `await updateSession(request)` precedes the `isRedirectResponse(intlResponse)` branch.
- **Fix:** Run `intlMiddleware` first; on a redirect response, skip `updateSession` (keep appending its cookies only when one already ran) and let the redirected request own session refresh. **Effort S**

## Healthy areas

- **Nonce/CSP generation** (proxy.ts:23-27, 59-136): `crypto.getRandomValues` over 16 bytes plus string joins — microseconds; nothing per-request worth skipping. The error-path nonce forwarding (proxy.ts:238-255) is correct per prior audit M1.
- **Anonymous traffic:** with no session cookies, proxy `getUser()` and layout `getUser()` short-circuit with zero network calls (verified GoTrueClient.js:2712-2713), so public/first-visit renders don't pay auth roundtrips.
- **Matcher core exclusions** (proxy.ts:276): `/_next/static`, `_next/image`, `/api`, image extensions, `sw.js`, `.wasm` — no leak-through of framework or API paths.
- **Route-protection fallbacks** (proxy.ts:72-85, 94-108): DB fallback queries fire only when `app_metadata` is missing — steady state adds no queries in the proxy.
- **`getProfile` is React-`cache()`d** (layout.tsx:33-71) — dedupes within a render pass; profile fetch is correctly sequential after `getUser` (needs `user.id`, no parallelization possible there).
- **next-intl request config is per-request cached**: `getMessages` is wrapped in React `cache()` internally (`next-intl/dist/esm/development/server/react-server/getMessages.js:14`), so multiple `getTranslations` calls in one render load messages once.
- **Cross-request message cache** (request.ts:116, 147-149, 169): prod path is a Map hit; dev-only disk reads are HMR-correct.
- **Set-Cookie safety** (proxy.ts:160-164, 183, 199-225): per-cookie `getSetCookie()` append avoids the chunked-cookie collapse (audit H1) and post-refresh cookie re-forwarding addresses audit H2 — no regression introduced here.

## Notes

- With all routes dynamic, proxy.ts runs on every request, so MID-1/MID-2 roundtrips multiply across RSC prefetches and Server Action passes — likely the largest slice of the 0.81s cold render after middleware itself.
- The proxy→layout `getUser` calls cannot share a React cache (different runtimes); the highest-leverage single change is MID-1 (`getClaims()` local verification), which removes the network cost from the proxy path regardless of call count.
- MID-3's fix also shrinks the standalone Electron server bundle (`output: "standalone"`, next.config.mjs:25), which matters for desktop packaging, not just Vercel.
