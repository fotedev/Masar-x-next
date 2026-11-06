# Spec 034 — Wave 1B Performance: News Seed, Lecture-Content Scoping, Client Auth Dedupe

> | | |
> |---|---|
> | **Branch** | `fix/034-wave1b-perf` |
> | **Created** | 2026-11-04 |
> | **Status** | Approved (owner plan approval 2026-11-04) |
> | **Type** | `perf`/`fix` — Wave 1B of the 2026-11-02 audit enhancement plan |
> | **Input** | `docs/perf/audit-2026-11-02/` — FETCH-1, AUTH-1/3, RENDER-1, QUERY-2 + the news CLS finding from spec 033's acceptance |
> | **Coordination** | Parallel port agent active (`/materials` surface: Header/FooterLinks/materials route/quizzes seed migration). Zero file overlap; this spec touches NO DB, NO migrations, NO generated types. Claim registered before first edit. |

## Problem

Five verified small fixes remaining in Wave 1 (all re-checked against current main this round):

1. **News CLS 0.490 (×5 reproducible)** — news cards mount client-side post-hydration and grow, shifting the footer (shift source = `<footer>`, 0.485). Correction to the spec-033-era image diagnosis: the `<Image fill>` already sits in an `aspect-video` container (`news/page.tsx:321-323`) — the mechanism is the client-fetch-then-grow pattern, and news has **no academic-scoping wall** (public `is_active` content), so the server-seed pattern applies where quizzes could not.
2. **FETCH-1** — every lecture view downloads up to 1,700 rows (four parallel `.limit(400/400/400/500)` fetches filtered client-side by `lectureMatch`, `useLectureContent.ts:49-77, 84-123`), though all four tables carry `lecture_id`/`lecture_key` with composite `(subject, lecture_id)` indexes (baseline:3780-3783).
3. **AUTH-1** — `useNotifications` calls `supabase.auth.getUser()` (a network roundtrip) 2× per mount (fetchNotifications 29-31 before the cache check; setupRealtime 272-274) plus in markAllAsRead/createNotification, while the server already provides the user.
4. **AUTH-3** — `AuthContext.initializeAuth` (136-143) POSTs `/api/auth/sync` on every mount even when the profile arrived via server props (`initialProfile`), and the `SIGNED_IN` handler (186-193) force-syncs on session recovery, not just genuine sign-ins.
5. **RENDER-1 (recurring)** — `AuthContext` value is an unmemoized literal (340-350), handlers aren't `useCallback`'d, and the auth listener (156-162) calls `setSession`/`setUser` unconditionally on every event including `TOKEN_REFRESHED` — ~35 consumers re-render on every token refresh.
6. **QUERY-2** — `courses/[courseId]/page.tsx` `fetchCourseData` (140-219) runs 6 sequential awaits; only the course fetch gates the rest (publication check).

## Scope

