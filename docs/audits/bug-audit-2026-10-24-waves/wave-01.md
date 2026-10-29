# Wave 1 — Auth & session (agents 1–3)

> Regenerated 2026-10-28 from the orchestrator's session record (original destroyed with masarx-plan). Content-faithful; wave order = agent order.

## Agent 1 — Web auth flows

**1. SEV: Medium — Admin roster readable by any authenticated user via user-writable `user_metadata.role` in the `admins` RLS policy**
- LOC: `supabase/migrations/002_core_identity.sql:42-49` (verified: no later migration touches this policy — 010/011/015–017 don't)
- MECHANISM: The `admins` SELECT policy passes if `auth.users.raw_user_meta_data->>'role' = 'admin'`. `raw_user_meta_data` is user-writable by design via `supabase.auth.updateUser({ data: { role: 'admin' } })`. The predicate is row-independent (no reference to the candidate row), so a true predicate exposes ALL rows.
- SCENARIO: Any logged-in user runs two browser calls: `updateUser({data:{role:'admin'}})`, then `from('admins').select('*')` → full admin roster (user_ids, roles, notes, granted_by, granted_at). Not privilege escalation: dashboard/middleware fallback queries filter `.eq('user_id', user.id)` (`apps/web/src/app/[locale]/admin-dashboard/layout.tsx:28-34`, `apps/web/src/lib/supabase/proxy.ts:104-109`), and no real row exists for the attacker, so they still get redirected; JWT role (`app_metadata`) is service-controlled (002 trigger) and unaffected.
- TRACE: Entry: attacker session (browser) → Handler: `supabase.auth.updateUser` writes `raw_user_meta_data.role` (Supabase Auth, user-writable) → DB: RLS policy `002_core_identity.sql:42-49` predicate true → `SELECT *` on `public.admins` returns all rows.
- FIX: Replace the `raw_user_meta_data->>'role'` branch with `EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())` only.
- CONF: high | STATUS: NEW

**2. SEV: Medium — Custom recovery email links (`?token=`) are dead on the web reset page**
- LOC: `apps/web/src/app/[locale]/reset-password/page.tsx:32-40,65` vs `supabase/functions/request-password-reset/index.ts:31`
- MECHANISM: The Brevo email link is `${FRONTEND_URL}/reset-password?token=<nanoid32>`; the web page reads only `code` + `type=recovery` (PKCE), shows `invalidLinkError` and bounces to login after 3s. Only the native `resetPasswordForEmail` path (login page:160-162) is compatible with the page.
- SCENARIO: A mobile-app user requesting recovery clicks the email link → lands on web → "invalid link" → recovery UX broken (native forgot-password on web login still works as a fallback, hence not High).
- TRACE: Entry: email link → Handler: `ResetPasswordContent` useEffect (`page.tsx:32-40`) rejects missing `code` → no exchange, no `POST /functions/v1/reset-password`.
- FIX: Support `token` mode on the page (call the `reset-password` edge function) or change the email template to the native PKCE link.
- CONF: high | STATUS: NEW
- (Related, LOW, CONF low: page requires `type=recovery` in the query (`page.tsx:36`); if Supabase's verify→`redirect_to?code=` redirect doesn't propagate `type`, even valid native recovery links would be rejected — unverifiable without runtime.)

**3. SEV: Low — Login brute-force counter: wrong storage cleared + client-side-only lockout**
- LOC: `apps/web/src/app/[locale]/login/page.tsx:97` (clears `localStorage`) vs `:58,108-111` (counter lives in `sessionStorage`)
- MECHANISM: On successful login the wrong storage is cleared, leaving a stale count in sessionStorage (overwritten on next failure — cosmetic). More substantively, the entire lockout is client-side sessionStorage; trivially bypassed by clearing storage/incognito; 19 attempts are free before any lockout.
- FIX: Rely on Supabase Auth's server-side rate limits; fix the storage mismatch. CONF: high | STATUS: NEW

**4. SEV: Low — Profile sync check-then-insert race across concurrent sessions**
- LOC: `apps/web/src/actions/auth.ts:40-69`; trigger: `apps/web/src/contexts/AuthContext.tsx:178` forces sync on every `SIGNED_IN`
- MECHANISM: `maybeSingle()` select then service-role `insert` is not atomic; two tabs signing in simultaneously both see "no profile" and both insert → one hits PK violation → 500 to that tab (logged only). Availability nit, no data corruption (id is same).
- FIX: Make insert idempotent (`upsert onConflict id` or `on conflict do nothing`). CONF: high | STATUS: NEW

**5. SEV: Low — Login page discards the preserved `next` deep-link**
- LOC: `apps/web/src/app/[locale]/login/page.tsx:38-42` ignores `next`; callback preserves it (`apps/web/src/app/[locale]/auth/callback/route.ts:57-63`)
- MECHANISM: After OAuth-code failure, the user is sent to `/login?next=...` but the page always routes home on sign-in — deep-link intent lost. Functional only; no redirect risk.
- FIX: Honor `next` on the login page using the same validation as the callback. CONF: high | STATUS: NEW

**Clean areas** (no findings): callback `next` open-redirect guards are thorough (rejects non-`/`, `//`, `://`, `/\` — `callback/route.ts:36-44`); PKCE code exchange is single-use and server-side before redirect; all three role consumers read `app_metadata.role` (`AuthContext.tsx:164-165`, `[locale]/layout.tsx:119-120`, `lib/supabase/proxy.ts:99-101`) consistent with migrations 008/012 triggers; `profiles` has no role/status column (002:3-14, 013:19-27) so the client-side academic upsert (`hooks/useUserAcademic.ts:220-241`) can't escalate anything; `updateAvatar` validates and scopes to own id (`actions/profile.ts:22-39`); web reset flow signs out after password change, no fixation (`reset-password/page.tsx:89`); desktop deep-link code exchange re-validates the untrusted IPC URL shape (`AuthContext.tsx:228-235`); `syncUserProfile` and `/api/auth/sync` never leak service-role data and gate on a live session.

---

## Agent 2 — Session/middleware/contexts

**1. SEV: High — Set-Cookie merge via `headers.get('set-cookie')` corrupts multi-cookie responses**
- LOC: `apps/web/src/proxy.ts:172-176, 183-185, 202-208`
- MECHANISM: Edge-runtime `HeadersList.append('set-cookie')` stores all values joined with `", "` in the map and `get()` returns that joined string (verified in `node_modules/next/dist/compiled/@edge-runtime/primitives/fetch.js:11525-11532, 11568-11569`). Re-appending the joined string emits ONE header; browsers parse it as a single cookie and drop the rest. Supabase session refresh writes chunked cookies (`sb-*-auth-token.0/.1` + verifier) via per-cookie `headers.append`.
- SCENARIO: Token refresh coincides with a next-intl redirect or `NEXT_LOCALE` set → chunked session cookies arrive comma-joined in one header → session silently lost → forced re-login / auth flapping.
- TRACE: `proxy.ts:165` updateSession → `lib/supabase/proxy.ts:57` `getUser()` triggers refresh → `setAll` (`lib/supabase/proxy.ts:48-50`) sets N Set-Cookie headers → `proxy.ts:172` `get('set-cookie')` returns comma-joined string → `:174/:185/:208` single `append` → browser receives one corrupt Set-Cookie.
- FIX: Use `response.headers.getSetCookie()` and append each cookie individually.
- CONF: high · STATUS: NEW

**2. SEV: High — Downstream request sees stale (pre-refresh) session cookies**
- LOC: `apps/web/src/proxy.ts:161, 190-194` (clone) vs `lib/supabase/proxy.ts:42-44` (mutation)
- MECHANISM: `requestHeaders` is cloned at line 161 BEFORE `updateSession(request)` (line 165). Inside `setAll`, `request.cookies.set()` updates `request.headers`' cookie header, but the non-redirect path builds `NextResponse.next({ request: { headers: requestHeaders } })` from the stale clone — refreshed cookies reach the browser but NOT the same request's RSC/Server Actions.
- SCENARIO: Access token expired at navigation: middleware refreshes (rotates refresh token X→Y) while downstream `createClient()` (`lib/supabase/server.ts:22-27`) reads expired access token + consumed refresh token X from stale request cookies; ssr client re-attempts refresh with X (server.ts:33-37 swallows cookie-write failure) → `getUser()` fails (logged-out layout render) and, with Supabase refresh-token rotation's reuse detection, can revoke the whole session family — the classic "randomly logged out" signature.
- TRACE: `proxy.ts:161` clone → `lib/supabase/proxy.ts:57` refresh rotates token → `proxy.ts:190-194` stale cookie header forwarded → `[locale]/layout.tsx` `supabase.auth.getUser()` (`lib/supabase/server.ts:22-32`) refreshes again with consumed token → reuse error → user=null render.
- FIX: Rebuild `requestHeaders` from the post-`updateSession` request for the final `NextResponse.next`.
- CONF: medium (mechanism verified; rotation enforcement is Supabase-default) · STATUS: NEW

**3. SEV: Medium — Proxy error fallback CSP nonce mismatch blocks all app JS**
- LOC: `apps/web/src/proxy.ts:222-241`
- MECHANISM: Fallback response is built from original `request.headers` (no `x-nonce`) but CSP is set with a freshly generated `fallbackNonce`. `layout.tsx:112` reads `headers().get('x-nonce')` → undefined → ThemeScript and Next's inline bootstrap scripts render nonce-less → `script-src 'nonce-…'` blocks every inline script on the error path.
- FIX: Forward `requestHeaders` (with the original x-nonce) in the fallback `NextResponse.next` and reuse that nonce.
- CONF: high · STATUS: NEW

**4. SEV: Medium — Supabase auth cookies lack `Secure` (and are JS-readable)**
- LOC: `apps/web/src/lib/supabase/proxy.ts:18-53`, `apps/web/src/lib/supabase/server.ts:17-41`
- MECHANISM: `@supabase/ssr@0.12.7` `DEFAULT_COOKIE_OPTIONS = { path:'/', sameSite:'lax', httpOnly:false }` — no `secure` key anywhere in the package (verified in node_modules). Both server clients forward SDK options unchanged.
- SCENARIO: HTTPS session cookies holding access+refresh JWTs are also sent over any plaintext `http://` request to the same host → network MITM steals tokens.
- FIX: Pass `cookieOptions: { secure: true }` to both `createServerClient` calls (and the shared browser factory).
- CONF: high · STATUS: NEW

**5. SEV: Medium — CSP blocks direct (non-YouTube) video playback**
- LOC: `apps/web/src/proxy.ts:67` (no `media-src`), `apps/web/src/components/subject/lecture-detail/LectureVideoPlayer.tsx:98-105`
- MECHANISM: No `media-src` → `<video>` falls back to `default-src 'self' https://*.youtube.com https://*.googlevideo.com`. The player supports a non-YouTube `<video src>` branch, but URLs on `*.supabase.co` storage or `res.cloudinary.com` are not in that list → playback blocked by CSP.
- FIX: Add `media-src 'self' https://*.supabase.co https://res.cloudinary.com https://*.googlevideo.com https://*.youtube.com`.
- CONF: medium · STATUS: NEW

**6. SEV: Low — Dead auth-resolution guards in useAiChat (undefined never occurs)**
- LOC: `apps/web/src/hooks/useAiChat.ts:72,103,258`; `apps/web/src/contexts/AuthContext.tsx:23,47`
- MECHANISM: `useAiChat(user: User | null | undefined)` guards `user === undefined`, but AuthContext's `user` is typed `User | null` and initialized to `null` — the guards never fire, so guest restore runs while auth is still resolving and can briefly restore guest messages for a signed-in user.
- FIX: Gate on `loading` (or make AuthContext's user tri-state).
- CONF: high (dead code), low impact · STATUS: NEW (adjacent to baseline "is_admin undefined" but distinct site)

**7. SEV: Low — ThemeProvider transiently reverts ThemeScript's dark class**
- LOC: `apps/web/src/contexts/ThemeContext.tsx:35-43` vs `apps/web/src/components/ThemeScript.tsx:50-68`
- MECHANISM: First passive-effect pass runs the DOM effect with stale `theme="light"`/`mounted=false`, unconditionally `classList.remove('dark')` + `colorScheme='light'`, undoing the pre-paint theme initializer; re-render then re-applies dark. Effect should skip DOM writes until `mounted`.
- CONF: medium · STATUS: NEW

**8. SEV: Low — PlatformSettings localStorage-in-initializer hydration mismatch**
- LOC: `apps/web/src/contexts/PlatformSettingsContext.tsx:109-118` (also fallback `:73-81`)
- MECHANISM: `useState(getInitialSemester)` reads `localStorage` during client hydration while SSR rendered `1` — any consumer rendering `defaultSemester` in initial HTML mismatches on hydration.
- FIX: Initialize to 1 and read localStorage in an effect.
- CONF: medium · STATUS: NEW

**9. SEV: Low — Middleware protection gaps for several auth-gated routes**
- LOC: `apps/web/src/lib/supabase/proxy.ts:66-117`, matcher `apps/web/src/proxy.ts:260`
- MECHANISM: Middleware protects only `/non-academic`, `/admin*`, `/profile`, `/quiz-attempts`, `/add-video`, `/add-file`. `/instructor-dashboard`, `/edit-summary`, `/onboarding/*`, `/ai-assistant` rely on client-side `useAuth` gates only. `/api/*` is excluded from the matcher entirely, so no session refresh/protection there. Data exposure depends on RLS — defense-in-depth gap, not a confirmed leak.
- CONF: high (facts), low (impact) · STATUS: NEW

**10. SEV: Low — BOM strip missing on browser-side env vars**
- LOC: `apps/web/src/lib/supabase.ts:8-19`, `apps/web/src/lib/supabase/client.ts:17-18`
- MECHANISM: Server files strip BOM from env vars; the browser singletons don't. A BOM-pasted `NEXT_PUBLIC_*` value breaks every browser client at runtime while server clients work.
- FIX: Run `stripBOM` in the two browser factories.
- CONF: medium · STATUS: NEW

**Clean areas**: `lib/supabase/admin.ts` (server-only import, persistSession:false, BOM-stripped); instrumentation stubs clean; ThemeScript I7-compliant; shared factory service-role JWT guard sound; updateSession route-protection logic itself sound — bugs are in the surrounding proxy merge/staleness.

---

## Agent 3 — Edge auth/upload functions

**1. SEV: High — auth-hook-email has zero caller verification (open email relay via Brevo)**
- LOC: supabase/functions/auth-hook-email/index.ts:11-27, 156-172
- MECHANISM: The function reads `user.email`/`email_data` from the request body and sends email via the server-side Brevo key without checking the Authorization header, a hook JWT, or any shared secret. Platform `verify_jwt` (default true) is satisfied by the public anon key. No check_rate_limit call either.
- SCENARIO: Anyone with the function URL + public anon key POSTs `{user:{email:victim}, email_data:{...}}` and spams/phishes from the project's sender identity; Brevo quota exhaustion. Bonus: in the `default` branch (index.ts:87) `actionUrl = safeRedirectTo` is interpolated into `href="${actionUrl}"` (index.ts:118,141) unencoded — `redirect_to` containing `"` breaks out of the attribute → HTML injection into the sent email.
- TRACE: Entry POST /functions/v1/auth-hook-email → serve handler (index.ts:11) → methodGuard only (index.ts:14) → req.json() → Brevo send with BREVO_API_KEY (index.ts:156-172). No auth hop exists.
- FIX: Verify the GoTrue hook JWT (project secret) before reading the payload; encode/allowlist `redirect_to`.
- CONF: high. STATUS: NEW

**2. SEV: Medium — ai-chat and summarize-chat have no rate limit at the function; proxy-only enforcement is bypassable**
- LOC: ai-chat/index.ts:263-279; summarize-chat/index.ts:40-47
- MECHANISM: Both authenticate correctly (`auth.getUser()` on a token-forwarding client), but neither calls `check_rate_limit`. The limiter lives in the Next.js proxy (apps/web/src/app/api/ai-chat/route.ts:76). Direct calls to `https://<proj>.supabase.co/functions/v1/ai-chat|summarize-chat` with anon key + any valid user JWT skip it entirely.
- SCENARIO: A free account loops direct function calls → unbounded Gemini spend (chat + 50-message summaries per call).
- TRACE: Entry function URL → auth.getUser (ai-chat:270 / summarize-chat:43) → straight to Gemini generateContent. No RPC hop.
- FIX: Add per-user `check_rate_limit` RPC call inside both functions.
- CONF: high. STATUS: NEW

**3. SEV: Medium — `check_rate_limit` RPC absent from active migrations; schema mismatch → silent fail-open on fresh env**
- LOC: supabase/migrations/006_system_and_security.sql:24-30 (table: `key/hits/last_hit`); RPC only in supabase/migrations.old/20251231200000_add_rate_limiting.sql
- MECHANISM: All edge call sites (process-pdf/handler.ts:118, request-password-reset/index.ts:175,253, reset-password/index.ts:39, cloudinary-webhook/index.ts:75) wrap the RPC in try/catch and fail open. A database provisioned from `supabase/migrations/` alone lacks the RPC (and its `identifier/endpoint` table shape), so every rate limit silently disables.
- SCENARIO: Env rebuild from repo migrations → all rate limiting fail-open with only console.warn.
- CONF: high. STATUS: KNOWN-active (adjacent to F13 — call sites verified, drift is the new part)

**4. SEV: Medium — delete-file ownership check lacks the traversal hardening avatar-id.ts enforces**
- LOC: delete-file/index.ts:24 (only check: `publicId.startsWith(\`${user.id}_\`)`); forwarded verbatim to destroy at _shared/cloudinary.ts:57-69
- MECHANISM: Unlike avatar-id.ts:74-90 (single segment, `..`/`\`/control-char/length rejection), delete-file accepts `<uid>_x/../../anything` and nested separators. Cross-user deletion via a foreign id is blocked by the UUID prefix, but a `..`-containing public_id is signed and sent to Cloudinary as-is; if Cloudinary normalizes path segments in public_id, assets outside the caller's prefix could be destroyed.
- TRACE: POST delete-file → withAuthedJson (auth.ts:88) → startsWith check (index.ts:24) → sha1 signature over raw publicId (cloudinary.ts:57) → Cloudinary destroy (cloudinary.ts:68).
- FIX: Reuse `isOwnedAvatarPublicId`-style validation before destroy.
- CONF: medium. STATUS: NEW

**5. SEV: Low — reset-password single-use enforcement is non-atomic and update happens before mark-used**
- LOC: reset-password/index.ts:72 (used_at check) → :119-132 (password update) → :135-138 (mark used, `.eq("token_hash")` with no `.is("used_at", null)` guard); failure only warn-logged at :141
- MECHANISM: Two concurrent requests with the same token both pass the used_at check and both reset. If marking fails, the token stays replayable up to its 24h expiry. Impact confined to the token holder. Token itself is solid: nanoid(32) CSPRNG, SHA-256 stored, timing-safe by index lookup infeasibility.
- FIX: Atomic conditional update `update ... .is("used_at", null).select()` and abort if 0 rows.
- CONF: high. STATUS: NEW

**6. SEV: Low — getClientIp trusts client-supplied XFF when no CDN header present**
- LOC: _shared/net.ts:16-21, 23-30
- MECHANISM: `x-forwarded-for` firstHopOnly takes the leftmost (client-forgeable) entry. If a request reaches the function without CF-Connecting-IP, an attacker rotates spoofed XFF values to get a fresh rate-limit key per request on IP limits.
- FIX: Drop XFF from the header chain or only trust it behind a known proxy hop.
- CONF: medium. STATUS: NEW

**7. SEV: Low — client-facing error detail leakage across several functions**
- LOC: _shared/auth.ts:102 (`details: errorMessage(error)` on the 500 path); upload-file/index.ts:313-317; summarize-chat/index.ts:233; cloudinary-webhook/index.ts:145-147; auth-hook-email/index.ts:187. Contrast process-pdf/handler.ts:248-250 which redacts.
- FIX: Strip `details`/`message` from client 500 bodies; log server-side only.
- CONF: high. STATUS: NEW

**8. SEV: Low — process-pdf DNS-rebinding TOCTOU (self-documented residual)**
- LOC: process-pdf/handler.ts:39-41 (comment), 150 vs 157 (resolve-then-fetch gap). Guard is otherwise strong: allowlist+DNS+manual-redirect re-validation + 15MiB cap + auth + per-user RPC limit. FIX: connect-level egress allowlist. CONF: high. STATUS: KNOWN-active (documented in-code)

**Clean areas**: cors.ts (allowlist echo, no wildcard+credentials); cloudinary-webhook signature genuinely verified (constant-time compare, timestamp checks); delete-avatar cross-user solid; password-reset token lifecycle good (CSPRNG, hash-only, expiry, enumeration-safe); upload path construction server-side from authenticated user.id — no forgery path. Minor: upload-avatar same-ms public_id collision overwrites caller's own asset.
