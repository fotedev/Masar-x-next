# MasarX — Handover Report

**Date**: 2026-08-31 · **Repo**: `C:\programming\WEB_Development\projects\masarx_next` (pnpm monorepo, v0.5.7) · **Scope**: spec-driven delivery of `specs/001..004` (163 task IDs).

## 1. What this delivery is

All four Spec-Kit features (`001-critical-security-fixes`, `002-fix-production-errors`, `003-mobile-responsive-fix`, `004-multi-platform-expansion`) are implemented to code-complete, with live verification of the web app's build, gates, and core user flows including real database persistence. See `traceability-matrix.md` (per-task status + evidence) and `verification-report.md` (live runs + screenshots).

## 2. How to run

```bash
# prerequisites: Node 22+, pnpm 9.15.4 (corepack), Git
pnpm install --frozen-lockfile          # full workspace install
pnpm dev:web                            # web app  -> http://localhost:3000
pnpm build:web                          # production build (also: pnpm --filter web start)
pnpm typecheck && pnpm lint             # gates
pnpm --filter desktop build             # Electron build (needs dev:web on :3000 for dev mode)
pnpm --filter mobile install && pnpm --filter mobile typecheck
                                        # Expo app (new in this delivery)
node apps/web/scripts/auth-route-check.mjs --scan-api   # FR-003 guard
pnpm --filter web exec node scripts/migrate-academic-metadata.mjs   # one-time JWT->profiles migration (dry-run default)
```

## 3. Environment variables

Single source of truth for names: `.env.example` (root) — all documented with comments. The web app loads env from **`apps/web/.env.local`** (this delivery synced it from the root file). Required at minimum:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only — never in client bundles)
- `DATABASE_URL`, `DATABASE_URL_IPV4` (pooler; spec 002 FR-001)
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (+ API key/secret for uploads), `BREVO_*` (email)
- Optional: `UPSTASH_REDIS_REST_URL`/`_TOKEN` (durable rate limiting; Supabase `rate_limits` tier is the fallback), `SENTRY_DSN` (error forwarding; console fallback otherwise), `NEXT_PUBLIC_APP_URL` (CORS scoping)

## 4. Architecture decisions worth knowing

1. **Rate limiting** (`apps/web/src/lib/rate-limit.ts`): tiered — Upstash REST sliding window → Supabase `rate_limits` table (service role, matches migration 006) → in-memory with production warning. Fail-open by design. Counting happens in `check` (atomic); consumers `await`.
2. **Logger** (`apps/web/src/lib/logger.ts`): always console; error+warn mirrored to Sentry via a minimal envelope POST when `SENTRY_DSN` is set (5s AbortSignal.timeout; monitoring outage can never break the app).
3. **Academic data lives in `profiles`**, not JWT metadata: `useUserAcademic` (sessionStorage cache + rate limiting) is the single read/write path; `OnboardingModal` uses it for both. One-time migration script included (dry-run default).
4. **Profile validation**: `ProfileSchema` (zod) guards server actions (`updateProfile`/`updateAvatar`); the profile page applies client-side `safeParse` before writes (server action upserts all fields — partial-update mode is the recommended follow-up).
5. **AI boundary (spec 004)**: provider keys only in `supabase/functions/ai-chat`; shared client (`packages/shared/src/ai`) calls the Edge Function (direct) or `/api/ai-chat` proxy (web); the proxy forwards `Accept` and streams SSE unbuffered. Enforced by ESLint `no-restricted-imports` (error) in all three apps + CI grep + gitleaks-on-artifacts.
6. **i18n**: single source `packages/shared/src/messages/{ar,en}/*.json` (43 namespaces); web via next-intl dynamic imports; mobile/desktop via `masarx-shared/i18n` `t()` helper (en-fallback, dev warn). `check-translations.sh` fails CI on local translation dirs.
7. **Responsive system**: `viewport-fit=cover`, safe-area on `<header>`, `min-h-dvh-safe` utility (100vh+100dvh), `w-[min(320px,85vw)]` drawer, `@media (hover:hover)` hover transforms, global reduced-motion block, `text-primary-foreground` token (Tailwind `primary.foreground` → `hsl(var(--primary-foreground))`).
8. **Desktop**: local Next server + BrowserWindow (`app.isPackaged` detection), safeStorage session, better-sqlite3 read cache, electron-updater with rollback; releases via public `masarx-releases` repo.
9. **Mobile**: Expo SDK 51 + React Navigation; `masarx-shared` consumed via Metro package-exports; SecureStore auth session, AsyncStorage read cache, uploads to `summaries-pdfs` (50MB limit, same as web), KaTeX-in-WebView math rendering (CDN; offline shows raw text — documented limitation).

