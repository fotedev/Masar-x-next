# 🛡️ Comprehensive Security Audit Report — Masar X platform

> **Date:** 2026-09-24 · **Branch:** `refactor/decouple-trw-subjects` @ `fbeaf83`
> **Methodology:** manual static code analysis (SAST) + `pnpm audit` on dependencies + Edge Functions review + RLS/migrations review + CI review + reconciliation against previously documented findings (`docs/MVP_REPORT.md`).
> **Scope:** `apps/web` (Next.js 16.2.1 / React 19.2.4), `supabase/` (13 migrations + 11 edge functions), CI/CD, `packages/shared`.
> **Out of scope:** live penetration testing (DAST/pentest) against production — recommended as the next step.

---

## 1) Executive summary

| Severity | Count | Highlights |
|---|---|---|
| 🔴 Critical | 2 | critical Next.js dependency CVEs (RCE) · Vitest vulnerability (dev environment) |
| 🟠 High | 5 | password-reset user enumeration · plaintext token storage · sharp · Electron EOL · 117 dependency advisories |
| 🟡 Medium | 6 | webhook without HMAC signature · SECURITY DEFINER functions without search_path · 24h reset-token TTL · production DB drift from the migrations · client-side-only admin gating · rate-limit fail-open |
| 🟢 Low / accepted | 4 | documented and accepted by prior decision (see §6) |

**Overall verdict:** the core security architecture is **strong and mature** (nonce-based CSP, fail-closed on sensitive paths, verified RLS, gitleaks in CI). The actual current risk comes from **(a) outdated dependencies carrying critical CVEs, (b) two flaws in the password-reset path, (c) the Cloudinary webhook with no signature verification**.

---

## 2) Confirmed strengths (do not touch while remediating)

