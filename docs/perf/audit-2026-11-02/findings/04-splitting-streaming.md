# 04 — Code Splitting, Lazy Loading & Route-Level Streaming

> Subagent auditor #4, 2026-11-02. Domain: apps/web dynamic imports, loading.tsx/streaming, whole-page "use client" pattern. Coordinator spot-check: SPLIT-1's `Layout.tsx:23-26` and children-through-PageTransition (115-119) verified verbatim; SPLIT-2's zero `loading.tsx` confirmed by two auditors independently.

## Findings

### [SPLIT-1] PageTransition `ssr:false` strips ALL page content out of server HTML on ~30 routes — root cause of both measured LCPs and zero streaming

- **P0 · Impact H** — Every non-light, non-admin route passes `children` (the page itself) through a `dynamic(..., { ssr: false })` wrapper with no loading fallback, so the server HTML `<main>` is empty. LCP therefore waits for: JS download → hydration → client data fetch. This is exactly the measured /ar/quiz-play 5.86s and /ar/ai-assistant 9.06s pattern, and why no route can stream or prerender.
- Evidence:
  - `apps/web/src/components/Layout.tsx:23-26` — `const PageTransition = dynamic(() => import("./PageTransition").then((m) => m.PageTransition), { ssr: false });`
  - `apps/web/src/components/Layout.tsx:115-119` — all non-light routes render `{children}` inside `<PageTransition>`
  - `apps/web/src/components/PageTransition.tsx:15-29` — the component is only a framer-motion `AnimatePresence`/`motion.div` with `initial={{opacity:0}}`; framer-motion SSRs fine (initial opacity becomes inline style). The `ssr:false` is a workaround for a useRouter-in-RSC crash documented at `Layout.tsx:109-114` — that crash needs separate diagnosis, it is not inherent to framer-motion.
- Current: blank `<main>` in HTML for every content route. · **Fix**: remove `ssr:false` (plain dynamic import, SSR enabled) so PageTransition + children render server-side; re-verify the assistant-route crash. · **Effort M**

### [SPLIT-2] Zero `loading.tsx` in the app — and they are currently ineffective because of SPLIT-1

- **P0 · Impact H** — `find src/app -name loading.tsx` returns nothing (verified). Every page hand-rolls a post-hydration spinner instead (`QuizPlayer.tsx:108-121`, `news/page.tsx:162-168`, `QuizzesLoading`). Because `loading.tsx` output flows through the `ssr:false` PageTransition too, adding them before SPLIT-1 buys nothing — fix SPLIT-1 first, then skeletons actually stream in HTML. The measured CLS 0.889–0.917 comes from this same hole: `Footer` IS server-rendered (`Layout.tsx:125`, plain client-component SSR) while `<main>` is empty, so the footer paints near the top and shifts down when hydrated content grows.
- Current: no streaming boundaries at all. · **Fix**: after SPLIT-1, add one `loading.tsx` skeleton per heavy route (quiz-play, ai-assistant, subjects/[subject], quizzes, profile, news) — static JSX, no data. · **Effort S** each

### [SPLIT-3] 29 of 40 pages are whole-page `"use client"` with client-side data fetching — no meaningful server content anywhere

- **P1 · Impact H** — Verified list includes every offender. What a server skeleton/boundary gives each top offender (per measured numbers):
  - `quiz-play/[quizId]/page.tsx:1-19` — client page rendering `QuizPlayer`, which blocks on `useAuth` + `useQuizPlayerData` before anything paints (`QuizPlayer.tsx:108-121` spinner). Server skeleton = immediate LCP paint; best long-term: server-fetch the quiz via the existing RPC (spec 030) and pass as props.
  - `ai-assistant/page.tsx:1,124-127` — fires `useSubjects()` AND `useQuizzes()` Supabase queries on mount just for the local-quiz preview feature, in addition to chat history load; direct contributor to 9.06s LCP. Minimal fix: defer those two hooks until `LocalQuizPreviewModal` opens.
  - `subjects/[subject]/page.tsx:1,47-48` — `loading=true` state + client supabase queries; whole subject dashboard post-hydration.
  - `quizzes/page.tsx` — dashboard is itself double-lazy (SPLIT-7) plus `useSubjects` + `useAcademicOptions`.
  - `profile/page.tsx:1,29-33` — auth + academic hooks client-side.
- Current: HTML = header strip + footer only. · **Fix**: skeletons now (S); convert read-only, non-personalized pages to RSC: `subjects/page.tsx` (static grid), `news/page.tsx`, `faq/page.tsx`, `privacy-*` (pure static but currently client) — fetch server-side, keep small interactive islands client. · **Effort M–L**

### [SPLIT-4] Full Supabase `User` object serialized into every route's RSC payload

- **P1 · Impact H** (multiplied by every route being dynamic) — `[locale]/layout.tsx:93-96,131-134` fetches `supabase.auth.getUser()` and passes the raw `user` to `<AppProviders>` → `AuthContext` (`AppProviders.tsx:29`, `AuthContext.tsx:40-53`). The Supabase User carries `app_metadata`, `user_metadata`, `identities[]`, `factors[]`, timestamps — several KB embedded in every page, while consumers (Header, profile) only need `id`, `email`, `app_metadata.role`, and the already-separate profile row.
- Current: full auth object per request. · **Fix**: pass a slimmed `{id, email, role}` to the provider; read the rest from client Supabase when needed. · **Effort S**

### [SPLIT-5] Entire i18n catalog (~180KB ar / 145KB en raw JSON, 47 namespaces) serialized into every page

