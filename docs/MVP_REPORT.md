# Masar X — MVP Readiness Report

> **Purpose.** Single source of truth for what still stands between Masar X and MVP launch. Written to be consumed and updated by AI agents across passes: every finding has a stable ID (`G§.n`), a priority, a current state, a **verification record**, a location, and a concrete next action. Do not renumber IDs; when an item is resolved, flip its **State** to `done`, add the commit hash, and move it to the bottom of its table (or delete it after two consecutive confirmed passes).

- **Generated:** 2026-09-16 (pass 2 — verification-hardened) · base commit `460761e` (main) · dirty tree: post-build `sw.js`/`next-env.d.ts` + zane composer files (normal)
- **Method:** Active repo inspection — routes, API handlers, migrations, CI workflows, electron-builder/EAS configs, i18n namespaces, and role guards were all read from disk (not inferred from README). Every row's **Verified** column records *how* it was established; anything not directly verified says so explicitly.
- **MVP definition (owner-approved):** web launch for the academic year. MVP Lock (AGENTS.md I12) in force — allowed work: blocking/functional bugs, core study flow stability, login + essential data saving, deployment readiness. Desktop/mobile parity is a separate post-MVP milestone (specs/004/005). **Scope rule for agents:** any row whose *Suggested fix* begins with "Post-MVP" is outside I12 scope until the owner lifts the lock — do not start it without owner approval.
- **State taxonomy (exact meanings):** `done` = verified present and working at base commit · `partial` = exists but incomplete or not verified end-to-end · `not started` = no implementation found · `accepted` = known limitation deliberately kept, remediation explicitly scheduled post-MVP.
- **Priority legend:** 🔴 Critical — blocks launch · 🟠 High — significantly degrades UX/reliability, does not fully block · 🟡 Medium — nice-to-have, ship post-MVP. Priorities are judged against the web-MVP launch; desktop-only items are High at most because they gate a separate milestone.

---

## 0. Status snapshot by surface

| Surface | Stack | Current state | MVP verdict |
| --- | --- | --- | --- |
| Web | Next.js 16, React 19, Tailwind, Framer Motion | **Live in production** (masarx.vercel.app); core study flow routes present; public+staff smokes passed 2026-09 | 🟢 Near-ready — remaining: production content entry + env/flag verification |
| Desktop | Electron 32.2.0 (pinned), electron-builder, electron-updater, better-sqlite3 | v0.5.9; full Windows/macOS/Linux builder config, tag-driven GitHub Releases pipeline, auto-updater wired; **unsigned**, Electron EOL | 🟡 Post-MVP (shippable, unpolished) |
| Mobile | Expo SDK 51, RN 0.74.5 | v0.5.6; 7 functional screens (Login, Subjects, Summaries, Quizzes, QuizPlay, Profile, AIAssistant), Supabase + i18n + secure storage, EAS build/submit configured; **no tests, lint stub, never released** | 🔴 Not started toward release (post-MVP by owner decision) |
| Supabase | Postgres + RLS, Auth, Storage, Edge Functions | 8 numbered migrations (`001_`–`008_`), 19 tables RLS-enabled / 41 policies; JWT role sync (`008_`); `subject_lectures` public read intentionally opened (migration 007 = source of truth) | 🟢 Near-ready — needs one mechanical prod audit |
| packages/shared | Types, Zod schemas, i18n, AI client | 47/47 ar/en namespaces, identical sets, key parity spot-checks pass; workspace contract intact (`/api/ai-chat` shim preserves desktop/mobile AI contract) | 🟢 Healthy |
| CI/CD | GitHub Actions (`ci.yml`, `release.yml`, `lighthouse.yml`) | ESLint + `next build` + `ai-endpoint-grep` + gitleaks-on-artifacts as required checks; tag-driven desktop release publishes via `GITHUB_TOKEN`; **no e2e tests, no dependabot.yml** | 🟡 Healthy but blind to runtime regressions |

*Verified 2026-09-16 @ `460761e` by direct inspection: `ls apps/web/src/app/[locale]`, `find` for API routes/tests/screens, migration grep, namespace diff, workflow reads.*

---

## 1. Core learning features (summaries, courses, quizzes, grade tracking)

Already satisfied: subjects/courses/lectures/summaries browse flow (routes: `subjects`, `courses`, `summaries`, `home`), quizzes (`quizzes`, `quiz-play`, `quiz-attempts` with score display), profile, onboarding, FAQ, news, downloads, non-academic pages, admin-dashboard overview/analytics with redirect from legacy `/[locale]/admin`.

