# MasarX — Spec-to-Implementation Traceability Matrix

**Date**: 2026-08-31 · **Scope**: every task and FR in `specs/001..004` (163 task IDs, 56 FRs) mapped to implementation status and evidence.
**Legend**: ✅ DONE · 🟡 PARTIAL/EQUIVALENT (intent met, deviation documented) · ⏸ DEFERRED (external dependency, reason given) · ❌ MISSING.
**Evidence key**: [A1]=subagent_01.md (spec 001 audit) · [A2]=subagent_02.md (spec 002) · [A2b]=subagent_02b.md (spec 003) · [A3]=subagent_03.md (spec 004) · [FL]=fix-log_*.md · [V]=verification report (live evidence).

> Spec paths `src/**` map to `apps/web/src/**` since the monorepo move (Spec 004 T005).

## Spec 001 — Critical Security & Stability (46 tasks, FR-001..FR-013)

| Task | Status | Evidence |
|---|---|---|
| T001 branch | 🟡 | Work delivered on main working tree (pre-existing uncommitted state preserved); commit plan in handover report |
| T002/T003 env+KV | ✅/🟡 | `.env.example` documents NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, UPSTASH_*, SENTRY_DSN [A1][FL]; Vercel KV not provisioned → Supabase `rate_limits` tier implemented instead (data-model alternative) |
| T004 middleware | ✅ | `apps/web/src/middleware.ts` active (build output "ƒ Proxy (Middleware)") [V] |
| T005 ProfileSchema | ✅ | `src/lib/validation/profile.ts` (zod; fullName letters-only regex verified live — rejects digits) [A1][V] |
| T006 rate-limit | ✅ | `src/lib/rate-limit.ts`: Upstash REST → Supabase `rate_limits` (006 schema) → in-memory; fail-open; consumers awaited [FL] |
| T007–T012 route protection + CSP + headers | ✅ | nonce-based CSP live, no unsafe-inline/eval; X-Frame-Options DENY etc. captured live [V] |
| T011a nonce propagation | ✅ | `x-nonce` header + CSP nonce observed live [V] |
| T013–T016 logger | ✅ | `src/lib/logger.ts`: error/warn forwarded to Sentry envelope (SENTRY_DSN), 5s abort, info/debug dev-only [FL] |
| T017–T020 getUser + noOpLock | ✅ | `auth-route-check --scan-api`: 7 API routes, **0 getSession**, exit 0 [V] |
| T021–T024 AI endpoint | ✅ | `/api/ai/chat` + `/api/ai-chat` proxy: getUser 401, rate limit (retryAfter), prompt validation ≤10k [A1][V] |
| T025–T028 profile validation | ✅ | ProfileSchema integrated; client-side safeParse on profile page (server action upserts all fields — documented deviation) [A1][FL]; cloudinary env var |
| T029–T034 storage migrations | ✅ | sessionStorage for quiz/history/academic/login/signup + real-key cleanup (`masarx_user_academic_cache`) [A1][FL] |
| T035–T037 onboarding→profiles | ✅ | OnboardingModal reads `useUserAcademic()`, writes via `setUserAcademic`; migration script `scripts/migrate-academic-metadata.mjs` (dry-run validated live: 17 users, 10 with metadata, 5 mapped) [FL] |
| T038 quiz timer | ✅ | useRef pattern in `useQuizPlayerRuntime.ts` [A1] |
| T039a/T039/T040 sonner | ✅ | sonner Toaster mounted; useToast.ts deleted; consumers migrated [A1] |
| T041 typecheck | ✅ | `pnpm --filter web typecheck` exit 0 [V] |
| T042 build | ✅ | `pnpm --filter web build` exit 0 (all routes) [V] |
| T043 manual checklist | ✅ | executed via browser automation [V] (middleware, AI endpoint, profile validation) |
| T044 CSP headers | ✅ | headers captured live on production server [V] |
| T045 env docs | ✅ | `.env.example` complete [FL] |
| T046 auth-route-check | ✅ | `--scan-api` mode added; live run PASS [V] |

**FRs**: FR-001 ✅ · FR-002 ✅ (warn+error forwarded; zero silent failures) · FR-003 ✅ (verified live) · FR-004 ✅ (10/min; double-count bug fixed) · FR-005 ✅ (schema live-rejects invalid input) · FR-006 ✅ (nonce CSP live; `style-src 'unsafe-inline'` documented risk acceptance — AppProviders inline style; flagged in handover) · FR-007 ✅ · FR-008 ✅ (**live-verified**: onboarding wrote level=2/semester=1 to profiles, not JWT) · FR-009 ✅ · FR-010 ✅ (sonner) · FR-011 ✅ · FR-012 ✅ (sessionStorage; PII-free) · FR-013 ✅ (env var).

## Spec 002 — Fix Production Errors (17 tasks, FR-001..FR-007)