- **P1 · Impact M** — `[locale]/layout.tsx:91` calls `getMessages()` (all namespaces) and passes the whole object to `NextIntlClientProvider` (`layout.tsx:126-130`); `i18n/request.ts` aggregates all 94 loaders (47 per locale). Next-intl supports passing only the namespaces the client tree needs — the entire `adminDashboard`/`addFile`/`aiAssistant` catalogs ship on, e.g., the login page.
- Current: full catalog in every HTML/RSC payload. · **Fix**: pass a chrome-level subset (common/auth/header/footer) to the provider; page-specific namespaces stay server-side or are picked per page. · **Effort M** (needs a namespace-dependency pass)

### [SPLIT-6] Header `ssr:false` — logo/nav absent from first paint

- **P2 · Impact M** — `Layout.tsx:16-21,96`. Header is an ordinary client component (`Header.tsx`, 452 lines) that would SSR fine; `ssr:false` removes it from server HTML. The height-reserved transparent loading fallback prevents header CLS (good), but on light routes (login, faq) the header is a plausible LCP element that arrives only post-JS.
- Current: nav renders after hydration. · **Fix**: drop `ssr:false`, keep the dynamic import (it still code-splits). · **Effort S**

### [SPLIT-7] `quizzes/page.tsx` wraps an in-file component in `dynamic(() => Promise.resolve(...), {ssr:false})` — fake splitting, extra hydration delay

- **P2 · Impact L** — `quizzes/page.tsx:76-84` (`QuizDashboardInternal` defined in the same module). `Promise.resolve` means the chunk is already loaded; the only effect is deferring the dashboard (and even its spinner fallback) until after hydration, worsening quizzes CLS.
- Current: double-lazy no-op. · **Fix**: render `QuizDashboardInternal` directly. · **Effort S**

### [SPLIT-8] `LatexRenderer` recreates its dynamic wrapper on every text change → remounts KaTeX per streamed chunk

- **P2 · Impact M** (quiz-play and AI replies) — `LatexRenderer.tsx:27-35`: `useMemo` deps are `[className, input]`, so the dynamic component identity changes whenever `text` changes, remounting the whole heavy renderer. `LazyMarkdown.tsx:12-17` already fixed this exact bug at module scope ("the previous per-render useMemo ... unworkable once replies stream in chunk by chunk", spec 011) — the same fix is missing here.
- Current: remount per text update. · **Fix**: hoist the `dynamic()` to module scope like LazyMarkdown. · **Effort S**

### [SPLIT-9] PreloadKatex warms only on mount — right route, but no earlier trigger and no preload hints anywhere

- **P2 · Impact L** — `PreloadKatex.tsx:5-11` imports `HeavyLatexRenderer` in `useEffect`; mounted on `quiz-play/[quizId]/page.tsx:5,18`, `quiz-attempts/page.tsx:12,195`, `QuizQuestionEditor.tsx:7,35` — route placement is correct. However a repo-wide grep finds zero `rel="preload"`/`modulepreload`/manual `<link>` in `src/app`, so the KaTeX chunk could start loading at the quiz-listing stage instead of after quiz-play mounts. Given SPLIT-1/2 land first, keep PreloadKatex as-is; optional S-effort add is a preload trigger on the quiz-attempts/quizzes listing.
- Current: chunk warm starts on mount only. · **Fix**: optional idle/hover prefetch from quiz listing surfaces. · **Effort S**

## Healthy areas

- **Modal code splitting is exemplary**: `ai-assistant/page.tsx:35-53` (PuterSettingsModal, LocalQuizPreviewModal ssr:false), `quizzes/page.tsx:28-55` (Import/Form/Delete modals ssr:false) — off the critical path correctly.
- **`LazyMarkdown.tsx:11-17`** — module-scope dynamic with minimal loading placeholder; the correct pattern (and the template for SPLIT-8).
- **`LottiePlayer.tsx:20-30`** — self-hosted WASM via `setWasmUrl` to satisfy CSP, dynamic import of a genuinely heavy dependency.
- **`LatexRenderer.tsx:19-25`** — cheap regex gate so KaTeX only loads when `$`/`$$` present.
- **Suspense discipline** — all `useSearchParams` consumers wrapped (add-video, add-file, edit-summary, reset-password, non-academic/[subject], lectures/[lectureId]).
- **Desktop/admin/assistant chrome isolation** in `Layout.tsx:36-93` is well documented and hydration-safe.
- **`next.config.mjs`** — standalone output, `removeConsole`, image remote patterns configured; images unoptimized only outside production.

## Notes

- SPLIT-1 is the keystone: it explains zero prerendered routes, both LCP outliers, and would invalidate every added `loading.tsx` if left in place. Order of work: SPLIT-1 → SPLIT-2 skeletons on the five measured routes → SPLIT-3 hook deferral on ai-assistant → payload slimming (SPLIT-4/5).
- The useRouter-in-RSC crash noted at `Layout.tsx:109-114` is the stated reason for `ssr:false`; that comment describes Next evaluating a `"use client"` page in the RSC layer during SSR, which is not normal Next behavior — it should be re-diagnosed rather than permanently worked around, since it currently taxes every route for one route's problem. (See audit README Known-issues: this is the documented PageTransition SSR boundary from the 2026-09-16 ZANE session — re-diagnose with a cold `.next` before touching it.)
- All dynamic routes being ƒ is also driven by `supabase.auth.getUser()` + `getMessages()` in `[locale]/layout.tsx` (cookies + catalog on every request); payload slimming reduces cost but routes stay dynamic by design for auth — expected for this app, not a defect per se.
- Message catalog sizes measured via `du -ck` on `packages/shared/src/messages/{ar,en}/*.json`: 180KB / 145KB raw JSON (pre-gzip; Next serializes them near-verbatim into the RSC payload).