| ID | Item | Description | Priority | State | Verified | File/Module location | Suggested fix / action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G1.1 | Production content entry | The study flow renders real data only if subjects/lectures/summaries/quizzes are entered. Code paths exist; actual content population is the last owner-declared MVP task | 🔴 Critical | partial | routes + hooks read 2026-09-16; production E2E unverified | `apps/web/src/app/[locale]/admin-dashboard/`, `[locale]/add-file/`, `[locale]/add-video/`, `[locale]/edit-summary/`, `apps/web/src/hooks/useContentForm.ts` | Run one end-to-end admin upload smoke in production (login as admin → upload summary file via Cloudinary preset → verify public visibility), then populate launch cohorts' content |
| G1.2 | Upload backend split | Files go to Supabase Storage (`useEditSummary`) but most uploads go to Cloudinary unsigned presets — two media backends with no unified model | 🟡 Medium | partial | grep 2026-09-16 | `apps/web/src/hooks/useEditSummary.ts`, `useContentForm.ts`, `useAddNewsForm.ts`, `useQuizFormState.ts` | Document which content type uses which backend; post-MVP consolidate to Supabase Storage |
| G1.3 | Grade tracking feature | README promises "grade tracking" but no grades feature exists — only quiz scores in `quiz-attempts`. (Broadened grep for "grade" across src+messages: 7 hits, all substring false positives — `upgrade-insecure-requests` in CSP, updater upgrade/downgrade logic) | 🟡 Medium | not started | grep 2026-09-16 (src + messages) | `README.md:39`, `apps/web/src/app/[locale]/quiz-attempts/` | Decide: either treat quiz-attempt scores as grade tracking (fix README wording) or schedule a real grades feature post-MVP |
| G1.4 | Dead `add` route + hardcoded strings | `/[locale]/add` is a redirect stub to `/quizzes` with hardcoded Arabic loader text (violates I3) | 🟡 Medium | partial | page read 2026-09-16 | `apps/web/src/app/[locale]/add/page.tsx` | Point the redirect at the localized path and extract strings to `messages/{ar,en}`; or retire route to `.trash/` (ask owner first — I9) |
| G1.5 | Arabic-named route folder | A route folder literally named `الرئيسية` exists — breaks URL/SEO consistency with the `ar`/`en` prefix scheme | 🟡 Medium | partial | existence verified (`ls`) 2026-09-16; usage unverified | `apps/web/src/app/[locale]/الرئيسية/page.tsx` | Confirm whether anything links to it; if legacy, 301-redirect to `/[locale]/home` and move to `.trash/` (I9) |

## 2. AI assistance layer

Already satisfied: `/api/ai/chat` — auth-gated, per-user rate limit (10 req/min), `ai_chat_disabled` surfaced before auth/rate-limit (`c231ee7`); circuit breaker with tests; Puter.js client-side models so provider keys stay server-side; `/api/ai-chat` compat shim preserves the shared-client contract for desktop/mobile; MCP endpoint fail-closed in prod (`9953135`).

| ID | Item | Description | Priority | State | Verified | File/Module location | Suggested fix / action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G2.1 | Production AI smoke | Feature-flag value and provider reachability in the deployed Vercel env were never verified this week | 🟠 High | partial | code paths read 2026-09-16 (`route.ts:57-79`); prod runtime unverified | `apps/web/src/app/api/ai/chat/route.ts`, Vercel env settings | In production: confirm `ai_chat_disabled` is the intended value, then run one logged-in chat round-trip and one rate-limit rejection |
| G2.2 | Global spend/abuse ceiling | Only per-user rate limiting exists; no global daily budget or per-edge-function cost cap — a bot farm of free accounts can inflate usage | 🟡 Medium | not started | route read 2026-09-16 | `apps/web/src/lib/rate-limit.ts`, Supabase Edge Function `ai-chat` | Post-MVP: add a global daily counter (table or Upstash) checked before the provider call |
| G2.3 | Dual AI route consolidation | Two live routes (`/api/ai/chat` web-native vs `/api/ai-chat` compat shim) — intentional today, but drift risk as both evolve | 🟡 Medium | accepted | both handlers read 2026-09-16 | `apps/web/src/app/api/ai/chat/route.ts`, `apps/web/src/app/api/ai-chat/route.ts` | Post-MVP: consolidate behind one handler; keep the `/api/ai-chat` path as a thin alias for the shared client contract |