| Task | Status | Evidence |
|---|---|---|
| T001 health/db | ✅ | `/api/health/db` live: 200 {"status":"healthy","database":"connected"} [V] |
| T002 admin-db | ✅ | pooler warnings + graceful pool errors [A2] |
| T003/T004 auth logging | ✅ | server-side detail + sanitized client responses [A2] |
| T005–T008 sync guard | ✅ | `syncInProgress` ref + SIGNED_IN-only + guarded initial sync; **live: exactly one /api/auth/sync call, 200** [V] |
| T009–T010 CSP eval | ✅ | Edge-robust isProd; `wasm-unsafe-eval` prod, blanket dev-only; live header confirms [A2][V] |
| T011–T012 service worker | ✅ | silent nav fallback + suppressed noise (sw.js + sw.template.js) [A2] |
| T013–T014 form a11y | ✅ | live DOM audit: **0 missing id/name, 0 unlabeled** on login; G1–G4 fixed across profile/AddVideoForm/add-summary/radios/LectureSelect [A2][FL][V] |
| T015 smoke tables | 🟡 | harness documented; full production log review is post-deploy work |
| T016 README note | ✅ | `.env.example` + SETUP notes document DATABASE_URL_IPV4 [A2] |
| T017 Vercel logs | ⏸ | requires deployed Vercel environment (external) |

**FRs**: FR-001 ✅ (live) · FR-002 ✅ (live: single sync call) · FR-003 ✅ · FR-004 ✅ (live) · FR-005/006 ✅ (live audit) · FR-007 ✅.

## Spec 003 — Mobile Responsive Fix (32 tasks, FR-001..FR-013)

| Task | Status | Evidence |
|---|---|---|
| T001 baseline | ✅ | build exit 0 pre/post [A2b] |
| T002/T003 viewport-fit | ✅ | `viewportFit:"cover"` in app/layout.tsx [A2b] |
| T004/T012/T014 header | ✅ | safe-area on `<header>`, w-11 hamburger, max-w-7xl, no dup padding [A2b] |
| T005 layout | ✅ | `min-h-dvh` + `pt-[calc(72px+env(safe-area-inset-top))]` [A2b] |
| T006 ai-assistant | ✅ | dvh-based chat wrapper (calc offset), loading-state `min-h-screen` swept to dvh-safe [A2b][FL] |
| T007 drawer safe-area bottom | ✅ | `pb-[max(1.5rem,env(safe-area-inset-bottom))]` added [FL] |
| T008/T009 grid | ✅ | `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` live+skeleton; live grid resolves at 375 viewport [V] |
| T010 drawer cap | ✅ | `w-[min(320px,85vw)]`; **live: 272px drawer, 48px backdrop at 320px** [V] |
| T011 nav tokens | ✅ | Entity-2 classes applied (spec-over-design flagged: cyan active style replaced) [FL] |
| T013 glass tokens | ✅ | tinted slate/navy values, exact data-model match [A2b] |
| T015/T016 max-width | ✅ | footer + main max-w-7xl [A2b] |
| T017–T019 HomeClient | ✅ | sm:grid-cols-2; cards are `<Link>` with aria-label + focus-visible:ring (equivalent-or-better than button; navigation semantics) [A2b] |
| T020–T022 transitions | ✅ | targeted transition lists on cards; residual CTA transition-all also fixed [FL] |
| T023 hover:hover | ✅ | wrapped [A2b] |
| T024 reduced motion | ✅ | global 0.01ms block at file end [A2b] |
| T025–T029 framer-motion | ✅ | all 5 components gated (no stagger/whileHover when reduced) [A2b] |
| T030–T032 polish/RTL/build | ✅/⏸ | RTL-safe patterns verified statically (logical props) + build exit 0; full device pass deferred with reason |

**FRs**: FR-001 ✅ · FR-002 ✅ (21 occurrences swept to `min-h-dvh-safe` 100vh+100dvh) · FR-003 ✅ (live) · FR-004 ✅ (**live: 272px/48px**) · FR-005 ✅ · FR-006 ✅ (implemented beyond original branch scope; SC-008 satisfied) · FR-007 ✅ (`text-primary-foreground` token added to Tailwind config; 5 CTAs converted; icon hover whites intentionally kept) · FR-008 ✅ · FR-009 ✅ · FR-010 ✅ · FR-011 ✅ (consolidated) · FR-012 ✅ · FR-013 ✅.

## Spec 004 — Multi-Platform Expansion (68 tasks, FR-001..FR-023)