| Item | Location | Status |
|---|---|---|
| No secrets in git; `.gitignore` tight | `git ls-files` → only `.env.example` | ✅ verified |
| Per-request nonce CSP + `wasm-unsafe-eval` instead of `unsafe-eval` in production | `apps/web/src/proxy.ts` | ✅ |
| Baseline headers (X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) | `apps/web/next.config.mjs` | ✅ |
| Service-role key server-only (`server-only` import) | `lib/supabase/admin.ts` | ✅ |
| OAuth callback open-redirect protection (rejects `//`, `://`, `/\`) | `[locale]/auth/callback/route.ts` | ✅ |
| API auth via `getUser()` (real JWT verification) + zod + rate limit | `lib/api-auth.ts`, `api/ai-chat` | ✅ |
| `/api/mcp` and `/api/health/db` fail-closed in production without the secret | the relevant files | ✅ |
| CORS allow-list in the Edge Functions | `supabase/functions/_shared/cors.ts` | ✅ |
| `upload-file`: 401 without user + allowed-MIME list + 50MB cap | `supabase/functions/upload-file` | ✅ |
| `reset-password`: verifies `expires_at` and `used_at`, relies on `token_hash` | `supabase/functions/reset-password` | ✅ |
| Markdown rendering without `rehype-raw` (no raw HTML ⇒ no stored XSS from that path) | `components/ai/MarkdownRendererHeavy.tsx` | ✅ |
| gitleaks in CI over code and build artifacts | `.github/workflows/ci.yml` + `.gitleaks.toml` | ✅ |
| Dependabot enabled | `.github/dependabot.yml` | ✅ |
| RLS: successful production audit 2026-09-17 (19 tables / 41 policies in the migrations) | `docs/MVP_REPORT.md` G3.1 | ✅ |

---

## 3) Critical and high findings — evidence and remediation

### F1 🔴 Next.js 16.2.1 dependencies carry critical CVEs (RCE)
- **Evidence:** `pnpm audit` (2026-09-24): **6 critical / 57 high / 58 moderate / 8 low = 117 advisories**, including on `next`:
  - CRITICAL: *Unauthenticated RCE on Windows-hosted servers*
  - CRITICAL: *Unauthenticated RCE in Image Optimization API (AVIF)*
  - HIGH: DoS in Server Components · Middleware/Proxy bypass via segment-prefetch · RSC cache poisoning
  - MODERATE: XSS in the CSP nonce path · XSS in beforeInteractive
- **Impact:** production runs on Vercel (Linux), less exposed to the Windows flaw, but the Image Optimization flaw, the DoS, and the middleware bypass directly affect this deployment (`output: standalone` + images + auth gating in the proxy).
- **Fix:** upgrade `next` to the latest patched 16.x release immediately, then `pnpm install && pnpm build && pnpm test` + e2e, then re-run `pnpm audit` to confirm the `next` advisories are gone.

### F2 🔴 Vitest 2.1.8 — RCE (dev environment only)
- **Evidence:** CRITICAL ×2 on `vitest` / `@vitest/mocker` (code execution when visiting a malicious site while the Vitest API/UI is running).
- **Impact:** developer machines only — does not touch production, but critical locally.
- **Fix:** upgrade vitest to the latest patched release; avoid untrusted sites while `vitest --ui` or watch mode is running.

### F3 🟠 sharp ^0.35.4 — libheif vulnerabilities (HIGH)
- **Evidence:** HIGH on `sharp` (GHSA-g89c-p67h-r497 + GHSA-2jg2-4ch7-h545). Direct dependency used for image processing alongside Next standalone in production.
- **Fix:** upgrade `sharp` to the latest compatible patched release.

### F4 🟠 Password reset — user enumeration
- **Location:** `supabase/functions/request-password-reset/index.ts:204-217`
- **Evidence:** when the user does not exist, an early path returns `{ success: true, debug: "No user found in auth.users" }` — while the general path (221-235) is designed correctly ("always the same response"). The `debug` field breaks the design and tells an attacker which emails are registered.
- **Fix:** delete the early path and always return the unified `successResponse`.

### F5 🟠 Password reset — token stored in plaintext next to the hash
- **Location:** `supabase/functions/request-password-reset/index.ts:266-272`
- **Evidence:** `tokenData` contains `token: resetToken` (raw) **and** `token_hash` together. Storing the raw value defeats the purpose of hashing on any database leak.
- **Fix:** remove `token` from the insert and rely on `token_hash` only (the `reset-password` function already verifies the hash). Then clear the column for old tokens.

### F6 🟠 Electron 32 (pinned, EOL) — ~63 security advisories
- **Evidence:** the majority of audit advisories target `electron`: Context isolation bypass, Use-after-free, ASAR integrity bypass… The version is pinned exact under Invariant I6 and is out of support.
- **Status:** documented previously (MVP_REPORT §0) — attack surface = desktop app only. Deferred post-MVP by owner decision, but it **remains an open vulnerability**; an Electron upgrade (with the better-sqlite3 ABI match) must be scheduled in the first spec after launch.

---

## 4) Medium findings

### F7 🟡 Cloudinary webhook without signature verification (HMAC)
- **Location:** `supabase/functions/cloudinary-webhook/index.ts`
- **Evidence:** the only check is a static `x-api-key` header compared with `!==` (not constant-time), and Cloudinary's official payload signature is not verified. The payload is also inserted into the `summaries` table **without sanitization** (`title = payload.public_id`, `pdf_url = payload.url`) — whoever owns/steals the key can inject rows, and `pdf_url` could be a phishing link later rendered in the UI.
- **Fix:** (1) constant-time comparison, (2) better: enable and verify Cloudinary notification signatures, (3) Zod-validate `payload.url` (https + hostname `res.cloudinary.com` only) before insert, (4) rotate `CLOUDINARY_WEBHOOK_KEY` periodically.

### F8 🟡 SECURITY DEFINER functions without a pinned `search_path`
- **Evidence:** `SET search_path` exists only in migrations 010/011/013, while these SECURITY DEFINER functions lack it: `handle_new_user()` (002:52-58), the audit function (006:97), the JWT role-sync functions (008 and 012:13-41).
- **Risk:** schema-shadowing attacks against high-privilege functions (the official Supabase linter warns about exactly this).
- **Fix:** a new migration adding `SET search_path = ''` to every legacy SECURITY DEFINER function.

### F9 🟡 Password-reset token TTL of 24 hours
- **Location:** `request-password-reset/index.ts:271` (`Date.now() + 86400000`).
- **Risk:** a long window for a token that changes the password (the standard is one hour).
- **Fix:** reduce it to `3600000` + invalidate the user's previous tokens when a new one is issued.

### F10 🟡 Production database drift from the migrations (G3.9)
- **Evidence:** production has **48 tables / 170 policies** versus **19/41** in the migrations (documented in MVP_REPORT). Any change made from the Supabase dashboard can leave a table exposed outside code review.
- **Fix:** post-MVP — export the live production schema as a baseline migration and enforce the rule "no dashboard changes; everything through a migration".

### F11 🟡 Admin gating on the add-pages is client-side only (G3.3)
- **Evidence:** the proxy protects `/add-file` and `/add-video` with login only (not the admin role), and the role check lives inside the browser form; real enforcement sits on RLS (verified and sound).
- **Status:** acceptable for the MVP and documented — suggested improvement: a role check in the proxy or a server layout.

### F12 🟡 Rate limiting is fail-open with an in-memory fallback on serverless
- **Evidence:** `lib/rate-limit.ts` documents it explicitly: "Store errors FAIL OPEN"; without Upstash it falls back to per-instance in-memory (ineffective across Vercel instances). The same pattern exists in the edge functions (`catch { // allow on error }`).
- **Fix:** enable Upstash in production (`UPSTASH_REDIS_REST_URL/TOKEN`); document fail-open as an accepted risk (it is the current design).

---

## 5) Dependency vulnerability summary (`pnpm audit` — 2026-09-24)

| Package | Severity | Notable flaws | Environment |
|---|---|---|---|
| `next` 16.2.1 | 🔴 CRITICAL ×2 + HIGH ×3+ | RCE (Windows/Image-API) · DoS · Middleware bypass · Cache poisoning | **production** |
| `vitest` 2.1.8 (+`@vitest/mocker`) | 🔴 CRITICAL ×2 | RCE/file reads via the Vitest API/UI | dev only |
| `sharp` 0.35.x | 🟠 HIGH | libheif flaws | **production** (image processing) |
| `electron` 32 | 🟠 ~63 advisories (several HIGH) | Context-isolation bypass · UAF · ASAR bypass | desktop |
| `@xmldom/xmldom` | 🟠 HIGH ×10+ | XML injection / DoS | transitive — trace the source |
| `tar`, `extract-zip`, `image-size`, `js-yaml`, `fast-xml-parser`, `qs`, `postcss`, `esbuild`, `vite`, `hono`, `decode-uri-component`, `send` | 🟠/🟡 | Path traversal · ReDoS · DoS | mostly build/dev |
| **Total** | **6 critical / 57 high / 58 moderate / 8 low** | 117 advisories | — |

> Note: Dependabot is enabled and the last recorded measurement (2026-09-16) showed 193 open advisories (63 electron). Major mobile upgrades are deliberately parked until post-MVP.

---

## 6) Previously documented findings and their status (from `docs/MVP_REPORT.md`)

| ID | Item | Status |
|---|---|---|
| G3.1 | Live RLS state unverified | ✅ **closed** — successful production audit 2026-09-17 |
| G3.3 | Client-side-only admin gating | 🟡 acceptable for the MVP (see F11) |
| G3.4 | Admin-revocation propagation | ✅ **closed** — `012_jwt_role_sync` applied to production 2026-09-20 |
| G3.6 | Dependabot unmanaged | 🟡 partial — the setup is sound; triage remains (see §5) |
| G3.7 | Unsigned Windows installer | 🟠 open — SmartScreen will warn (EV certificate planned) |
| G3.8 | Reset-email deliverability | 🟡 partial — real production email never tested |
| G3.9 | Production schema drift | 🟡 accepted (see F10) |

---

## 7) Remediation plan by priority

**P0 — immediate (this week):**
1. Upgrade `next` to the latest patched 16.x + `sharp` — then build/test/e2e (F1, F3).
2. Delete the `debug` field from `request-password-reset` (F4 — one line).
3. Stop plaintext token storage (F5 — remove `token: resetToken` from the insert).
4. Confirm `HEALTH_CHECK_SECRET` and `VERCEL_MCP_BYPASS_SECRET` are set in the Vercel production environment.

**P1 — within two weeks:**
5. Cloudinary webhook: constant-time comparison + Zod validation of the payload + evaluate HMAC signatures (F7).
6. Cut the token TTL to one hour + invalidate previous tokens (F9).
7. Upgrade `vitest` (F2) and triage critical/high Dependabot advisories.
8. A migration pinning `search_path` on SECURITY DEFINER functions (F8).

**P2 — post-MVP (requires lifting the MVP Lock or owner approval):**
9. Electron upgrade + better-sqlite3 ABI + installer signing (F6, G3.7).
10. Enable Upstash for distributed rate limiting (F12).
11. Reconcile the production schema with the migrations (F10) and check the admin role in the proxy (F11).
12. External penetration test (pentest) before scaling.

---

## 8) Limits of this audit and git-safety notes

- The audit is **static** (code reading + dependency audit) — no live penetration test against production was run, and the Supabase dashboard settings (Auth/SMTP/redirect URLs) were not inspected because they live outside the repository.
- **No** existing file was modified; the only git footprint is this new file: `docs/security/security-audit-2026-09-24.md` (untracked — the commit decision is yours).
- The audit's temporary files were moved to `.trash/security-audit-tmp/` in compliance with rule I9 (no direct deletion).
- The current stash (`stash@{0}`, `stash@{1}`) and the `specs/015_test_coverage_critical_paths/` folder were untouched.

*Produced by a directed automated audit — a human review of the critical items before acting is recommended.*

---

*Translated from the Arabic original to English on 2026-10-31 (owner request); technical content unchanged.*