## 3. Auth & security (RLS policies, secret handling, CI enforcement)

Already satisfied: OAuth callbacks under `[locale]/auth/callback` with locale preservation (`460761e`); CSP + security headers on catch-path (`452fd3d`); JWT role sync migration (`008_jwt_role_sync.sql`); signup/login/reset-password routes present; CI runs `ai-endpoint-grep` + gitleaks on built artifacts as required checks; no hardcoded provider keys found in source.

| ID | Item | Description | Priority | State | Verified | File/Module location | Suggested fix / action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G3.1 | Mechanical RLS audit of prod DB | 19 RLS-enables / 41 policies exist in migrations (grepped), but no script proves the **live** DB matches — one accidentally-disabled table (e.g. from dashboard edits) leaks data | 🔴 Critical | partial | migrations grepped 2026-09-16 (`grep -c "ENABLE ROW LEVEL SECURITY\|CREATE POLICY" supabase/migrations/*`); live DB **not** checked — this row exists because that check is missing | `supabase/migrations/002_`–`007_`, `.openclaw-rls-open.mjs` | Run in prod: `SELECT tablename, policyname, cmd, roles FROM pg_policies ORDER BY 1;` + check every `public.*` table has `relrowsecurity = true`; diff against migrations; save output to `docs/audits/rls-audit-<date>.txt` |
| G3.2 | One-off RLS script at repo root | `.openclaw-rls-open.mjs` (untracked) applied the `subject_lectures` public-read change directly to prod; it embeds the project ref and reads `.env` — one-off tooling living in the worktree | 🟠 High | partial | script read 2026-09-16; migration 007 cross-checked on disk (policy text matches) | `.openclaw-rls-open.mjs` (repo root), `supabase/migrations/007_subject_lectures.sql:21` | Change already applied; retire the script — move to `.trash/` with owner approval (I9) once the audit in G3.1 confirms prod state |
| G3.3 | Admin gating is client-side only | `add-file`/`add-video` forms check `isAdmin` in the browser; server-side enforcement rests entirely on RLS. Direct URL shows a denied/empty page instead of a redirect | 🟡 Medium | partial | guards read 2026-09-16 (`AddFileForm.tsx:44`, `AddVideoForm.tsx:44`; role logic `AuthContext.tsx:150`) | `apps/web/src/app/[locale]/add-file/AddFileForm.tsx:44`, `add-video/AddVideoForm.tsx:44`, `apps/web/src/contexts/AuthContext.tsx:150` | Acceptable for MVP (RLS holds); post-MVP add server-layout guard or middleware role check for admin routes |
| G3.4 | Admin role-change propagation | `isAdmin` derives from `app_metadata.role` in the JWT; if a role is revoked, a stale token keeps admin UI until refresh | 🟠 High | not started | code read 2026-09-16; propagation behavior untested | `apps/web/src/contexts/AuthContext.tsx:150`, `supabase/migrations/008_jwt_role_sync.sql` | Test end-to-end: demote a test admin → verify next token refresh drops access and RLS blocks writes; document refresh cadence |
| G3.5 | Vercel production env sweep | `SUPABASE_SERVICE_ROLE_KEY` must be set server-side in Vercel prod (known gotcha §6); `ai_chat_disabled`, `NEXT_PUBLIC_SITE_URL`, Cloudinary vars need confirmation | 🔴 Critical | partial | inferred from `docs/agents/references/01-gotchas.md` §6 + `.env.example`; Vercel env **not** checked from this machine | Vercel project env, `apps/web/.env.example` | Checklist-pass all vars in `.env.example` against Vercel prod + preview environments; record result in this report's changelog |
| G3.6 | Dependabot unmanaged | No `.github/dependabot.yml` → no automated dependency PRs. Open alerts measured directly: **193 open, 63 of them electron** | 🟠 High | not started | `gh api --paginate "repos/fotedev/Masar-x-next/dependabot/alerts?state=open"` run 2026-09-16 → 193 / 63 | `.github/dependabot.yml` (missing) | Add dependabot config (npm + github-actions ecosystems, weekly); triage critical/high alerts; Electron bump resolves the bulk |
| G3.7 | Unsigned Windows installer | SmartScreen will warn on every download until Authenticode signing lands; builder config already prepared (`CSC_*` env vars commented) | 🟠 High | not started | builder config read 2026-09-16 | `apps/desktop/electron-builder.yml` (win.signing block) | Acquire EV cert (planned Phase 8); until then, document the warning bypass in the download page copy |
| G3.8 | Email auth deliverability | Password-reset exists in code; Supabase SMTP/redirect config for prod domain unverified | 🟡 Medium | partial | route exists (grep 2026-09-16); Supabase config unverified | Supabase Auth settings, `apps/web/src/app/[locale]/reset-password/` | Trigger one real reset email in prod; confirm redirect lands on the right locale route |

