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

## Acceptance

- [ ] news server-seeded (curl-visible card titles), CLS < 0.1
- [ ] lecture-content scoped fetches with fallback verified (legacy path intact)
- [ ] notifications use context user (0 getUser roundtrips per mount)
- [ ] mount sync skipped when `initialProfile` present; TOKEN_REFRESHED skip in place
- [ ] AuthContext value memoized; course-detail waterfall parallelized
- [ ] vitest + Playwright green; CI green on the PR