## 5. Known issues / open items

1. **Desktop local node_modules**: healthy — the pps/desktop/node_modules/masarx-shared link resolves correctly (independent review confirmed version 0.5.6 matches packages/shared; an earlier `rmdir` repair note was based on a false diagnostic and must NOT be run).
2. **Shared `typecheck` script**: same root cause (dangling `typescript` symlink). Sources verified clean via web toolchain. Full repair = clean reinstall of workspace node_modules.
3. **`pnpm.neverBuiltDependencies: ["better-sqlite3"]`** (root package.json) is INTENTIONAL — electron-builder compiles it against Electron's ABI. Do not "fix" it.
4. **Profile page display-name UI**: DB persistence verified; after a hard reload the fresh value may not appear in the visible label until the profile query refetches (display source is the profile query cache). Follow-up: show `profiles.full_name` from the server component.
5. **`AdminProfileImage`** now routes through the validated `updateAvatar` action; legacy `user_metadata.avatar_url` fallback still exists by design (anti-flicker).
6. **Git state**: work is on `main` as uncommitted changes (pre-existing user WIP + this delivery, interleaved). Recommended: commit in logical groups — (a) pre-existing auth/desktop/csp-smoke WIP, (b) spec 001 security fixes, (c) spec 003 responsive fixes, (d) spec 004 monorepo/mobile/CI/docs, (e) delivery docs. Nothing was committed to avoid mixing user WIP without consent.
7. **Dependabot**: 123 vulnerabilities (53 high) pre-existing — triage separately (spec 004 T066).
9. **pnpm hoisted-linker quirk**: pnpm install on a partially-linked tree can fail with ERR_PNPM_ENOENT ... @react-navigation/bottom-tabs_tmp_* (Windows race while relinking). Harmless: affected packages are already linked; typechecks and builds pass. A fresh-clone install is unaffected. Mobile @types/react was aligned to ^19.2.14 (types-only; runtime React 18.2) so the hoisted workspace has ONE @types/react instance — this fixed 13 JSX-type errors in the Expo app and pnpm --filter mobile typecheck now passes with **0 errors**.
8. **Spec deviations flagged** (specs take precedence; each documented in traceability matrix): CSP `style-src 'unsafe-inline'` risk acceptance; spec 003 T011 nav-token table applied over a newer cyan design; spec 003 T018 cards are semantic `<Link>`s (not `<button>`); spec 001 T001 no feature branch.

## 6. Deferred work (tracked, not forgotten)

- Signing/notarization + store submissions (needs Apple Developer $99/yr, Google Play $25, Windows EV cert)
- Real-device smoke + perf baselines (methods ready in `docs/perf/baselines.md`)
- Vercel production log review (spec 002 T017)
- SSE streaming E2E test on a deployed environment (function + proxy + client are code-complete)
- `packages/shared/src/supabase` client-info real HTTP header (currently `__clientInfo` property)

## 7. Where everything is

- Delivery docs (also in repo): `docs/delivery/{traceability-matrix,verification-report,handover-report}.md`
- Spec compliance audits: `.cluster/masarx-next/subagent_0{1,2,02b,3}.md` (workspace) — detailed per-task evidence
- Fix logs: `.cluster/masarx-next/fix-log_*.md`
- Flow screenshots: `.cluster/masarx-next/evidence/*.png` (+ summary JSONs)
- RLS harness: `supabase/tests/rls-verify.sql` + README
- Security: `docs/security/secret-leak-runbook.md`; CI: `.github/workflows/{ci,lighthouse}.yml`