## 4. Bilingual / i18n coverage (English/Arabic, RTL)

Already satisfied: 47/47 ar/en namespaces with identical file sets and key parity (spot-checked `aiAssistant`, `courses`, `faq`, `instructorDashboard`); RTL wired via `AppProviders dir` (`[locale]/layout.tsx:131`); localePrefix always, default `ar` (`src/middleware.ts`); only 1 TODO/FIXME in all of `apps/web/src`.

| ID | Item | Description | Priority | State | Verified | File/Module location | Suggested fix / action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G4.1 | Hardcoded-string debt | Measured **2026-09-16 by running `node .agents/agents/verify_i18n.mjs`**: 162 hardcoded hits (130 allowlisted ⇒ 32 actionable), 419 files scanned, 0 parity issues. Earlier report cited "~276 (2026-09-14)" — superseded by this direct measurement (allowlist added / batches landed in between) | 🟡 Medium | partial | command run 2026-09-16, output quoted above | `apps/web/src/**` (audit via `.agents/agents/verify_i18n.mjs`, local-only) | Keep the no-NEW-hits gate; run batch 8 (useQuizImport, useCourses, SubscribeModal) post-MVP |
| G4.2 | i18n verifier is local-only | The parity gate script lives in gitignored `.agents/agents/` — CI cannot enforce it | 🟡 Medium | partial | `ls` 2026-09-16 | `.agents/agents/verify_i18n.mjs` | Post-MVP: promote into `scripts/` + wire as a CI job (warn-only) |

## 5. Cross-platform parity (Web complete → Desktop/Mobile gaps)

Already satisfied: desktop wraps the standalone Next.js build (server.js + static + public under `resources/web`), `masarx://` protocol registered for OAuth return, auto-updater on `latest.yml` channel from GitHub Releases, shared package compiled into the bundle via prebuild materialization.

| ID | Item | Description | Priority | State | Verified | File/Module location | Suggested fix / action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G5.1 | Electron 32.2.0 is EOL | Pinned exact (I6) but past end-of-life — no security patches; also anchors the better-sqlite3 ABI (v128 prebuilds). Contributes 63 of the 193 open Dependabot alerts | 🟠 High | partial | `package.json` read 2026-09-16 (`electron: 32.2.0`); alert count from G3.6 API run; EOL status per Electron release schedule | `apps/desktop/package.json`, `electron-builder.yml` npmRebuild note | Post-MVP: bump to current Electron, regenerate/verify better-sqlite3 prebuild for the new ABI, re-run desktop smoke |
| G5.2 | Desktop test suite fails environmentally | `better-sqlite3` postinstall is skipped by `neverBuiltDependencies`, so local/desktop vitest smoke fails on missing electron cli.js — pre-existing, not a regression | 🟡 Medium | partial | known-failure record 2026-09-16; not re-run this pass | `apps/desktop/__tests__/smoke.test.ts`, root `package.json` pnpm block | Document in test README; optionally make CI skip desktop vitest explicitly instead of relying on env luck |
| G5.3 | macOS/Linux desktop targets unproven | dmg/zip/AppImage/deb/rpm fully configured but never built/signed/notarized | 🟡 Medium | not started | config read 2026-09-16; no build artifacts inspected | `apps/desktop/electron-builder.yml` (mac/linux blocks) | Post-MVP: one CI dry-run per target; requires Apple Developer ID + GPG key setup |
| G5.4 | Mobile release path never exercised | 7 screens + auth/i18n/storage work; EAS production profile exists (app-bundle + submit) but zero builds, zero tests, lint is a stub | 🟡 Medium | partial | tree walked 2026-09-16 (`find apps/mobile`); `eas.json` read; no test files found | `apps/mobile/` (screens, `eas.json`), `apps/mobile/package.json` scripts | Post-MVP: wire lint script, one EAS `preview` APK build, internal test track before store submission |
| G5.5 | Desktop audit follow-ups | 2026-09-08 audit: dead auth/cache subsystems + workspace wiring bug; prebuild symlink materialization suggests wiring fixed, dead code status unverified | 🟡 Medium | partial | audit dated 2026-09-08 (`docs/audits/`); follow-ups not re-verified this pass | `apps/desktop/scripts/prebuild.mjs`, `apps/desktop/src/` | Post-MVP: re-audit for dead auth/cache modules; retire via `.trash/` with owner approval |

