# Enhancement Plan — Performance Audit 2026-11-02

> Distilled from the 20 domain reports in `findings/`. Priorities: **P0** = fix before launch (user-visible breakage), **P1** = significant measurable win, **P2** = hygiene/efficiency (execute opportunistically). Every item cites its evidence file. **All items are recommendations — this audit changed no code.** Per I11, each implemented track needs an approved spec; under the MVP Lock only the P0 wave is launch-eligible without an owner decision.

## Wave 0 — P0 (fix before next desktop release / launch)

| # | Item | Fix | Effort | Evidence |
| --- | --- | --- | --- | --- |
| 0.1 | **Packaged app's image optimizer is broken** — 0 libvips DLLs in the traced standalone; every `/_next/image` URL 500s in the installed Electron app | Add `outputFileTracingIncludes: {"/**": ["./node_modules/@img/sharp-win32-x64/**"]}` to `next.config.mjs`; verify one `/_next/image` fetch from a packaged `win-unpacked` build | S | [18 PKG-1](./findings/18-desktop-packaging.md) |
| 0.2 | **`PageTransition ssr:false` ships an empty `<main>` on ~30 routes** — root cause of ai-assistant LCP 9.06s, quiz-play LCP 5.86s, and the footer CLS 0.89–0.92 on 4 routes | Remove `ssr:false` from the PageTransition dynamic import (framer-motion SSRs fine); **re-diagnose the 2026-09-16 useRouter-RSC crash with a cold `.next` first** — it was real but its root cause was never isolated; fix that instead of the blanket workaround | M | [04 SPLIT-1/2](./findings/04-splitting-streaming.md) |
| 0.3 | **No loading skeletons anywhere** (after 0.2 lands they become effective) | One `loading.tsx` per heavy route: quiz-play, ai-assistant, subjects/[subject], quizzes, profile, news | S each | [04 SPLIT-2](./findings/04-splitting-streaming.md) |

Wave 0 combined effect: LCP 9.06s → ~2-3s and CLS 0.89 → <0.1 on the measured routes; packaged images functional.

## Wave 1 — P1 workstreams (ordered by measured payoff)

### WS1 — Payload & hydration weight (web) — targets quizzes TBT 2.08s, ai-assistant 1390 KB

1. Dynamic-import the 11 admin tabs/modals (`admin-dashboard/page.tsx`) — [09 ADMIN-1](./findings/09-admin.md) · M
2. Defer `useSubjects`/`useQuizzes` on ai-assistant until LocalQuizPreviewModal opens; dynamic-import LottiePlayer call sites; lazy MobileNav — [04 SPLIT-3](./findings/04-splitting-streaming.md), [01 BUNDLE-2/3](./findings/01-bundle-dependencies.md) · S–M
3. Static-avatar for non-latest chat bubbles (kills N dotlottie WASM loops); stabilize `onUiMessage`/`onRetry` identities; skip highlight+repair passes while streaming — [06 CHAT-1/2/3/7](./findings/06-ai-chat.md) · S–M
4. Slim the RSC payload: pass `{id, email, role}` instead of the full Supabase user; pass a chrome-subset of i18n namespaces to `NextIntlClientProvider` — [04 SPLIT-4/5](./findings/04-splitting-streaming.md) · S–M

### WS2 — Per-request server cost (web) — targets the 0.81s localhost floor

1. Proxy: `getClaims()` local JWT verification instead of per-request `getUser()` network call — [08 MID-1](./findings/08-middleware-i18n.md) · M
2. Dedupe auth: `cache()`d `getCachedUser()` shared by layouts; drop the admin-layout re-gate; `Promise.all(getMessages, getUser)` in `[locale]/layout.tsx` — [08 MID-2](./findings/08-middleware-i18n.md), [12 QUERY-1](./findings/12-query-waterfalls.md) · S–M
3. Scope the i18n `fs` fallback to dev-only (clears the whole-project tracing warning; also shrinks standalone by ~23 MB via PKG-3a) — [08 MID-3](./findings/08-middleware-i18n.md), [18 PKG-3](./findings/18-desktop-packaging.md) · S

### WS3 — Client data sanity (web) — targets over-fetch + duplicate round-trips

1. Cap/limit the unbounded fetches: quizzes page full-table select (limit 60 + narrow columns), lecture content 400/400/400/500 → lecture-scoped query, admin `quizzes_with_ratings` limit 50 — [02 FETCH-1/2](./findings/02-client-fetching.md), [09 ADMIN-3](./findings/09-admin.md) · S
2. Kill the duplicate bootstrap round-trips: `useNotifications` reads user from context (2× `getUser()` per mount), skip `/api/auth/sync` when `initialProfile` was provided, singleton notification channel — [16 AUTH-1/2/3](./findings/16-auth-session.md) · S–M
3. Parallelize the waterfalls: course detail 6→2 awaits, quiz getQuiz 2→1, summary detail, resolveSubjectAndLecture — [12 QUERY-2/3/4/5](./findings/12-query-waterfalls.md) · S
4. Migrate the 3 remaining `queryCache` consumers to TanStack; delete dead cacheKeys/TTLs; memoize TRW hook clients — [02 FETCH-4/5](./findings/02-client-fetching.md) · M

