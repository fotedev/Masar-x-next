# Spec 033 — Wave 1A Performance: Quiz Surfaces Server Data + Request-Path Quick Wins

> | | |
> |---|---|
> | **Branch** | `fix/033-wave1a-perf` |
> | **Created** | 2026-11-03 |
> | **Status** | Approved (owner plan approval 2026-11-03) |
> | **Type** | `fix`/`perf` — Wave 1A of the 2026-11-02 performance audit enhancement plan |
> | **Input** | `docs/perf/audit-2026-11-02/` — spec 032 deferred items (quiz-play LCP 5.58s, quizzes CLS 0.798) + MID-2 (P1) + MID-3 (P1) |

## Problem

Spec 032 removed the empty-`<main>` SSR gap, but two routes still gate their meaningful content on **client-side data fetch after hydration**:

1. **quiz-play LCP 5.58s** (audit target ≤3.5s, still unmet): the whole page is `"use client"`; `QuizPlayer` blocks on `useQuizPlayerData` → `quizService.getQuiz` (two serial browser queries, `lib/quiz.ts:183-195`) before `QuizPlayerStart` can paint. `QuizPlayer` already accepts inline data as props (local-quiz path, `useQuizPlayerData.ts:43-60`) — the server-fetch path just needs feeding.
2. **quizzes CLS 0.798**: the entire dashboard is wrapped in `dynamic(() => Promise.resolve(...), { ssr: false })` (`quizzes/page.tsx:69-76`, comment: "prevent hydration mismatches") — zero dashboard SSR; after hydration it swaps spinner → `QuizzesLoading` skeleton → real grid (heights differ).

Plus two per-request server costs that tax **every** route (audit MID-2/MID-3):
3. `[locale]/layout.tsx:91-96` serializes `getMessages` → `getUser`; the nested admin layout repeats `getUser` (+ admins query) — 2-3 auth roundtrips per authenticated render.
4. `i18n/request.ts` keeps a prod-reachable `fs` fallback (line 177) whose unresolvable path makes Next trace the whole project into the standalone output (the build warning; ~23 MB junk: `coverage/` 19 MB, `src/`, configs).

## Scope

**In:**
- **A — quiz-play RSC**: page becomes an async server component; `Promise.all` fetch of quiz + questions via the cookie-bound server client (`lib/supabase/server.ts`); payload passed as props into `QuizPlayer` (new `initialQuiz` prop in the raw getQuiz shape); server-rendered not-found; client attempt flow untouched (guests create nothing).
- **B — quizzes SSR + initialData**: re-diagnose the "hydration mismatch" claim cold (spec-032 method) before removing the `ssr:false` wrapper; move `QuizDashboardInternal` to `_components/QuizDashboard.tsx` (client); `page.tsx` becomes an async server component fetching approved quizzes (`status='approved'` explicit — server client may carry user cookies; matches the client default view) passed as `initialQuizzes`; `useQuizzesData` seeds state from props with `loading=false`, client `loadQuizzes` retained (admin refresh).
- **C — MID-2 auth dedupe**: `Promise.all([getMessages, getUser])` in `[locale]/layout.tsx`; new `cache()`-wrapped `getCachedUser` in `lib/supabase/server.ts` shared by the locale + admin layouts.
- **D — MID-3 i18n fs**: static `fs/promises`/`path` imports → dynamic inside `readNamespaceFromDisk`; prod catch-fallback disk read removed (prod loader failures fall through to the existing English fallback).

**Out (non-goals):**
- RSC conversion of subjects/news/profile/etc. (later waves).
- Subjects server-fetch on the quizzes page (TanStack-cached client-side; subjects only filter).
- DB migrations (WS5), edge functions (WS6), desktop cold-start (WS4) — separate tracks.
- Quiz-attempt/grading logic (spec 030 landed, `ff83e66`).

## Contracts

- `QuizPlayer` props gain optional `initialQuiz?: { quiz: QuizRow; questions: QuestionRow[] } | null` (raw snake_case DB rows, exactly what `lib/quiz.ts getQuiz` returns — NOT the local-`quizData` camelCase shape, which stays separate).
- `useQuizzesData` options gain optional `initialQuizzes?: QuizRow[]`; returned API unchanged.
- New server helper `getCachedUser()` in `lib/supabase/server.ts` (React `cache()` around `createClient().auth.getUser()`).
- `quizzes/_components/QuizDashboard.tsx` exports the client dashboard; `page.tsx` becomes the async server component. No public URL/param changes.

