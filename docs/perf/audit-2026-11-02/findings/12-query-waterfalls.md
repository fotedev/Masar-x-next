# 12 — Query Waterfalls, N+1 & Over-fetching (server/RSC paths)

> Subagent auditor #12, 2026-11-02. Domain: RSC pages + server actions + API routes. **Scope corrections to prior exploration:** `courses/[courseId]` and `summaries/[summaryId]` are CLIENT components (their waterfalls hit the browser, not the RSC budget); the `profiles:instructor_id` embed joins `profiles.id` (PK) so it does NOT need an index; sitemap queries are already parallel + narrow.

## Findings

### [QUERY-1] Locale layout serializes getMessages → auth.getUser → profile on the critical path of every page

- Priority P1 · Impact H — every RSC render under `[locale]` pays 2-3 back-to-back awaits before paint; `getMessages` is independent of auth and needlessly gates the auth roundtrips.
- Evidence: `apps/web/src/app/[locale]/layout.tsx:91-102` — `const messages = await getMessages(...)` → `const supabase = await createClient()` → `await supabase.auth.getUser()` (network JWT verify) → `await getProfile(user.id)` (service-role HTTPS call). 3 serial awaits; all serial.
- Current: 3 sequential segments. Fix (app-only, Effort S): `const [messages, { data: { user } }] = await Promise.all([getMessages(...), (async () => (await createClient()).auth.getUser())()])`; the getUser→profile chain is inherently dependent (needs `user.id`) and stays serial — that's 2 roundtrips, irreducible without an edge function/RPC joining auth+profile. (Corroborated by MID-2 with the `getCachedUser()` dedupe variant.)

### [QUERY-2] Course detail page runs 6 queries strictly sequentially (client-side — prior "RSC" claim corrected)

- Priority P1 · Impact M — 5 roundtrips could be one; dominates perceived load on slow mobile networks. Not an RSC page: file starts `"use client"` (line 1), so this is a client waterfall.
- Evidence: `apps/web/src/app/[locale]/courses/[courseId]/page.tsx:144-212` — course (144) → enrollment (166) → reviews (175) → summaries (193) → videos (200) → files (207), all `await` in one function. Only the course fetch gates the rest (publication check needs `courseData.is_published`, line 156).
- Current: 6 serial. Fix (app-only, Effort S): after the course fetch, `const [enrollment, reviews, summaries, videos, files] = await Promise.all([...4-5 queries])`. Also all four content queries use `.select("*")` (lines 168/177/195/203/209) where the render only consumes a handful of columns — narrow them. Enrollment lookup is covered by `UNIQUE(student_id, course_id)` (stated at line 258-260).

### [QUERY-3] Summary detail page: 3 serial queries, last two independent

- Priority P2 · Impact L — client component again (`"use client"`, line 1); 1 extra roundtrip vs parallel.
- Evidence: `apps/web/src/app/[locale]/summaries/[summaryId]/page.tsx:78-135` — summary (78) → profile (96, guarded by `summaryData.user_id`) → quiz (125, needs only `summaryId`). Profile and quiz are independent of each other.
- Current: 3 serial. Fix (app-only, Effort S): `Promise.all([profileFetch, quizQuery.maybeSingle()])` after the summary fetch, or embed `profiles:user_id (full_name, avatar_url, username)` into the main select (comment at line 92 says the split was a schema-cache workaround — retest the embed before merging it back). Quiz uses `.select("*")` (127) but only `id`/`title` render.

### [QUERY-4] lib/quiz.ts getQuiz: two fetches whose parameters are both known upfront

- Priority P2 · Impact L — the "repeats quiz_attempts queries" claim from prior exploration is overstated: lines 209-216 (startAttempt select), 335 (submitAttempt insert) and 343-355 (getUserAttempts select) are distinct operations, not repetition. Real issue is `getQuiz`.
- Evidence: `apps/web/src/lib/quiz.ts:183-195` — `quizzes.select('*').eq('id', quizId).single()` then `quiz_questions.select('*').eq('quiz_id', quizId)`; both use the function argument `quizId`, neither depends on the other's result. (Cross-ref FETCH-3: same waterfall seen from the hooks side — one fix.)
- Current: 2 serial. Fix (app-only, Effort S): `Promise.all([quizQuery, questionsQuery])`, or one PostgREST embed `quizzes.select('*, quiz_questions(*)')`. `startAttempt` (209-227) is correctly dependent (answers need `attempt.id`) — leave as is.

### [QUERY-5] Server action resolveSubjectAndLecture: dependent-shaped but actually independent queries

- Priority P2 · Impact M for the action, L user-facing (submit-time POST, not first paint) — `addFile`/`addVideo` each run 4 serial roundtrips: getUser → subject → lecture → insert.
- Evidence: `apps/web/src/actions/content.ts:53-73` — subject by name (53-57), then lecture by `subject` **name** + `lecture_key` (65-70). The lecture filter never uses `subjectId`, so the sequential await is false dependency. Action totals: `ensureAdmin` (29-31) → resolve (100-103) → insert (105).
- Current: 4 serial. Fix (app-only, Effort S): `Promise.all([subjectQuery, lectureKey ? lectureQuery : null])` inside `resolveSubjectAndLecture`. DB note: lecture query filters `subject_lectures(subject, lecture_key)` — needs the FK/unique index on `(subject, lecture_key)` (exists per DB healthy-areas: baseline:3779-3782 composites cover it).