| Task | Status | Evidence |
|---|---|---|
| T001–T008 monorepo | ✅ | pnpm-workspace + root scripts + ci.yml jobs (ESLint, next-build, workspaces, ai-endpoint-grep, gitleaks-artifacts, docs-lint, **translations**, **test**) [A3][FL] |
| T009 supabase factory | ✅ | service_role guard, runtime env source; **mobile branch accepts injected storage adapter** [A3][FL] |
| T009 client-info header | 🟡 | `__clientInfo` attached as property; real HTTP header injection deferred (documented) [A3] |
| T010/T039 shared messages | ✅ | 43 namespaces × ar/en in packages/shared; web consumes via next-intl dynamic imports; no local messages dir (guard passes) [A3][V] |
| T011 types+zod | ✅ | packages/shared/src/types [A3] |
| T012 ai client | ✅ | sendAiMessage + streamAiMessage (SSE parser) [A3] |
| T013 eslint guard | ✅ | web flat config (error) + NEW desktop/mobile flat configs [FL] |
| T014 ai-endpoint grep | ✅ | script + CI job (required-check registration = manual repo setting, documented) [A3] |
| T015/T049–T051 gitleaks | ✅ | allowlist no longer exempts dist/build/out/.next; CI job scans artifacts [FL] — gitleaks binary not installed locally (CI runs it) |
| T040/T039/T042 i18n | ✅ | NEW `packages/shared/src/i18n` (t(), registry, en-fallback, dev warn) + `./i18n` export; typecheck clean [FL][V] |
| T017–T025 desktop | ✅ | main/auth-storage/read-cache/updater/menu + tests; v0.5.9 NSIS shipped; T025 PASS recorded [A3] |
| T028–T030 mobile config | ✅ | app.json/app.config.js/eas.json/tsconfig/metro/package.json (SDK 51 dep set) [FL] |
| T031–T037 mobile app | ✅/⏸ | 20+ source files (auth SecureStore, read-cache AsyncStorage, i18n ar/en+RTL, subjects/summaries/quizzes/AI/profile screens, PDF upload → summaries-pdfs bucket, share sheet, KaTeX WebView, offline banner) — typecheck **0 errors** after @types/react 19 alignment; device/store smoke ⏸ external |
| T038 translations guard | ✅ | script + CI job; live run exit 0 [V] |
| T043–T048 auth continuity | ✅/⏸ | desktop inherent (same Next server); web E2E live-verified [V]; mobile ⏸ device |
| T049–T053 guards verify | ✅ | eslint configs + grep script + artifact scanning in CI [FL] |
| T054 ai-chat chokepoint | ✅ | Edge Function + proxy (pre-existing) [A3] |
| T054a SSE streaming | ✅ | `text/event-stream` + generateContentStream + delta/[DONE] frames field-matched to shared parser; **proxy forwards Accept + streams unbuffered** [FL] |
| T055 RLS verify | ✅ | `supabase/tests/rls-verify.sql` (catalog assertions all public tables + drift sweep + security_invoker + per-table JWT templates) + README [FL] |
| T056 runbook | ✅ | docs/security/secret-leak-runbook.md [FL] |
| T057 lighthouse | ✅ | .github/workflows/lighthouse.yml (weekly + dispatch, 5-pt regression rule) [FL] |
| T058–T060 device profiling | ⏸ | needs reference hardware/device (methods documented) |
| T061/T064 baselines | ✅ | docs/perf/baselines.md (methods + recorded facts + TBD device rows) [FL] |
| T062–T063 contributing/releases | ✅ | CONTRIBUTING verified; docs/releases/TEMPLATE.md [FL] |
| T066 dependabot | 🟡 | flagged for release notes (123 advisories pre-existing) |
| T067 allowBuilds | ✅ | pnpm-workspace.yaml allowBuilds map; `neverBuiltDependencies: better-sqlite3` intentional (electron-builder compiles it) — documented |
| T068 web build fix | ✅ | global-error.tsx functional component; build exit 0 [V] |

**FRs**: FR-001 🟡 (installer builds; signing pending certs) · FR-002–005 ✅ · FR-006–012 ✅ code-complete (store/device work ⏸) · FR-013 ✅ · FR-014 ✅ (web live-verified; desktop inherent; mobile code-ready) · FR-015/016 ✅ · FR-017 ✅ (guards enforced; artifact scan meaningful) · FR-018 ✅ (harness; policies in migrations) · FR-019 ✅ (proxy rate limits; Supabase tier) · FR-020 ✅ · FR-021 ✅ · FR-022 🟡 (mobile build requires `pnpm install` completion) · FR-023 ✅.

## Deferred summary (nothing silently dropped)

1. Code-signing certs / notarization / App Store + Play submission — requires paid accounts & certs (SC-001 partial, SC-002/SC-011).
2. Real-device smoke + perf profiling (T030–T032 device pass, T058–T060) — no devices in this environment; methods documented in docs/perf/baselines.md.
3. Vercel production log review (spec 002 T017) — post-deploy task.
4. gitleaks local run — binary absent; CI job covers it.
5. Desktop local node_modules junction repair — `cmd /c rmdir "apps\desktop\node_modules\masarx-shared"` then `pnpm install --frozen-lockfile` (interrupted mobile install artifact; automated delete blocked by safety policy this session).
6. CSP `style-src 'unsafe-inline'` — documented risk acceptance (AppProviders inline style); move to CSS file to drop it.
7. Shared package `typecheck` script fails locally due to a dangling symlink from an interrupted install (sources verified clean via web tsc, exit 0); full repair = clean reinstall of node_modules.