## 6. Testing & CI health

Already satisfied: required checks per branch ruleset (ESLint, next build with placeholder envs, `ai-endpoint-grep`, gitleaks-on-artifacts); 9 vitest files total (web: 5 lib tests incl. AI circuit breaker; desktop: 4); Lighthouse workflow present.

| ID | Item | Description | Priority | State | Verified | File/Module location | Suggested fix / action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G6.1 | No e2e coverage of the core study flow | CI can pass while login→subject→lecture→summary is broken at runtime (no Playwright/browser tests anywhere) | 🟠 High | not started | `find` for `*.test.*`/`*.spec.*` across apps+packages 2026-09-16 → 9 files, all vitest, none browser | new: `apps/web/e2e/` + `.github/workflows/ci.yml` | Add one happy-path Playwright spec (login → open subject → open lecture/summary) against preview deploy; wire as a CI job |
| G6.2 | No packages/shared tests | The one cross-platform package (types, Zod schemas, AI client) has only typecheck/lint | 🟡 Medium | not started | `find` 2026-09-16 → no test files under `packages/shared/` | `packages/shared/` | Post-MVP: unit tests for Zod schemas (web's `shared-schemas.test.ts` covers some surface) |
| G6.3 | Lighthouse cadence unverified | Workflow exists; whether it runs on schedule/actionable thresholds unknown | 🟡 Medium | partial | workflow file present (`ls` 2026-09-16); triggers not inspected | `.github/workflows/lighthouse.yml` | Confirm trigger + set a perf budget or mark informational |

## 7. Deployment / release readiness (installers, store builds)

Already satisfied: web live on Vercel (`apps/web/vercel.json`); tag→release pipeline publishes NSIS + portable + `latest.yml` + blockmaps to GitHub Releases via built-in `GITHUB_TOKEN` on a public repo; static artifact names keep `releases/latest/download/...` stable; `/api/health/db` exists.

| ID | Item | Description | Priority | State | Verified | File/Module location | Suggested fix / action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G7.1 | Sentry cleanup + DSN verification | Sentry is wired (`logger.ts`) but the generated example API route shipped to prod; DSN/env in prod unverified | 🟡 Medium | partial | grep 2026-09-16 (logger wired, example route present); DSN unverified | `apps/web/src/app/api/sentry-example-api/route.ts`, `apps/web/src/lib/logger.ts` | Verify prod DSN env, delete example route (I9: ask owner, move to `.trash/`), test one error event |
| G7.2 | Custom domain | Product runs on `masarx.vercel.app`; branded domain not attached (affects OG tags, OAuth redirect lists, desktop protocol) | 🟡 Medium | not started | README/env read 2026-09-16; DNS not checked | Vercel domains, `NEXT_PUBLIC_SITE_URL` | Owner decision; if added, update Supabase auth redirect allowlist + `NEXT_PUBLIC_SITE_URL` together |
| G7.3 | Release drill | Release pipeline architecture is done but the full tag→published-installer→auto-update path hasn't been exercised end-to-end recently | 🟠 High | partial | `release.yml` + builder `publish` block read 2026-09-16; no recent drill evidence found | `.github/workflows/release.yml`, `docs/agents/references/02-release-pipeline.md` | Tag `v0.5.9` (or next patch), verify published assets + updater picks the release from an installed v0.5.8 client |

---

## 8. Top 5 critical blockers (ranked by impact)

1. **G3.5 — Production env & flag sweep.** One missing/misconfigured Vercel env (`SUPABASE_SERVICE_ROLE_KEY`, `ai_chat_disabled`, Cloudinary, site URL) silently breaks core flows that all pass locally. Cheapest highest-leverage check; do it first.
2. **G3.1 — Mechanical RLS audit of the live DB.** The repo's security story (public marketing + I1) rests on RLS actually being on everywhere in prod; migrations say so, nothing proves the live DB matches. Repo is public — verify before any user growth.
3. **G1.1 — Production content entry.** The platform has nothing to study until admins populate real subjects/lectures/summaries. Pure operational work, but it depends on G3.5 (Cloudinary/Storage env) and one E2E upload smoke passing in prod.
4. **G6.1 — One happy-path e2e smoke in CI.** Without it, every deploy to the live study flow is unguarded; this is what makes "content entered" stay entered after future deploys.
5. **G3.6 — Dependabot config + alert triage.** 193 open alerts (63 in the pinned EOL Electron) on a public repo; config absence means it never shrinks on its own. Security hygiene, partially deferred post-MVP except criticals.

The five above are strictly web-MVP launch blockers. Three further items gate the **desktop release milestone only**, not the web MVP (all 🟠 High in the tables): G7.3 release drill, G3.7 code signing, G5.1 Electron EOL bump. They belong to the post-MVP desktop queue in that order.

## 9. Suggested execution order

Ordered so each step unblocks the next; respects MVP Lock (I12 — every step below is deployment-readiness or core-flow work):

1. **G3.1 RLS audit** (30 min, read-only) — establishes the security baseline before any content goes in. Output saved to `docs/audits/`.
2. **G3.5 env sweep** (30 min) — Vercel prod/preview vars vs `.env.example`; fix gaps; note results.
3. **G3.4 + G3.2 hardening** (1 h) — admin demotion propagation test; retire `.openclaw-rls-open.mjs` to `.trash/` with owner approval.
4. **G6.1 e2e happy path** (half day) — Playwright login→browse→view spec on preview deploy, wired into `ci.yml`. Do this **before** content entry so uploads are never tested on unguarded ground.
5. **G1.1 content entry** (operational, launch gate) — E2E admin upload smoke in prod → populate launch cohorts.
6. **Post-MVP queue in priority order:** G2.1 AI prod smoke (if not done in step 2) → G7.3 release drill → G3.6 Dependabot + triage → G3.7 signing → G5.1 Electron bump → G5.4 mobile first APK → G1.3 grade-tracking decision → G4.1/G4.2 i18n batches → G2.3/G1.4/G1.5/G7.1 cleanups.

## 10. Appendix — update protocol for future agent passes

1. Re-verify **State** per ID against disk before trusting this report; disk is the source of truth (spec numbers and migrations are auto-derived from disk, never from memory). Each row's **Verified** column tells you what was and wasn't actually checked last pass — start with the unverified parts.
2. Verification snippets:
   - RLS audit: query `pg_policies` + `pg_class.relrowsecurity` on prod (see G3.1).
   - i18n debt/parity: `node .agents/agents/verify_i18n.mjs --json` (last run 2026-09-16: 162 hits / 130 allowlisted / 0 parity issues).
   - Dependabot count: `gh api --paginate "repos/fotedev/Masar-x-next/dependabot/alerts?state=open" --jq '.[] | 1' | wc -l` (last run 2026-09-16: 193, 63 electron).
   - Route inventory: `ls apps/web/src/app/[locale]`.
   - Test inventory: `find apps packages -path "*node_modules*" -prune -o -name "*.test.ts*" -print`.
3. On resolving an item: append the commit hash to the row, move to bottom of its table; add a row to the changelog below.
4. Do not renumber IDs. New findings take the next free number in their group.
5. Known non-issues (do not re-flag): `sw.js`/`next-env.d.ts` dirty after builds; desktop vitest environmental failure (G5.2); `/api/ai-chat` vs `/api/ai/chat` duality (intentional contract shim, G2.3); native `<select>` dark-mode popup (OS-rendered).

### Changelog

| Date | Change | Pass |
| --- | --- | --- |
| 2026-09-16 | Initial report generated from active repo inspection at `460761e` | 1 |
| 2026-09-16 | Verification-hardened: per-row **Verified** column; state taxonomy made explicit (`accepted` added; G2.3 relabeled, G1.5/G3.2 clarified); corrected stale numbers with inline commands — i18n debt 276 → **162 (130 allowlisted)**, Dependabot 189/32 → **193/63**; confirmed G1.3 (grade hits are substring false positives); reworded §8 footnote to separate web-MVP blockers from desktop-milestone items; added I12 scope rule to legend | 2 |