## Behavior preservation & regression strategy

- **Quiz surfaces RLS**: anon reads approved-only (`baseline.sql:4173`), questions of approved quizzes (4168) — guests see exactly what they see today; authed users read own-or-approved (4183) unchanged. Server client is cookie-bound; service-role client is forbidden here (would leak drafts).
- **Hydration-mismatch re-diagnosis (Track B)**: cold-dev experiment removing the wrapper first, with the dashboard rendering from server props; if a mismatch reproduces, root-cause before proceeding; **fallback** = keep the wrapper and accept a partial CLS fix (min-height reservation), recorded in acceptance.
- **Admin full-list refresh**: server seed is the approved default view; when `isAdmin` resolves client-side, `loadQuizzes(true)` refetches the unfiltered list (existing behavior).
- Playwright `guest-quiz.spec.ts` (guest quiz-play flow, no attempts) + `study-flow`/`subjects-catalog`/`trw-gate` must stay green; vitest 286 green.
- The i18n change removes a prod error path only (bundled static imports cannot realistically fail); English fallback ordering preserved.

## Test specification

1. Build: `pnpm --filter web build` green; tracing warning GONE from the build log; standalone `du` ≥20 MB smaller than the 248 MB audit number.
2. Lighthouse mobile, same 7 routes: quiz-play LCP ≤2s (from 5.58s); quizzes CLS <0.3 (from 0.798); ai-assistant LCP ~1.4s, news CLS ~0.005, subjects/landing/login no regression.
3. curl smoke: `/ar/quiz-play/7bbf857a-…` HTML contains the quiz start-card content (server-rendered, anon); `/ar/quizzes` HTML contains card markup; admin-dashboard still redirects non-admins.
4. vitest green; Playwright e2e green.
5. Fallbacks (if any experiment fails) recorded in Acceptance.

## Acceptance (measured 2026-11-03)

- [x] **Track A (quiz-play)** — start card server-renders for anon (title + start button verified as DOM text in curl HTML); LCP 5.58s → 5.23s, CLS 0.317 → 0.173, perf 61 → 69. Target ≤2s **not fully met**: the remaining LCP is not network- or hydration-gated (no framer-motion in quiz-player, all requests done by ~1s) and needs its own attribution pass — recorded for the next wave.
- [x] **Track B (quizzes)** — **implemented, measured, then reverted (95804f1)**. Root cause found by measurement: the anon grid is scoped by an academic subject allow-list whose subjects query depends on client-side context (`useEffectiveSemester` from platform settings + academic profile) — during SSR the allow-list is empty, so the seeded grid rendered the empty state and the real grid painted only after hydration + subjects fetch (LCP 4.5s despite CLS 0.000). Full-grid SSR requires server-side academic scoping → **Wave 2**. The "hydration mismatch" fear in the old comment did NOT reproduce (zero mismatch warnings through the whole experiment). Quizzes returns to the pre-033 measured state (LCP 1.36s, CLS 0.770–0.798, perf 64–66).
- [x] **Track C (MID-2)** — `getCachedUser` dedupes the locale + admin layouts; `Promise.all(getMessages, getUser)` in the locale layout.
- [x] **Track D (MID-3)** — static fs imports removed + dev-only disk read + `turbopackIgnore` on the call site (Turbopack flags even dynamic fs access; its own warning prescribes the comment). **Tracing warning gone; standalone 248 MB → 52 MB.**
- [x] Suites: vitest **286/286**; Playwright e2e **10 passed + 1 flake re-passed** (`study-flow` "subject detail opens — en" clicked the home hero AI card before subject cards mounted — race in the test's `.first()` locator, green on isolated re-run; the `ar` twin passed both times).
- [x] New finding documented (pre-existing, not a regression): `/ar/news` CLS **0.490 reproducible ×5** (vs the 032-era single-run 0.005) — mechanism is `news/page.tsx:325-331` rendering `<Image fill>` without a sized/aspect container, so card images resize rows post-load and shift the footer; the 032-era 0.005 coincided with a low-data fetch (805-byte news response). Goes to the Wave 1 deferred list with its mechanism.
- [ ] CI green on the PR (pending push).