### WS4 — Desktop size & startup — targets 248 MB standalone → ~85 MB, ≥500 ms off cold start

1. `outputFileTracingExcludes` for non-win32 sharp binaries (with 0.1's include); electron-builder filter as belt-and-suspenders — [18 PKG-2](./findings/18-desktop-packaging.md), [17 DESKTOP-2](./findings/17-desktop-coldstart.md) · S
2. Replace the blind 500 ms server wait with a port-readiness probe; `backgroundColor` + `ready-to-show` window gate; defer the first updater check — [17 DESKTOP-1/3/4/5](./findings/17-desktop-coldstart.md) · S–M
3. Instrument cold-start breadcrumbs + record first baseline in `docs/perf/baselines.md` (plan included in the report) — [17 DESKTOP-5](./findings/17-desktop-coldstart.md) · S

### WS5 — Database (single migration batch, via `apply_migration`)

1. Add: `reviews(summary_id)`, `reviews(quiz_id)`, `enrollments(course_id)`, `quiz_attempts(user_id, created_at DESC)`, `audit_logs(user_id)`, `news(is_active, created_at DESC)`, `quizzes(status, created_at DESC)` + hygiene FKs — [11 DB-1..9](./findings/11-db-indexes.md) · S
2. RLS rewrites: `(select auth.uid())` / `(select is_admin())` initplans on summaries/quizzes + hot tables; hoist quiz_questions correlated EXISTS; drop duplicate policies/indexes/triggers — [15 RLS-1/2/5/6/7/9](./findings/15-rls.md) · S–M
3. `rate_limits`: single-upsert `check_rate_limit` + pg_cron retention sweep — [15 RLS-3/4](./findings/15-rls.md) · S–M

### WS6 — Edge functions

 1. Un-retire the Gemini model pins (`gemini-pro`/`gemini-2.0-flash-exp` → current model via one env-backed constant) — [13 EDGE-1](./findings/13-edge-functions.md) · S
 2. upload-file: `AbortSignal.timeout` instead of header-only race; data-URI upload instead of base64 loop; add rate limit — [13 EDGE-2/3/4](./findings/13-edge-functions.md) · S

### WS7 — Web re-render hygiene (one spec, mechanical)

 1. `useMemo` AuthContext value + skip-unchanged auth events; memo+useCallback quiz grid; useCallback admin handlers; PlatformSettings silent background refresh — [03 RENDER-1/2/3/6](./findings/03-rendering.md) · S each

## Wave 2 — P2 (opportunistic; full list in each findings file)

Highlights only: dead `trackEvent` excision (55 refs, [14 ANALYTICS-4](./findings/14-analytics.md)); dead RPC drop ([14 ANALYTICS-1](./findings/14-analytics.md)); unused deps (`uuid`, 2 Vite plugins, date-fns, [01 BUNDLE-4/5/6](./findings/01-bundle-dependencies.md)); gitignored 5.7 MB lottie artifact to `.trash/` ([05 ASSET-1](./findings/05-assets-media.md)); font `preload:true` ([05 ASSET-3](./findings/05-assets-media.md)); YouTube iframe lazy ([05 ASSET-4](./findings/05-assets-media.md)); SW stable cache name + offline fallback ([10 CACHE-1/2](./findings/10-pwa-caching.md)); proxy matcher additions (`llms.txt`, Google verification — [08 MID-5](./findings/08-middleware-i18n.md)); differential updates in CI ([18 PKG-4](./findings/18-desktop-packaging.md)); mobile splash hold + MathText local KaTeX + i18n registry slim ([19 MOBILE-1/2](./findings/19-mobile-startup.md), [20 MDATA-1](./findings/20-mobile-data.md)); header-authority consolidation ([10 CACHE-5](./findings/10-pwa-caching.md)).

## Measurement discipline (applies to every wave)

- Re-run the audit's Lighthouse set (same 7 routes) before/after each wave; record medians in `docs/perf/baselines.md` §3 with evidence paths.
- Wire the two dormant gates: Lighthouse CI weekly job (set `LHCI_BASELINE_*` vars to this audit's numbers) and the desktop cold-start breadcrumb harness (WS4).
- Bundle: `pnpm --filter web analyze` (webpack mode) before/after WS1; standalone `du` after WS4.
- DB: `EXPLAIN (ANALYZE, BUFFERS)` before/after WS5 on summaries/quizzes/notifications hot paths; `pg_stat_user_indexes.idx_scan` before any index drop.
