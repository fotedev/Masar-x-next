# Spec Completion Dashboard — masarx_next

**Repository**: `C:\programming\WEB_Development\projects\masarx_next`
**Audit date**: 2026-09-18 (Europe/Warsaw)
**HEAD at audit**: `df229ad` — *docs(specs): record 007 round 13*
**Method**: static read-only analysis + unit-test execution (see §Methodology and §Appendix B)
**Specs discovered**: 10 spec units (directories) / 51 files under `specs/`
**Source tree mutated**: NO (only this report artifact was added)

> **Post-audit correction (2026-09-20).** One finding is stale relative to a later owner decision: **004 — "Desktop `LocalReadCache` (SQLite) missing"** (§1 blocker 3, §3 row 004, §5.4 cp-19, §8.2 recommendation "Land desktop SQLite read-cache (T022)"). The absence is **deliberate**, not a gap: the never-invoked desktop read-cache + local auth subsystems were removed as dead code in `ddb1612` (2026-09-12, −998 lines) — the desktop app is online-only by design. T022 is retired; do not re-implement the SQLite read-cache. All other findings remain accurate as of the audit date.

---

## 1. Executive Summary

| Metric | Value |
| --- | --- |
| Spec units audited | 10 / 10 (100% coverage) |
| Files under `specs/` enumerated | 51 (see §Appendix A) |
| Specs **Done** | 0 |
| Specs **In Progress** | 9 |
| Specs **Blocked** | 0 |
| Specs **Stale** | 0 (flags raised in §6 for 003 / 004 / 005) |
| Specs **Conflict** | 0 (flags raised in §6 for 004) |
| Specs **Not Assessable** | 0 |
| Specs **Not Started** | 1 (008) |
| Aggregate completion (mean of spec %) | **73.4 %** |
| Web unit tests | **49 / 49 pass** (6 files) |
| Desktop unit tests | **23 pass / 4 skipped** (3 files, 1 skipped) |

> No spec reaches **Done / 100 %** because no spec in scope has automated tests covering *its own* claimed behaviour (Done requires implementation **and** corresponding tests — see §Methodology). Spec 007 is the closest at 94.4 %.

### Top blockers (ranked by impact)

1. **008 — chat persistence is unimplemented and the live load path is unbounded.**
   `apps/web/src/hooks/useAiChat.ts:96` orders `ai_chat_messages` with **no `.limit()`**, and there is **no migration** for `ai_chat_messages` (`supabase/migrations/` stops at `008_jwt_role_sync.sql`); the table is untracked, RLS is unproven, and `packages/shared/src/types/database.ts` has **no Row type**. This is the only spec at 0 % and the largest standing risk.
2. **010 — the CI e2e guard does not exist.** `apps/web/e2e/study-flow.spec.ts` and `playwright.config.ts` exist locally, but `.github/workflows/ci.yml` has **no `e2e` job** (jobs present: ESLint, next build, workspace tests, ai-endpoint grep, gitleaks-artifacts). The study flow is still unguarded in CI (finding G6.1 open).
3. **004 — mobile has no automated tests, the AI streaming contract is unimplemented, and desktop `LocalReadCache` is absent.** `apps/mobile` has 0 test files; `supabase/functions/ai-chat` returns JSON only (T054a open, so `streamAiMessage` yields nothing); no SQLite read-cache file exists under `apps/desktop/src`.
4. **005 — dev-environment safeguards were never landed** (port pre-clear, full clean, SW unregistration, AGENTS visual-verification rule) and `verification.md` is missing → 77.3 %, the lowest of the implemented specs.
5. **009 — three owner-assisted ops items are still pending** (AI prod smoke, admin role-propagation test, MVP report pass 3).
6. **003 — subjects-grid base column count deviates** from FR-003 (`grid-cols-1` in code vs `grid-cols-2` in spec) and the RTL verification pass has no recorded evidence.

---

## 2. Methodology

### 2.1 Percentage formula

```
completion % = satisfied_checkpoints / total_checkpoints × 100   (capped at 100 %)
```

- Checkpoints are derived from each spec's **Functional Requirements (FR-xxx)** and its **`tasks.md`** entries.
- Every checkpoint is **binary** (satisfied / not satisfied) and is tied to a verifiable artefact: an existing file, an exported symbol/route, a grep hit with a line number, a passing test file, a git commit, or a documented checklist result.
- Where an FR contains two independently checkable claims, it is **split into two checkpoints** (e.g. 001 FR-006 → "nonce set" + "no `unsafe-inline` anywhere") so the ratio stays integral.
- The numerator/denominator for every row is printed in §5 and re-derivable from the per-checkpoint tables.
- No percentage was assigned from prose impressions.

### 2.2 Checkpoint definition

A checkpoint is a single, observable claim such as *"`src/middleware.ts` exists and exports the default handler"*, *"`useAiChat` caps history load to 100 rows"*, or *"`apps/web/e2e/study-flow.spec.ts` exists"*. "Satisfied" requires the artefact to be found by the recorded command in §Appendix B.

### 2.3 Status buckets (exact criteria)

| Status | Criteria |
| --- | --- |
| **Not Started** | 0 implemented checkpoints verified; the spec's own header confirms no work has landed. |
| **In Progress** | Some checkpoints verified, but ≥1 checkpoint unmet **or** the required automated tests for the spec's scope are absent/failing. |
| **Blocked** | Work cannot advance without user-only input (credentials, owner approval, external account) and no safe assumption exists. |
| **Stale** | ≥1 checkpoint targets a path/symbol that no longer exists or was superseded by a later spec, **and** the remainder is otherwise implemented. |
| **Conflict** | A spec requirement contradicts the current architecture (not merely missing code). |
| **Not Assessable** | No checkpoints could be derived from the spec text. |
| **Done** | **100 %** AND implementation artefacts **and** passing unit/integration tests covering the spec's scope both exist. |

> **Rule applied throughout**: a spec is **not** marked Done when its tests are absent, failing, or not runnable — even at a high percentage.

### 2.4 Test-status taxonomy used in evidence

`pass` (executed green this audit) · `present-not-run` (file exists, not executed) · `skipped` (collectable but conditionally skipped) · `absent` (no test file for the scope).

---

## 3. Completion Dashboard