**In:** Tracks A–E below. **Out:** DB/migrations/generated types (port agent's exclusive surface this cycle), quizzes SSR (Wave 2 wall), admin dynamic imports (Wave 2), desktop packaging (PKG-2/DESKTOP-2 **resolved by spec 033 Track D** — standalone 52 MB with win32-only sharp, measured), edge functions.

## Tracks

- **A — news server seed**: `news/page.tsx` → async server component fetching `is_active=true, order created_at desc, limit 30` via `lib/supabase/server`, passing `initialNews` into `useNews` (seed state, `loading=false`, skip mount fetch for the public view; admin `includeInactive` refetch preserved). No allow-list/filters on this path — no spec-033-style wall.
- **B — lecture-content scoping**: `useLectureContent.ts` scoped queries `.or("lecture_id.eq.<id>,lecture_key.eq.<key>")` (+ subject eq; quizzes select adds `lecture_key`). **Fallback:** a scoped table returning empty re-fetches broadly (old `.limit` path) and client-filters — preserving the title-inference legacy matching and the `"other"` default key.
- **C — AUTH-1/3**: `useNotifications` uses `useAuth().user` instead of four `getUser()` roundtrips (cache check moves before auth work); AuthContext mount sync gated on `!initialProfile`; force-sync only on genuine `SIGNED_IN` after `INITIAL_SESSION` (extending `sawInitialSessionRef`).
- **D — RENDER-1**: `useMemo` context value + `useCallback` handlers (`signInWithGoogle`: `locale` + desktop-bridge deps); `TOKEN_REFRESHED` with unchanged user id skips `setSession`/`setUser`.
- **E — QUERY-2**: after the course fetch + publication check, the 5 independent queries run in one `Promise.all`; the four `select("*")` calls narrow to consumed columns.

## Contracts

- `useNews` options gain `initialNews?: NewsRow[] | null`; returned API unchanged.
- `useLectureContent` API unchanged (fallback preserves row shapes; quizzes query adds `lecture_key` to the select).
- `AuthContext` value shape unchanged; only memoization + event-filtering internals change.
- No URL, DB, or public-API changes anywhere.

## Behavior preservation & regression strategy

- News: server seed uses the same `is_active` public filter as the client default view (no `includeInactive`) — admins still refetch client-side. News has no academic gating (the spec-033 wall does not apply).
- Lecture content: the fallback path keeps 100% of current behavior for legacy rows; scoped path is exercised by `study-flow`/`subjects-catalog` e2e.
- Auth: `TOKEN_REFRESHED` skip must still `setLoading(false)`; `SIGNED_OUT` unchanged; `signInWithGoogle` memo deps must include everything it reads (locale, bridge) or the closure goes stale.
- Suites: vitest + Playwright (`study-flow`, `guest-quiz`, `subjects-catalog`) must stay green.

## Test specification

1. Build green; standalone size recorded (expect ~52 MB unchanged).
2. Lighthouse 7 routes: **news CLS < 0.1, perf ≥ 90**; quiz-play ~69, subjects ~89, ai-assistant ~88, landing ~96, login ~98 (no regressions).
3. curl: news HTML contains card titles as DOM text (server-rendered).
4. vitest 286 + Playwright e2e green.
5. Acceptance records measured numbers; reverted attempts documented with root cause.

## Acceptance (measured 2026-11-04)

- [x] **Track A (news seed)** — server seed live and faithful: prod news table currently has **0 active rows for anon** (verified via anon REST, Content-Range */0), so the page renders an empty state and `initialNews: []` matches it exactly. **CLS 0.490 → 0.000 (×3 stable)** — the only Wave-1B target hit outright. Caveat recorded: the earlier 0.490 could not be reproduced against current data (no cards to grow), so the fix ships as correct architecture + prevention. New observation: news LCP 4.4-4.7s reproducible but NOT network/CLS/hydration-gated (TTFB 21ms, no late requests, no framer-motion, no LCP element attribution from LH) — same needs-attribution bucket as quiz-play (suspect: ASSET-3 font-swap trail, preload:false).
- [x] **Track B (lecture scoping)** — scoped .or(lecture_id, lecture_key) queries with the broad-fetch fallback for legacy inference-only rows; quizzes select adds lecture_key. Typecheck clean; covered by study-flow/subjects-catalog e2e.
- [x] **Track C (AUTH-1/3)** — useNotifications runs 0 getUser roundtrips (was 2/mount + 2 action paths); realtime channel re-subscribes on identity change (was: stayed on the mount-time user after sign-out); mount sync skipped when initialProfile present; force-sync only on genuine SIGNED_IN.
- [x] **Track D (RENDER-1)** — context value memoized, 4 handlers useCallback-stable, TOKEN_REFRESHED with unchanged user id no longer reallocates the value (~35 consumers).
- [x] **Track E (QUERY-2)** — course-detail: 6 serial awaits → course fetch + one Promise.all(5); review_details narrowed. course_* selects kept (*) pending a consumed-columns audit.
- [x] Suites: vitest **286/286**; Playwright **11/11**.
- [x] LH single-run volatility note: ar/quiz-play readings swung with machine load (parallel port-agent builds) — ar re-measured 96-97/LCP 1.36s twice; quiz-play unchanged by this branch (5.2-5.6s LCP, attribution pass owed from spec 033).
- [x] PKG-2/DESKTOP-2 resolution recorded: spec 033 Track D eliminated the multi-platform sharp trace — standalone node_modules/@img = 19 MB (win32-x64 + colour only), standalone total ~52-64 MB. No excludes needed.
- [ ] CI green on the PR (pending push).