### [QUERY-6] auth/sync route: 3 serial calls plus a full-layout revalidate that re-triggers layout queries

- Priority P2 · Impact L — login-time only, not first-paint; but `revalidatePath('/', 'layout')` invalidates the whole locale layout, so the next navigation re-pays QUERY-1's getUser+profile for all users of that subtree.
- Evidence: `apps/web/src/app/api/auth/sync/route.ts:15-17` delegates to `syncUserProfile`; `apps/web/src/actions/auth.ts:24-44` — getUser (24) → profiles select (40-44) → conditional update (62 or 83) → `revalidatePath('/', 'layout')` (91). (Cross-ref AUTH-4: the revalidate also fires even when nothing was written.)
- Current: 3-4 serial. Fix (app-only, Effort S): keep the read-then-write (the selective-merge logic needs the existing row); scope revalidation if `/` layout is the only consumer, or accept it. Not worth restructuring into upsert — it would lose the "don't overwrite custom edits" semantics.

### [QUERY-7] Instructor dashboard pulls every enrollment and review row to compute counts client-side

- Priority P2 · Impact M as data grows — one query, but unbounded row payload (all enrollments + all reviews per course) just to produce 4 aggregate numbers; grows linearly with platform adoption.
- Evidence: `apps/web/src/app/[locale]/instructor-dashboard/page.tsx:62-77` — embed `enrollments (status), reviews (rating)` filtered by `instructor_id`; lines 82-100 do client-side filter/average. Client component (`"use client"`, line 1) — the prior "multi-table page:64" claim is actually a single embedded query, not a multi-query waterfall.
- Current: 1 query, over-fetching rows. Fix: server-side aggregates via a small RPC (`get_instructor_course_stats(p_instructor_id)`) returning counts + avg rating — app code + DB function (Effort M); interim alternative: two `count: 'exact', head: true` queries per status. DB-side: `.eq("instructor_id", user.id)` — served by `idx_courses_instructor_id` (baseline:3748).

### [QUERY-8] Sitemap — corrected: already parallel, columns already narrow

- Priority P2 · Impact L today, M as summaries grow — the prior "full-table scans at :55-57" claim is true on scan-shape but the three queries are already `Promise.all`'d, not sequential.
- Evidence: `apps/web/src/app/sitemap.ts:54-58` — `Promise.all([subjects.select("name"), courses.select("id, updated_at"), summaries.select("id, updated_at").eq("status", "approved")])`. Unbounded: no `.limit()` or `.range()` on courses/summaries.
- Current: 3 parallel, unbounded. Fix (app-only, Effort S): add pagination or a cap when the summaries table is large, and confirm the route is build-time static rather than re-rendered per request (if dynamic, add `revalidate`). Whether draft courses leak into `courses.select(...)` (no status filter, anon key at line 14) is an RLS question, out of scope here.

### [QUERY-9] updateAvatar action: profile update and auth metadata update are serialized

- Priority P2 · Impact L — user-action path.
- Evidence: `apps/web/src/actions/profile.ts:33-49` — profiles update (33) then `supabase.auth.updateUser` (44); the two writes are independent (different stores).
- Current: 2 serial post-auth. Fix (app-only, Effort S): `Promise.all`. Auth getUser (line 14) must precede both — correctly serial.

## Healthy areas

- `apps/web/src/app/api/health/db/route.ts:46-49` — single minimal probe (`head: true`, `limit(1)`), fail-closed in production; exactly one roundtrip per request.
- `apps/web/src/app/[locale]/page.tsx` — homepage RSC makes zero DB queries (only `await params`); landing paint is not DB-gated.
- `apps/web/src/app/[locale]/layout.tsx:33` — `getProfile` wrapped in React `cache()`, so multiple layout consumers dedupe per request.
- `apps/web/src/app/sitemap.ts:54` — parallel + narrow columns already.
- `apps/web/src/actions/content.ts:53-57` — subject lookup uses `.select('id').limit(1)`, appropriately narrow.
- `apps/web/src/app/api/auth/sync/route.ts` — route itself is a thin pass-through; no duplicated query logic.
- `apps/web/src/app/[locale]/downloads/page.tsx` — the 6 awaits are i18n params/headers + one GitHub release fetch; no DB waterfall.

## Notes

- The two biggest prior-exploration items were misattributed (client vs RSC; PK-join embed). The genuinely server-side costs found: layout (QUERY-1) and server actions (QUERY-5/6/9).
- All fixes above are app-code-only (reorder/Promise.all/select columns) except QUERY-7 (needs a DB RPC).
- 13 files read.