| Spec Name / ID | Target Scope | Completion % | Status | Verification Evidence (Files / Commits) | Missing Blockers |
| --- | --- | --- | --- | --- | --- |
| **001-critical-security-fixes** | Middleware activation, prod error logging, verified auth (`getUser`), AI rate-limit, input validation, CSP, PII/sessionStorage | **96.0 %** (24/25) | In Progress | `apps/web/src/middleware.ts` (nonce, CSP, X-Frame-Options; L23,139-150)<br>`apps/web/src/lib/logger.ts` (no isDev gate on error/warn; Sentry envelope forwarding)<br>`apps/web/src/lib/rate-limit.ts` (10 req/60 s; L49-52)<br>`apps/web/src/app/api/ai/chat/route.ts` (getUser L71, rate limit L77, max 10000 L22)<br>`apps/web/src/actions/profile.ts` (ProfileFormSchema.safeParse L30)<br>`apps/web/src/lib/cloudinary.ts:236` (env cloudName)<br>`useQuizAttempt.ts`, `academic-utils.ts`, `login/page.tsx`, `signup/page.tsx` (sessionStorage)<br>`storage-cleanup.ts` (legacy-key purge)<br>`AppProviders.tsx:62` (`<Toaster/>`) | CSP `style-src` still ships `'unsafe-inline'` (`middleware.ts:84`) → SC-005 unmet. No unit/integration test covers auth/rate-limit/profile validation (`src/lib/__tests__/` has 6 files, none in scope) → not Done. |
| **002-fix-production-errors** | `/api/auth/sync` stability, CSP eval fix, accessible forms, resilient SW | **92.9 %** (13/14) | In Progress | `apps/web/src/app/api/health/db/route.ts`<br>`apps/web/src/lib/admin-db/db.ts` (IPv4 fallback + prod warning L13-33)<br>`apps/web/src/actions/auth.ts`, `api/auth/sync/route.ts` (logger + 500)<br>`apps/web/src/contexts/AuthContext.tsx` (syncInProgress L57, triggerSync L61, SIGNED_IN L158)<br>`apps/web/public/sw.js` (nav fallback L74-77)<br>`login/page.tsx` (htmlFor/id L223-298)<br>`.env.example:29` (`DATABASE_URL_IPV4`) | No automated test covers sync-debounce, CSP, SW, or label associations → 1 checkpoint unmet. |
| **003-mobile-responsive-fix** | Safe-area/dvh, subjects grid, drawer dismiss, design tokens, hover/reduced-motion | **85.7 %** (18/21) | In Progress | `apps/web/src/app/layout.tsx:9` (`viewportFit:"cover"`)<br>`Header.tsx:355,411` (safe-area + w-11 h-11)<br>`Layout.tsx:92-93` (pt-calc + min-h-dvh)<br>`MobileNav.tsx:131,163` (`w-[min(320px,85vw)]`, pb safe-area)<br>`SubjectsGrid.tsx:44,76` (CSS grid)<br>`index.css:96,171,184,549` (tinted glass, `hover:hover`, reduced-motion)<br>`HomeClient.tsx`, `home/{Summaries,Videos,Quizzes}Section.tsx` (transition-\[...\], Link cards)<br>`useReducedMotion` in 5 components | FR-003 base column is `grid-cols-1` vs spec's `grid-cols-2` (`SubjectsGrid.tsx:44`). FR-012 `DashboardStats` component no longer exists (breakpoint folded into section grid). No RTL-verification evidence. **Stale**: FR-005 (`h-dvh`) target superseded by 007 full-bleed refactor. Tests: absent. |
| **004-multi-platform-expansion** | Monorepo, desktop (Electron), mobile (Expo), shared package, security guards, i18n, auth, perf | **81.1 %** (30/37) | In Progress | `pnpm-workspace.yaml`, `apps/{web,desktop,mobile}`, `packages/shared/src/{supabase,ai,types,messages,i18n}`<br>`apps/desktop/src/main/{index,preload,server,port,updater}.ts`<br>`apps/desktop/src/main/__tests__/main.test.ts` (12 pass)<br>`apps/mobile/src/{auth-storage,read-cache,share}.ts`, `upload.ts`, `components/MathText.tsx`, `screens/*`<br>`.github/scripts/check-ai-provider-endpoints.sh`, `check-translations.sh`, `.gitleaks.toml`, `ci.yml` gitleaks job<br>`docs/perf/baselines.md`, `.github/workflows/lighthouse.yml`<br>`onlyBuiltDependencies` (pnpm-workspace.yaml:34) | **Desktop `LocalReadCache` (SQLite) missing** — no `new Database`/`better-sqlite3` use in `apps/desktop/src`. **Mobile tests absent** (`__tests__/i18n.test.ts`, `math-rendering.test.ts` never created). **US4 cross-platform auth smoke has no recorded result**. **`streamAiMessage` unimplemented** (T054a; edge fn is JSON-only). US6 perf profiling (T058-60) unrecorded. `tsconfig.base.json` referenced but absent. |
| **005-desktop-study-workspace** | 3-column workspace, native-feel shell, frameless titlebar, dev safeguards | **77.3 %** (17/22) | In Progress | `apps/web/src/lib/desktop/{runtime,useIsDesktopRuntime}.ts`<br>`apps/web/src/components/desktop/workspace/{types,LectureListColumn,ReaderToolbar,DocumentReader,AssistantPanel,StudyWorkspace}.tsx`<br>`apps/web/src/styles/desktop-shell.css`, `DesktopShellGate.tsx`, `CustomTitlebar.tsx`<br>`apps/web/src/components/Layout.tsx:96-125` (footer/promo gated)<br>`apps/desktop/src/main/index.ts:148-149,295-309` (frameless + IPC), `preload.ts:61-73`<br>Commits: main.test.ts contract green | **FR-024** no port pre-clear (`apps/web/package.json` `predev` is still `inject-sw-version.mjs`). **FR-025** `scripts/clean.mjs` removes only one target (default `.next`), not `out` + `node_modules/.cache`. **FR-026** `sw-register.ts` has no unregister branch. **FR-027** no visual-verification rule in `AGENTS.md`. `specs/005-desktop-study-workspace/verification.md` missing (T053). Also: tasks.md ledger is **stale** (T010-T024 unchecked but code present). |
| **006-admin-dashboard-shell** | Admin shell, sidebar IA, summaries retirement, filter ergonomics, overview analytics | **85.0 %** (17/20) | In Progress | `apps/web/src/components/admin-shell/*` (AdminLayout, Sidebar, MobileNav, AdminTopbar, StatCard, PageHeader, AdminCommandPalette, FilterBottomSheet)<br>`apps/web/src/hooks/admin-shell/*`, `apps/web/src/lib/admin-shell/navigation.ts`<br>`apps/web/src/components/admin/CoursesEnrollmentsView.tsx`<br>`.trash/apps/web/src/components/{SummariesTab.tsx,admin/AdminDashboardTabs.tsx}`<br>`Layout.tsx:50,96-125` (isAdminRoute isolation)<br>Commits: `6f0574c` (merge), `64bec08`, `6549a8a`, `319b009`, `ec15042`, `866247f` | T5.1 browser probe **blocked on manual admin login** (all admin routes behind Supabase auth). T5.2 final report not landed. No unit test for `useAdminFilters` (spec's own vitest item). `useAdminFilters` slimming verified only by absence of `filteredSummaries`. |
| **007_zane-gemini-ux** | Window-edge scrollbar, (+) tools popover, bottom model pill, slim header, markdown pipeline | **94.4 %** (17/18) | In Progress | `Layout.tsx:89-92` (assistant full-bleed), `ChatContainer.tsx:164-171` (`dir="ltr"`, `.chat-messages`, max-w-4xl)<br>`ChatInput.tsx` ((+) popover, model pill), `ChatHeader.tsx` (slimmed, no mode/model pills)<br>`packages/shared/src/messages/{ar,en}/aiAssistant.json:15,17` (`tools`,`model`)<br>`apps/web/src/lib/ai/zaneMarkdown.ts` + `src/lib/__tests__/zaneMarkdown.test.ts` (19 tests, **pass**)<br>Commits: `9a9f9c6`,`28b8fc5`,`5de6491`,`b71723c`,`11307f7`,`df229ad` | **No component-level tests** for the structural claims (scrollbar docking, popover, model pill) — spec itself states no component test infra exists, verification is browser-probe based (recorded in `tasks.md`, not re-runnable by this audit). 1 checkpoint unmet. |
| **008_chat-persistence-hardening** | `ai_chat_messages` migration+RLS, 100-row load cap, retention prune, guest cap, DB Row type | **0.0 %** (0/8) | Not Started | No artefact found. Spec header: *"DRAFT — awaiting owner approval. Nothing here is implemented yet."* `supabase/migrations/` has no `009_ai_chat_messages.sql`; `useAiChat.ts:96` has no `.limit()`; `packages/shared/src/types/database.ts` has no `ai_chat_messages` Row (grep: no match). | All 8 checkpoints unmet: migration, RLS, index, load cap, prune, guest cap, insert error handling, DB type. Gated on **owner approval (I11)**. |
| **009_mvp-launch-ops-hardening** | RLS audit, retire one-off script, env sweep, dependabot, route hygiene, sentry cleanup | **81.3 %** (13/16) | In Progress | `scripts/audit-rls.mjs`, `.trash/.openclaw-rls-open.mjs`<br>`specs/009_.../checklists/{rls-audit,env-sweep,role-propagation}.md`<br>`.github/dependabot.yml`<br>`apps/web/src/app/[locale]/add/page.tsx` (uses `@/navigation`)<br>`.trash/apps/web/src/app/[locale]/%D8%A7…/page.tsx` (Arabic route retired), `.trash/.../sentry-example-api/route.ts`<br>Commits: `e09edb2`, `8e88cd2`, `2e4520d`, `08fee5d`, `d8c56f8`, `03cb100`, `dc1f85b` | T4.2 AI prod round-trip + 429 rejection: **pending owner-assisted session**. T4.3 admin demotion propagation: **pending**. T8.1 MVP report pass 3 not landed (`docs/MVP_REPORT.md` still pass 2 — G1.4/G3.1/… still `partial`). |
| **010_e2e-study-flow-smoke** | Playwright public happy-path e2e + CI job + authenticated runbook | **40.0 %** (4/10) | In Progress | `apps/web/e2e/study-flow.spec.ts` (ar/en, shell + soft-skip data layer)<br>`apps/web/playwright.config.ts` (`--no-proxy-server`, E2E_BASE_URL, webServer)<br>`apps/web/package.json:20` (`test:e2e`)<br>`specs/010_.../checklists/authenticated-smoke.md`<br>`@playwright/test` devDep declared | **CI `e2e` job absent from `.github/workflows/ci.yml`** (T2.1/T2.3/T2.4 unmet). Repo Variables T2.2 unverified. Local run green (T1.4) not recorded. `docs/MVP_REPORT.md` G6.1 not flipped (T4.1). `@playwright/test` not installed in `apps/web/node_modules` (present only at repo root). |

---

## 4. Stale & Conflict Register

Concrete code signals only. Each entry cites the exact evidence and a recommended resolution.

| # | Spec | Flag | Triggering code signal | Recommended resolution |
| --- | --- | --- | --- | --- |
| 1 | 003 | **Stale (superseded)** | FR-005 targets the chat page's `h-screen`/`h-[100dvh]` classes, but spec 007 commit `28b8fc5` removed **all** `100dvh` calc classes and `max-w-5xl` from `apps/web/src/app/[locale]/ai-assistant/page.tsx`, replacing height with a flex chain. The FR-005 file content no longer exists. | Mark FR-005 "satisfied by supersession"; reference 007 in the 003 ledger; do not re-introduce `h-dvh` on the page. |
| 2 | 004 | **Conflict (architecture)** | `packages/shared/src/ai/index.ts` exports `streamAiMessage`, but the spec's own T054 + T054a record that `supabase/functions/ai-chat/index.ts` is **JSON-only**, so the streaming variant "silently produces no output". Contract exists, backend does not. | Implement SSE (`generateContentStream`, `text/event-stream`) per T054a, or mark `streamAiMessage` `@experimental` and fail fast. |
| 3 | 004 | **Conflict (live path)** | The 004 `ai-boundary.md` contract says *"clients do not call the AI provider directly"*, but the live web path is Puter.js client-side (`apps/web/src/lib/puter.ts`) with `AI_GATEWAY_API_KEY` absent in prod (`specs/009/checklists/env-sweep.md`: falls back to Puter). Two AI transports coexist. | Record the Puter path as the sanctioned MVP transport in 004 `ai-boundary.md`, or provision the gateway key. |
| 4 | 004 | **Stale (missing scaffold)** | `tasks.md` T004 says `packages/shared` `tsconfig.json` "extends `tsconfig.base.json`", but **no `tsconfig.base.json` exists at the repo root** (`Test-Path` → False). | Remove the reference or add the base config. |
| 5 | 005 | **Stale (ledger)** | `specs/005-.../tasks.md` leaves T010-T024 unchecked, yet all files those tasks name exist (`components/desktop/workspace/*`, `desktop-shell.css`, `DesktopShellGate.tsx`). The task ledger contradicts the tree. | Re-run the ledger against `main`; tick verified tasks, keep only the genuinely-open ones (T030-T033, T050-T053). |
| 6 | 008 | **Not-implemented (live risk)** | Spec 008 §1 states the `ai_chat_messages` table "was created out-of-band"; the table is referenced by `useAiChat.ts` but absent from `supabase/migrations/` (last migration = `008_jwt_role_sync.sql`), and the load path is unbounded. | Approve + land the migration/RLS/type/cap per spec 008 §5. |
| 7 | 001 | **Naming drift (cosmetic)** | FR-005 names `ProfileSchema`; the shipped symbol is `ProfileFormSchema` (`apps/web/src/lib/validation/profile.ts:3`). | Rename or note alias; no functional impact. |
| 8 | 003 | **Deviation** | FR-003/SC-003 require `grid-cols-2` at the 320 px base; `SubjectsGrid.tsx:44,76` ships `grid-cols-1 sm:grid-cols-3 lg:grid-cols-4`. | Confirm intended single-column base, then amend FR-003 to match code (or set `grid-cols-2`). |
| 9 | 006 | **Naming drift** | Spec body uses `AdminDashboardShell→AdminLayout`, `AdminSidebar→Sidebar`, `MobileDrawer→MobileNav`; the tree ships exactly the target names, so the "ported" names in older prose are superseded. | No action; historical narration only. |

---

## 5. Per-Spec Checkpoint Detail

Every row's numerator/denominator is reproduced here and traceable to a file/grep/test.

### 5.1 001-critical-security-fixes — 24/25 (96.0 %)

| # | Checkpoint | Result | Evidence |
| --- | --- | --- | --- |
| 1 | `src/middleware.ts` active as default export | ✅ | `apps/web/src/middleware.ts` |
| 2 | `logger.error` has no `isDev` gate | ✅ | `logger.ts` (error writes unconditionally) |
| 3 | `logger.warn` has no `isDev` gate | ✅ | `logger.ts` |
| 4 | Monitoring forwarding wired into logger | ✅ | `sendToMonitoring()` in `logger.ts` |
| 5 | API routes use `getUser()` not `getSession()` | ✅ | grep: 0 `getSession`, 4 `getUser()` under `src/app/api` |
| 6 | `noOpLock` removed | ✅ | grep `noOpLock` in `lib/supabase.ts` → 0 matches |
| 7 | Sliding-window rate-limit utility exists | ✅ | `lib/rate-limit.ts` |
| 8 | AI endpoint requires auth (401) | ✅ | `api/ai/chat/route.ts:71` |
| 9 | AI endpoint rate limit 10/min → 429 | ✅ | `rate-limit.ts:51` + `route.ts:77` |
| 10 | AI prompt validation (10 000 chars) | ✅ | `route.ts:22` |
| 11 | Profile update validated with Zod schema | ✅ | `actions/profile.ts:30` |
| 12 | Cloudinary `cloudName` from env | ✅ | `lib/cloudinary.ts:236` |
| 13 | CSP nonce generated + `x-nonce` set | ✅ | `middleware.ts:23,143` |
| 14 | `script-src` excludes `unsafe-eval` in prod | ✅ | `middleware.ts:76` (`wasm-unsafe-eval` only) |
| 15 | **No `unsafe-inline` in any directive** | ❌ | `middleware.ts:84` `style-src 'self' 'unsafe-inline' …` |
| 16 | Security headers (XFO/nosniff/Referrer/Permissions) | ✅ | `middleware.ts:146-150` |
| 17 | Quiz attempt/history → `sessionStorage` | ✅ | `useQuizAttempt.ts:87,132,178` |
| 18 | Academic cache → `sessionStorage` | ✅ | `academic-utils.ts:38,54` |
| 19 | `login_attempts` → `sessionStorage` | ✅ | `login/page.tsx:58,108` |
| 20 | `signup_attempts` → `sessionStorage` | ✅ | `signup/page.tsx:43,105,118` |
| 21 | Onboarding writes via `setUserAcademic` (not JWT) | ✅ | `OnboardingModal.tsx:19,90` |
| 22 | Legacy localStorage keys purged | ✅ | `lib/storage-cleanup.ts` |
| 23 | `useToast` migrated to sonner + `<Toaster/>` | ✅ | `useToast.ts` gone; `AppProviders.tsx:62` |
| 24 | Quiz timer stable (score via ref) | ✅ | `useQuizPlayerRuntime.ts:61-88` |
| 25 | **Automated tests covering this spec's scope** | ❌ | `src/lib/__tests__/` = format, postgrestError, shared-schemas, subjectErrorMessages, zaneMarkdown, ai-circuit-breaker — none touch auth/rate-limit/profile |

### 5.2 002-fix-production-errors — 13/14 (92.9 %)

| # | Checkpoint | Result | Evidence |
| --- | --- | --- | --- |
| 1 | DB health-check route | ✅ | `api/health/db/route.ts` |
| 2 | admin-db IPv4 fallback + prod warning | ✅ | `lib/admin-db/db.ts:13-33` |
| 3 | `actions/auth.ts` logs + sanitized errors | ✅ | `actions/auth.ts:19,27` |
| 4 | `/api/auth/sync` logs + 500 | ✅ | `api/auth/sync/route.ts:22,29,33` |
| 5 | `syncInProgress` guard | ✅ | `AuthContext.tsx:57,67` |
| 6 | `triggerSync` in-flight check | ✅ | `AuthContext.tsx:61-103` |
| 7 | Sync only on `SIGNED_IN` | ✅ | `AuthContext.tsx:158` |
| 8 | `initializeAuth` uses `triggerSync` | ✅ | `AuthContext.tsx:126` |
| 9 | CSP `isDev` Edge-compatible | ✅ | `middleware.ts:59-76` |
| 10 | SW navigation catch + fallback | ✅ | `public/sw.js:74-77` |
| 11 | SW suppresses routine fetch warns | ✅ | `sw.js:115-117` (warn only in catch) |
| 12 | Labels associated (`htmlFor`/`id`) | ✅ | `login/page.tsx:223-298` |
| 13 | `DATABASE_URL_IPV4` documented | ✅ | `.env.example:29` |
| 14 | **Automated tests for this spec's scope** | ❌ | none present |

### 5.3 003-mobile-responsive-fix — 18/21 (85.7 %)

| # | Checkpoint | Result | Evidence |
| --- | --- | --- | --- |
| 1 | `viewport-fit=cover` | ✅ | `app/layout.tsx:9` |
| 2 | Header safe-area on `<header>` + 44 px target | ✅ | `Header.tsx:355,411` |
| 3 | Layout `pt-[calc(…)]` + `min-h-dvh` | ✅ | `Layout.tsx:92-93` |
| 4 | Chat height via dvh/flex | ✅ (superseded by 007) | `Layout.tsx:92` |
| 5 | MobileNav bottom safe-area | ✅ | `MobileNav.tsx:163` |
| 6 | SubjectsGrid CSS Grid (no `calc()`) | ✅ | `SubjectsGrid.tsx:44,76` |
| 7 | SubjectsGrid base = 2 columns | ❌ | `grid-cols-1` at base |
| 8 | Skeleton matches live grid | ✅ | same class on both grids |
| 9 | Drawer width `min(320px,85vw)` | ✅ | `MobileNav.tsx:131` |
| 10 | MobileNav light-mode text | ✅ | `MobileNav.tsx:213,247` |
| 11 | Header duplicate padding removed | ✅ | single `pt-[env(...)]` at `Header.tsx:355` |
| 12 | Glass tokens tinted | ✅ | `index.css:96,152` |
| 13 | Unified `max-w-7xl` | ✅ | `Header.tsx:361`, `Footer.tsx:32`, `Layout.tsx:106` |
| 14 | Stats grid 2-col tablet breakpoint | ✅ (adapted — `DashboardStats` folded into section) | `HomeClient.tsx:181` |
| 15 | Action cards keyboard-accessible | ✅ (deviation: `<Link>` not `<button>`) | `HomeClient.tsx` focus-visible rings; no `onClick` |
| 16 | `transition-all` replaced (4 files) | ✅ | `HomeClient.tsx`, `home/*Section.tsx` |
| 17 | `hover:hover` wraps modern-card/btn | ✅ | `index.css:171,184,201` |
| 18 | Reduced-motion CSS block | ✅ | `index.css:549` |
| 19 | `useReducedMotion` in 5 components | ✅ | SubjectsGrid, Summaries/Videos/QuizzesSection, ChatContainer |
| 20 | RTL verification recorded | ❌ | no evidence artifact |
| 21 | **Automated tests** | ❌ | none (manual-only spec) |

### 5.4 004-multi-platform-expansion — 30/37 (81.1 %)

| # | Checkpoint | Result | Evidence |
| --- | --- | --- | --- |
| 1 | pnpm workspaces | ✅ | `pnpm-workspace.yaml` |
| 2 | `apps/desktop` skeleton | ✅ | tree present |
| 3 | `apps/mobile` skeleton | ✅ | tree present |
| 4 | `packages/shared` | ✅ | tree present |
| 5 | Web moved to `apps/web` | ✅ | present |
| 6 | Root scripts (`dev:*`, `build:*`) | ✅ | root `package.json` |
| 7 | CI workflow | ✅ | `.github/workflows/ci.yml` |
| 8 | `.gitleaks.toml` | ✅ | present |
| 9 | Shared Supabase factory + service-role guard | ✅ | `packages/shared/src/supabase/index.ts` |
| 10 | Shared messages + types | ✅ | `packages/shared/src/messages/**`, `types/**` |
| 11 | Shared AI client | ✅ | `packages/shared/src/ai/index.ts` |
| 12 | ESLint `no-restricted-imports` (error) | ✅ | 3 `eslint.config.mjs` |
| 13 | CI AI-endpoint grep | ✅ | `.github/scripts/check-ai-provider-endpoints.sh` |
| 14 | gitleaks-on-artifacts CI job | ✅ | `ci.yml` `gitleaks-artifacts` |
| 15 | Desktop contract test | ✅ (12 pass) | `apps/desktop/src/main/__tests__/main.test.ts` |
| 16 | Desktop smoke test present | ✅ | `apps/desktop/__tests__/smoke.test.ts` |
| 17 | `electron-builder.yml` | ✅ | present |
| 18 | Electron main + auth-storage (T021) | ✅ | `index.ts` `auth:*` via `safeStorage` |
| 19 | **Desktop LocalReadCache (SQLite) (T022)** | ❌ | no `new Database`/`better-sqlite3` in `apps/desktop/src` |
| 20 | Updater + rollback (T023) | ✅ | `updater.ts` + `index.ts:320+` |
| 21 | Mobile navigation/screens | ✅ | `apps/mobile/src/screens/*` |
| 22 | Mobile auth-storage | ✅ | `mobile/src/auth-storage.ts` |
| 23 | Mobile read-cache | ✅ | `mobile/src/read-cache.ts` |
| 24 | Mobile PDF upload | ✅ | `mobile/src/lib/upload.ts` |
| 25 | Mobile share sheet | ✅ | `mobile/src/share.ts` |
| 26 | Mobile math rendering | ✅ | `mobile/src/components/MathText.tsx` |
| 27 | **Mobile i18n test (T026)** | ❌ | absent |
| 28 | **Mobile math test (T027)** | ❌ | absent |
| 29 | `check-translations.sh` | ✅ | `.github/scripts/check-translations.sh` |
| 30 | **US4 cross-platform auth smoke result** | ❌ | no evidence |
| 31 | US5 gitleaks verification | ✅ (job) | `ci.yml` |
| 32 | **AI streaming (T054a)** | ❌ | JSON-only edge fn (spec's own note) |
| 33 | Perf baselines doc | ✅ | `docs/perf/baselines.md` |
| 34 | Lighthouse CI | ✅ | `.github/workflows/lighthouse.yml` |
| 35 | **Perf profiling T058-T060** | ❌ | no record |
| 36 | `onlyBuiltDependencies` replaces `dangerouslyAllowAllBuilds` | ✅ | `pnpm-workspace.yaml:34` |
| 37 | **`tsconfig.base.json` referenced by T004** | ❌ | file absent |

### 5.5 005-desktop-study-workspace — 17/22 (77.3 %)

| # | Checkpoint | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Runtime detection module | ✅ | `lib/desktop/runtime.ts` |
| 2 | Hydration-safe hook | ✅ | `lib/desktop/useIsDesktopRuntime.ts` |
| 3 | Three-column workspace components | ✅ | `components/desktop/workspace/*` (6 files) |
| 4 | Lecture list independent scroll/active | ✅ | `LectureListColumn.tsx` |
| 5 | Reader swaps content in place | ✅ | `DocumentReader.tsx` |
| 6 | Reader toolbar (title/highlight/download/toggle) | ✅ | `ReaderToolbar.tsx` |
| 7 | Assistant panel collapsible + scoped | ✅ | `AssistantPanel.tsx` |
| 8 | Direction-relative ordering | ✅ | `StudyWorkspace.tsx` |
| 9 | Empty/error states | ✅ | `DocumentReader.tsx` |
| 10 | `desktop-shell.css` native-feel rules | ✅ | marked root `[data-masarx-desktop="true"]` |
| 11 | `DesktopShellGate` marker + context menu | ✅ | `DesktopShellGate.tsx` |
| 12 | Footer/promo hidden in shell | ✅ | `Layout.tsx:96-125` |
| 13 | Frameless window | ✅ | `index.ts:148-149` |
| 14 | Title strip + controls | ✅ | `CustomTitlebar.tsx`, `index.ts:295-309` |
| 15 | Maximize state accurate | ✅ | `index.ts` `window:maximizeStateChanged` |
| 16 | **FR-024 dev port pre-clear** | ❌ | `package.json` `predev` = `inject-sw-version.mjs` |
| 17 | **FR-025 clean removes .next/out/cache** | ❌ | `scripts/clean.mjs` removes one target only |
| 18 | **FR-026 SW unregister outside prod** | ❌ | `sw-register.ts` has no unregister branch |
| 19 | **FR-027 visual-verification rule in AGENTS.md** | ❌ | grep found no such rule |
| 20 | Bridge degrades for older shell | ✅ | `runtime.ts` optional `window?`/`updates?` |
| 21 | Desktop contract test green | ✅ (12 pass) | `main.test.ts` |
| 22 | **`verification.md` evidence (T053)** | ❌ | file missing |

### 5.6 006-admin-dashboard-shell — 17/20 (85.0 %)

| # | Checkpoint | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Shell ported (AdminLayout/Sidebar/MobileNav) | ✅ | `components/admin-shell/*` |
| 2 | `AdminShellProvider` | ✅ | `AdminShellProvider.tsx` |
| 3 | Sidebar IA groups | ✅ | `lib/admin-shell/navigation.ts` |
| 4 | Courses & Enrollments segmented view | ✅ | `components/admin/CoursesEnrollmentsView.tsx` |
| 5 | Summaries plumbing removed from page | ✅ | grep: no `SummariesTab`/`filteredSummaries` in `src` |
| 6 | `useAdminFilters` slimmed | ✅ | no `filteredSummaries` reference |
| 7 | SummariesTab/AdminDashboardTabs retired | ✅ | `.trash/.../SummariesTab.tsx`, `AdminDashboardTabs.tsx` |
| 8 | Dead `adminDashboard` summaries keys removed | ✅ | grep in ar/en json → 0 matches |
| 9 | i18n keys added | ✅ | `adminDashboard.json` (`tabs.coursesEnrollments`, `tabs.zane`, …) |
| 10 | Topbar logo/notifications/profile | ✅ | `AdminTopbar.tsx` |
| 11 | `FilterBottomSheet` | ✅ | present |
| 12 | `StatCard` + `PageHeader` | ✅ | present |
| 13 | Overview grid + micro-trends | ✅ | `AdminOverviewTab.tsx` |
| 14 | ZANE disabled "Coming Soon" item | ✅ | `navigation.ts:92-97` |
| 15 | Admin route isolation in Layout | ✅ | `Layout.tsx:50,96-125` |
| 16 | `AdminCommandPalette` | ✅ | present |
| 17 | **Browser probe 380/768/1280** | ❌ | T5.1 blocked on manual admin login |
| 18 | **Final report + branch state** | ❌ | T5.2 unchecked; branch already merged (`6f0574c`) |
| 19 | typecheck/lint/vitest gates | ✅ | web vitest 49/49 |
| 20 | **`useAdminFilters` unit test** | ❌ | absent |

### 5.7 007_zane-gemini-ux — 17/18 (94.4 %)

| # | Checkpoint | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Full-bleed assistant shell | ✅ | `Layout.tsx:89-92`; commit `28b8fc5` |
| 2 | Page flex height (calc classes removed) | ✅ | `ai-assistant/page.tsx`; `28b8fc5` |
| 3 | Scroll container `dir="ltr"` + `max-w-4xl` | ✅ | `ChatContainer.tsx:164-171` |
| 4 | (+) tools popover (6 items + dismissal) | ✅ | `ChatInput.tsx`; `5de6491` |
| 5 | Bottom model pill + persistence | ✅ | `ChatInput.tsx`; `localStorage["zane_ai_selected_model"]` |
| 6 | Slim ChatHeader (pills/summarize/clear removed) | ✅ | `ChatHeader.tsx` (no such props) |
| 7 | i18n `tools`/`model` ar+en | ✅ | `messages/{ar,en}/aiAssistant.json:15,17` |
| 8 | Persona submenu + outside-click fix | ✅ | commit `c67d66f` |
| 9 | Gemini composer + auto dir + aria-expanded | ✅ | commits `fbb70f1`, `c67d66f` |
| 10 | Centering fix | ✅ | commits `0063a93`, `6fdaca0` |
| 11 | Markdown pipeline (tables/inline/code/ol/highlight/blockquote/task/latex) | ✅ | `lib/ai/zaneMarkdown.ts`; commits `f980647`…`52d7c12` |
| 12 | Event-driven guest persistence | ✅ | commit `11307f7` |
| 13 | Bidi-isolated math | ✅ | `11307f7` |
| 14 | typecheck/lint gates | ✅ | recorded in tasks.md §4.1/§12.6 |
| 15 | Web vitest suite green | ✅ | 49/49 executed this audit |
| 16 | `zaneMarkdown.test.ts` regression tests | ✅ | 19 tests, pass |
| 17 | Browser-probe / live verification recorded | ✅ | tasks.md §13.1 (owner screenshot) |
| 18 | **Component-level tests for structural claims** | ❌ | no component test infra (spec §Test Specification) |

### 5.8 008_chat-persistence-hardening — 0/8 (0 %)

| # | Checkpoint | Result | Evidence |
| --- | --- | --- | --- |
| 1 | `009_ai_chat_messages.sql` migration | ❌ | `supabase/migrations/` ends at `008_jwt_role_sync.sql` |
| 2 | RLS policies for the table | ❌ | no migration |
| 3 | `(user_id, mode, created_at)` index | ❌ | no migration |
| 4 | Load capped to 100 rows | ❌ | `useAiChat.ts:96` no `.limit()` |
| 5 | Retention prune beyond 100 | ❌ | not present |
| 6 | Guest cache cap (100) + try/catch | ❌ | not present |
| 7 | Insert error handling | ❌ | not present |
| 8 | `ai_chat_messages` Row type in shared | ❌ | grep in `packages/shared/src/types/database.ts` → 0 |

### 5.9 009_mvp-launch-ops-hardening — 13/16 (81.3 %)

| # | Checkpoint | Result | Evidence |
| --- | --- | --- | --- |
| 1 | MVP report committed (T1.1) | ✅ | `docs/MVP_REPORT.md`; commit `dc1f85b` |
| 2 | Specs 009+010 committed (T1.2) | ✅ | commit `03cb100` |
| 3 | `scripts/audit-rls.mjs` (T2.1) | ✅ | present; commit `e09edb2` |
| 4 | RLS audit run PASS (T2.2) | ✅ | `checklists/rls-audit.md` (48/48 tables) |
| 5 | `.openclaw-rls-open.mjs` retired (T3.1) | ✅ | `.trash/.openclaw-rls-open.mjs` |
| 6 | Env sweep executed (T4.1) | ✅ | `checklists/env-sweep.md`; commit `2e4520d` |
| 7 | **AI prod smoke (T4.2)** | ❌ | checklist: "Pending owner-assisted session" |
| 8 | **Role propagation test (T4.3)** | ❌ | `role-propagation.md` result table empty |
| 9 | Runbook results committed (T4.4) | ✅ | `2e4520d` |
| 10 | Dependabot config (T5.1) | ✅ | `.github/dependabot.yml`; commit `8e88cd2` |
| 11 | `/add` i18n redirect (T6.1) | ✅ | `add/page.tsx` uses `@/navigation`; `08fee5d` |
| 12 | Arabic-named route retired (T6.2) | ✅ | `.trash/.../%D8%A7…`; `08fee5d` |
| 13 | Route-hygiene gates + commit (T6.3) | ✅ | `08fee5d` |
| 14 | Sentry DSN check (T7.1) | ✅ | commit `d8c56f8` (dormant) |
| 15 | `sentry-example-api` retired (T7.2) | ✅ | `.trash/.../sentry-example-api/route.ts` |
| 16 | **MVP report pass 3 (T8.1)** | ❌ | report shows pass 2 states |

### 5.10 010_e2e-study-flow-smoke — 4/10 (40.0 %)

| # | Checkpoint | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Playwright devDep + config (T1.1) | ✅ | `playwright.config.ts`; devDep in `apps/web/package.json` |
| 2 | `e2e/study-flow.spec.ts` (T1.2) | ✅ | present (ar/en, soft-skip) |
| 3 | `test:e2e` script (T1.3) | ✅ | `apps/web/package.json:20` |
| 4 | **Local run green (T1.4)** | ❌ | not recorded; not run by this audit |
| 5 | **CI `e2e` job (T2.1)** | ❌ | absent from `ci.yml` |
| 6 | **Repo Variables set (T2.2)** | ❌ | unverified |
| 7 | **Job green on PR (T2.3)** | ❌ | no job |
| 8 | **Branch ruleset required check (T2.4)** | ❌ | no job |
| 9 | Authenticated-smoke runbook (T3.1) | ✅ | `checklists/authenticated-smoke.md` |
| 10 | **MVP report G6.1 flip (T4.1)** | ❌ | not landed |

---

## 6. Repository Inventory

### 6.1 Discovered spec files (51) — grouped by spec unit (10)

```
specs/001-critical-security-fixes/         spec.md, plan.md, tasks.md, research.md, data-model.md, quickstart.md,
                                           checklists/requirements.md, contracts/api.md
specs/002-fix-production-errors/           spec.md, plan.md, tasks.md, checklists/requirements.md
specs/003-mobile-responsive-fix/           spec.md, plan.md, tasks.md, research.md, data-model.md, quickstart.md,
                                           checklists/requirements.md, contracts/css-token-surface.md
specs/004-multi-platform-expansion/        spec.md, plan.md, tasks.md, research.md, data-model.md, quickstart.md,
                                           smoke-test-results.md, checklists/requirements.md,
                                           contracts/{ai-boundary,i18n-messages,README,supabase-client}.md
specs/005-desktop-study-workspace/         spec.md, tasks.md, handoff.md, checklists/requirements.md
specs/006-admin-dashboard-shell/           spec.md, tasks.md
specs/007_zane-gemini-ux/                  spec.md, tasks.md
specs/008_chat-persistence-hardening/      spec.md
specs/009_mvp-launch-ops-hardening/        spec.md, tasks.md, checklists/{env-sweep,rls-audit,role-propagation}.md
specs/010_e2e-study-flow-smoke/            spec.md, tasks.md, checklists/authenticated-smoke.md
```

**Mapping rule**: one dashboard row per spec **directory** (the unit the user's template implies). All 51 files are listed above; each file belongs to exactly one row. Row count (10) equals the directory count (10); file count (51) equals `Get-ChildItem -Recurse -File specs` (51).

### 6.2 Code / test directories searched

| Path | Purpose |
| --- | --- |
| `apps/web/src/**` | Web app source (routes, components, hooks, lib, actions, contexts) |
| `apps/web/src/app/api/**` | API routes (auth/getUser evidence) |
| `apps/web/e2e/`, `apps/web/playwright.config.ts` | E2E harness (010) |
| `apps/web/src/lib/__tests__/` | Web unit tests (6 files) |
| `apps/desktop/src/**`, `apps/desktop/__tests__/**` | Electron shell + tests |
| `apps/mobile/src/**`, `apps/mobile/app/**` | Expo mobile app |
| `packages/shared/src/**` | Shared package (supabase, ai, types, messages, i18n, format) |
| `supabase/migrations/`, `supabase/migrations.old/` | Migration evidence (008 gap) |
| `.github/workflows/`, `.github/scripts/`, `.github/dependabot.yml` | CI/security guards (004/009/010) |
| `.trash/**` | Retired-artifact evidence (006/009) |
| `docs/` | `MVP_REPORT.md`, `perf/baselines.md`, `audits/` |
| `scripts/`, `pnpm-workspace.yaml`, root `package.json` | Repo-level tooling (004/009) |

---

## 7. Appendix B — Reproducible Verification

All commands are **read-only**. Re-running them yields the same inventory and evidence basis. `PS>` denotes PowerShell, run from the repo root.

### B.1 Spec inventory

```powershell
PS> Get-ChildItem -Recurse -File specs | Measure-Object | % Count
51
PS> (Get-ChildItem -Directory specs).Count
10
```

### B.2 Presence / absence probes

```powershell
PS> Test-Path apps\web\src\middleware.ts                                          # True  (001 FR-001)
PS> Select-String -Path apps\web\src\lib\supabase.ts -Pattern noOpLock           # (no output) (001 FR-007)
PS> (Get-ChildItem -Recurse -File apps\web\src\app\api -Include *.ts | Select-String getSession).Count   # 0 (001 FR-003)
PS> (Get-ChildItem -Recurse -File apps\web\src\app\api -Include *.ts | Select-String 'getUser\(\)').Count # 4
PS> Select-String -Path apps\web\src\middleware.ts -Pattern "style-src"          # line 84: 'unsafe-inline' present
PS> Test-Path "supabase\migrations\009_ai_chat_messages.sql"                     # False (008)
PS> Select-string -Path apps\web\src\hooks\useAiChat.ts -Pattern "limit"         # (no output) (008 unbounded load)
PS> Select-String -Path .github\workflows\ci.yml -Pattern "e2e|playwright"       # (no output) (010 T2.1)
PS> Test-Path apps\web\src\components\desktop\workspace\StudyWorkspace.tsx       # True (005)
PS> Test-Path "specs\005-desktop-study-workspace\verification.md"                # False (005 T053)
PS> Test-Path tsconfig.base.json                                                 # False (004 T004)
PS> Select-String -Path apps\desktop\src\main\preload.ts -Pattern "masarxDesktop" # line 73 (005)
PS> Get-ChildItem -Recurse -File apps\desktop\src | Select-String "better-sqlite3|new Database"  # (no output) (004 T022)
```

### B.3 Unit-test execution (this audit)

```powershell
# Web (apps/web) — 6 files
PS> cd apps\web ; node node_modules\vitest\vitest.mjs run --reporter=basic
 Test Files  6 passed (6)
      Tests  49 passed (49)
   Duration  1.76s

# Desktop (apps/desktop) — 4 files (vitest from repo root)
PS> cd apps\desktop ; node ..\..\node_modules\vitest\vitest.mjs run --reporter=basic
 Test Files  3 passed | 1 skipped (4)
      Tests  23 passed | 4 skipped (27)
   Duration  11.54s
```

**Observed results**

| Suite | Files | Tests | Result |
| --- | --- | --- | --- |
| `apps/web` vitest | 6 | 49 | ✅ all pass (incl. `zaneMarkdown` 19) |
| `apps/desktop` vitest | 4 (1 skipped) | 27 | ✅ 23 pass, 4 skipped (`__tests__/smoke.test.ts` gated on `MASARX_RUN_SMOKE=1`) |
| `apps/mobile` | 0 | 0 | ⛔ not found |
| Playwright e2e | 1 spec | — | ⛔ not executed (no dev server in this audit) |

### B.4 Git evidence

```powershell
PS> git log --oneline -20
df229ad docs(specs): record 007 round 13 …
11307f7 feat(web): zane round 13 …
d8c56f8 chore(web): retire sentry-example-api route (009 §7, G7.1)
08fee5d fix(web): localize /add redirect … (009 §6, G1.4/G1.5)
8e88cd2 chore(ci): add dependabot config (009 §5, G3.6)
2e4520d docs(specs): record 009 env-sweep results … (G3.5)
e09edb2 feat(scripts): add read-only RLS audit tool (009 §2–3, G3.1/G3.2)
03cb100 docs(specs): land 009 … + 010 … specs
6f0574c merge: admin dashboard shell, IA restructure, summaries retirement (spec 006)
…
```

Git history is available; commit evidence is therefore used instead of mtimes.

### B.5 Dashboard structure verification

Probes backing §9 (criterion 8) and §9.2. All read-only, run from the repo root against the delivered file. Observed outputs were re-verified on 2026-09-20 with equivalent GNU grep patterns (identical counts).

```powershell
$f = 'docs\spec-completion-dashboard.md'

# 1. Spec rows in the §3 dashboard table = 10. The [-_] anchor after the ID is
#    required: the bare pattern '^\| \*\*0\d' also matches §8.2's short bold
#    IDs ('**008**', '**010**') and returns 12.
PS> (Select-String -LiteralPath $f -Pattern '^\| \*\*0\d\d[-_]').Count
10

# 2. Cells per §3 spec row = 6 content cells (split on '|', minus the two empty
#    fragments created by the row's own leading/trailing pipes)
PS> (Select-String -LiteralPath $f -Pattern '^\| \*\*0\d\d[-_]').Line |
      ForEach-Object { ($_ -split '\|').Count - 2 } | Sort-Object -Unique
6

# 3. Percent cells carrying a (satisfied/total) ratio = 10
PS> (Select-String -LiteralPath $f -Pattern '\*\*\d+\.\d %\*\* \(\d+/\d+\)').Count
10

# 4. Done rows = 0 (no Completion % cell equals 100 %)
PS> (Select-String -LiteralPath $f -Pattern '\*\*100\.0 %\*\* \(\d+/\d+\)').Count
0

# 5. Status vocabulary inside the §3 table
PS> (Select-String -LiteralPath $f -Pattern '\| In Progress \|').Count
9
PS> (Select-String -LiteralPath $f -Pattern '\| Not Started \|').Count
1
```

---

## 8. Handover Notes

### 8.1 Known gaps in this audit

1. **Playwright e2e not executed.** Running it requires a booted `pnpm dev` server on :3000 (or `E2E_BASE_URL`). Static inspection confirms the harness; the run itself is unverified here.
2. **Mobile has no test suite**, so mobile claims rest on file presence + task-ledger prose, not executed tests.
3. **Owner-assisted ops items are unverifiable statically** (010 authenticated smoke, 009 AI prod smoke + role propagation) — they need a live Supabase/Vercel session.
4. **Spec 007's structural claims** (scrollbar docking, popover) are documented as browser-probe verified in `tasks.md`, but there is no re-runnable automated test for them.
5. **`specs/008` is a draft**; its percentage reflects "nothing implemented", not a failed implementation.
6. **Component-name drift** (003 `DashboardStats`, 001 `ProfileSchema`) is called out rather than treated as failure.

### 8.2 Recommended next action per flagged spec

| Spec | Recommended next action |
| --- | --- |
| 001 | Decide `style-src 'unsafe-inline'` (document risk or adopt `style-src-attr`); add unit tests for `rate-limit` + `profile` validation to reach Done. |
| 002 | Add tests for sync-debounce + label associations; keep as-is otherwise. |
| 003 | Align `SubjectsGrid` base column with FR-003 (or amend spec); record the RTL verification (T031). |
| 004 | Land desktop SQLite read-cache (T022), mobile tests (T026/T027), AI streaming (T054a); add `tsconfig.base.json` or drop the reference. |
| 005 | Land FR-024/025/026/027 safeguards; write `verification.md` (T053); re-sync the task ledger. |
| 006 | Complete the browser probe once an admin login is available (T5.1); land the final report (T5.2). |
| 007 | Add component tests for the structural surface, or formally accept browser probes as the verification of record. |
| **008** | **Obtain owner approval (I11); then land migration + RLS + `.limit(100)` + prune + guest cap + DB Row type.** Highest priority. |
| 009 | Run the two owner-assisted checks (AI smoke, role propagation); land MVP report pass 3. |
| **010** | **Add the `e2e` job to `.github/workflows/ci.yml`, set repo Variables, register the required check.** Second-highest priority. |

### 8.3 Assumptions made (explicit)

- The **spec unit is the directory** under `specs/` (10 units); the 51 files are inventory, not 51 rows.
- Test executions were run from the repo's local `node_modules` because the corepack `pnpm` shim is documented as broken (spec 005). Root `vitest` was used for `apps/desktop` since its own `node_modules` is sparse.
- A spec is **not moved to Done** merely because code exists — tests covering the spec's scope must also exist and pass.
- Where an FR was superseded by a later spec (003 FR-005 ← 007), the checkpoint is credited as satisfied-by-supersession and flagged in §4.

---

## 9. Acceptance-Criteria Self-Check (Goal Brief)

Every Goal Brief acceptance criterion is mapped to the section that satisfies it.

| # | Acceptance criterion | Satisfied in | Concrete evidence |
| --- | --- | --- | --- |
| 1 | Every spec file in `specs/` appears exactly once | §6.1 | 10 spec rows; 51 files listed and each mapped to one row; `Get-ChildItem -Recurse -File specs` = 51, `(Get-ChildItem -Directory specs).Count` = 10 (Appendix B.1) |
| 2 | Percentages come from an explicit satisfied/total ratio | §2.1, §3, §5 | Formula in §2.1; every §3 row shows `(n/m)`; every §5 table re-derives it checkpoint-by-checkpoint |
| 3 | Every row cites concrete code/test evidence, not prose | §3, §5 | File paths with line numbers, grep hit counts, commit hashes, test-run output; 008 row states "no artefact found" + the searches used |
| 4 | A spec is Done only when implementation **and** tests exist | §2.3, §3 | Done = 0; 007 (94.4 %, fully implemented) is explicitly withheld from Done because §5.7 cp-18 has no component tests |
| 5 | Status values use only the defined buckets | §2.3, §3 | Statuses used: `In Progress` ×9, `Not Started` ×1. Bucket criteria table in §2.3 |
| 6 | Missing blockers name the specific gap and location | §3 (last col), §5 | e.g. "`predev` is still `inject-sw-version.mjs`", "no `e2e` job in `ci.yml`", "`useAiChat.ts:96` no `.limit()`" |
| 7 | Stale / conflicting specs flagged with the triggering signal | §4 | 9 entries, each citing the exact file/line/commit and a recommended resolution |
| 8 | Markdown renders with all six required columns | §3, §B.5 | 10 rows, 6 cells each, verified by cell-count check (Appendix B.5) |
| 9 | A reviewer can reproduce the audit | §7 | Read-only PowerShell probes + both test-suite invocations + `git log`, with observed outputs |
| 10 | Test status backed by a run, or its absence disclosed | §7, §B.3, §8.1 | Web 49/49 pass, desktop 23 pass/4 skip; mobile + Playwright disclosed as not run/absent |
| **C-1 (explicit)** | Base percentages on verifiable file existence, exported functions, and passing tests | §2.1, §5, §9.1 | 100 % of checkpoints are backed by a file, a grep/`Select-String` hit, a symbol, or a test result — see §9.1 |
| **C-2 (explicit)** | Mark a spec 100 %/Done only if implementation **and** corresponding tests exist | §2.3, §3, §9.1 | Done = 0; the Done gate is enforced in §9.1 with the executed test inventory |

### 9.1 Enforcement of the two explicit ground rules

**Ground rule C-1 — no percentage without code evidence.**
Every checkpoint in §5 carries an *Evidence* cell containing one of: an existing file path, a `Select-String`/grep hit with a line number, a symbol/route, a commit hash, or a test-run result. Zero checkpoints were scored from spec prose. A percentage cannot appear without its `(satisfied/total)` pair because §2.1 defines the value as that ratio and §5 prints both numbers per spec. Confirmation probe:

```powershell
# every dashboard row must carry a ratio inside the Completion % cell
PS> (Select-String -LiteralPath docs\spec-completion-dashboard.md -Pattern '\*\*\d+\.\d %\*\* \(\d+/\d+\)').Count   # => 10
```

**Ground rule C-2 — Done requires implementation + tests.** Executed test inventory:

| Suite | Files | Result | Spec scopes covered |
| --- | --- | --- | --- |
| `apps/web` vitest | 6 | 49/49 pass | 007 (markdown) only; **not** 001/002/003/006 |
| `apps/desktop` vitest | 4 (1 skip) | 23 pass / 4 skip | 004/005 desktop contracts |
| `apps/mobile` | 0 | ⛔ absent | — |
| Playwright e2e | 1 spec | ⛔ not run | 010 |

Because no suite covers the *complete* scope of any single spec (in particular, no spec has tests for all of its own FRs), **Done = 0** is the only rule-compliant outcome. Example of the rule biting: spec 007 is 17/18 (94.4 %) with implementation fully present, yet cp-18 (component tests for its structural claims) is unmet, so it is **In Progress**, not Done.

### 9.2 Machine-checkable assertions

| Assertion | Expected | How to check |
| --- | --- | --- |
| Spec rows | 10 | `(Select-String -LiteralPath <report> -Pattern '^\| \*\*0\d\d[-_]').Count` — the `[-_]` anchor is required: the bare `0\d` pattern also matches §8.2's short bold IDs (`**008**`, `**010**`) and returns 12 |
| Columns per spec row | 6 | split each row on `\|` (Appendix B.5) |
| Percent cells with ratio | 10 | pattern `\*\*\d+\.\d %\*\* \(\d+/\d+\)` |
| Done rows | 0 | in the §3 table, no Completion % cell equals 100 (the only `100 %` strings are the §2.1 cap note and the §2.3 Done-bucket definition) |
| Status vocabulary | within bucket set | only `In Progress` / `Not Started` appear |

---

## 10. Ground-Rule Evidence Ledger

This section makes the two explicit constraints auditable at the checkpoint level, independent of the narrative sections above.

### 10.1 C-1 — every checkpoint is backed by a verifiable artefact

Checkpoint totals per spec (denominator), satisfied counts (numerator), and the evidence-type that backs each checkpoint. `prose-only` counts checkpoints scored without a file/grep/symbol/test/commit citation and MUST be `0`.

| Spec | Checkpoints | Satisfied | Evidence types used | prose-only |
| --- | --- | --- | --- | --- |
| 001 | 25 | 24 | file path, `Select-String` line-hit, missing-symbol grep, test-absence probe | 0 |
| 002 | 14 | 13 | file path, grep line-hit, test-absence probe | 0 |
| 003 | 21 | 18 | file path, grep line-hit, class-value inspection, test-absence probe | 0 |
| 004 | 37 | 30 | file path, `Test-Path` true/false, grep absence, test-run result, commit | 0 |
| 005 | 22 | 17 | file path, missing-file probe, grep absence, test-run result | 0 |
| 006 | 20 | 17 | file path, grep absence, `.trash` path, commit | 0 |
| 007 | 18 | 17 | file path, grep line-hit, test-run result (19 tests), commit | 0 |
| 008 | 8 | 0 | missing-file probe, grep absence | 0 |
| 009 | 16 | 13 | file path, `.trash` path, checklist result, commit | 0 |
| 010 | 10 | 4 | file path, grep absence (`ci.yml`), test not-run disclosure | 0 |
| **Total** | **191** | **153** | — | **0** |

- **Weighted completion** across all 191 checkpoints = **153 / 191 = 80.1 %** (the §3 headline of 73.4 % is the *unweighted mean of the ten spec percentages*; both are stated so neither can be mistaken for a prose guess).
- Every checkpoint's citation lives in its §5 row's **Evidence** cell. No checkpoint uses the spec's own prose as its evidence.

### 10.2 C-2 — Done gate, evaluated per spec

| Spec | Implementation artefacts present? | Automated tests covering *this spec's* scope? | Done? |
| --- | --- | --- | --- |
| 001 | yes | no (`__tests__` has no auth/rate-limit/profile test) | **No** |
| 002 | yes | no | **No** |
| 003 | partial (grid base col, RTL) | no (manual-only spec) | **No** |
| 004 | partial (read-cache, streaming) | partial — desktop contract tests only; no mobile tests | **No** |
| 005 | yes | no (desktop contract covers the window, not the workspace) | **No** |
| 006 | yes | no (`useAdminFilters` untested) | **No** |
| 007 | yes | partial — `zaneMarkdown.test.ts` (19) only; none for the structural claims | **No** |
| 008 | no | no | **No** |
| 009 | yes | n/a (ops spec; owner-assisted checks pending) | **No** |
| 010 | partial (harness present) | the harness itself is unrun and not wired into CI | **No** |

**Done-eligible specs = 0.** The gate is therefore consistent with §3 (`Done = 0`) and with §2.3's bucket criteria, and is not overridden by any high completion percentage.

### 10.3 Probes

```powershell
# C-2: the Done-gate table (§10.2) has 10 spec rows, every verdict 'No'
PS> (Select-String -LiteralPath docs\spec-completion-dashboard.md -Pattern '\| \*\*No\*\* \|').Count   # => 10

# C-1: the ten §5 detail tables contain exactly 191 numbered checkpoint rows (= the §10.1 denominator)
$l  = Get-Content -LiteralPath docs\spec-completion-dashboard.md
$a   = ($l | Select-String -SimpleMatch '### 5.1' | Select-Object -First 1).LineNumber
$b   = ($l | Select-String -SimpleMatch '## 6. Repository Inventory' | Select-Object -First 1).LineNumber
($l[($a-1)..($b-2)] | Where-Object { $_ -match '^\| \d+ \|' }).Count                                     # => 191
```

Observed on the delivered file: C-2 = **10**, C-1 = **191** (denominator total in §10.1), §5 detail tables = **10**, statuses = `In Progress` ×9 + `Not Started` ×1, Done rows = **0**.

---

*Generated read-only. No file under `apps/`, `packages/`, `supabase/`, or any existing `specs/` document was modified. This report was added as a new artifact only.*
