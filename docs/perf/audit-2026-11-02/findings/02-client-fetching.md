# 02 — Web Client-Side Data Fetching & Caching Layers

> Subagent auditor #2, 2026-11-02. Domain: apps/web client fetching (hooks), dual cache systems, Supabase client instances.

## Findings

### [FETCH-1] Subject view downloads up to 1,700 rows (400/400/400/500) to render one lecture's content

- Priority P1 · Impact High — four full-table slices per lecture view; nearly all rows are discarded by `lectureMatch` before render, paying transfer + JSON-parse + filter cost on mobile every time a lecture modal opens (no caching: raw useEffect, re-runs per lecture switch).
- Evidence: `apps/web/src/hooks/useLectureContent.ts:56` `.limit(400),` (summaries), `:62` videos `.limit(400)`, `:70` files `.limit(400)`, `:76` quizzes `.limit(500)`; filter at `:118` `.filter(lectureMatch)`.
- Current · 4 parallel unbounded-ish fetches, client-side filtering, no cache. · Fix: query by lecture first — `.or("lecture_id.eq.<id>,lecture_key.eq.<key>")` (title-inference fallback only if the filtered set looks empty), and/or move to react-query keyed by `subject` so re-opening lectures reuses one fetch. · Effort M

### [FETCH-2] /ar/quizzes fetches the entire quizzes table with `select("*")`, no limit (measured TBT 2.08s)

- Priority P1 · Impact High — unbounded growth: every quiz row (incl. description JSON blob, later parsed per row for subject filtering) is shipped and hydrated; this is the measured worst page. localStorage-cached for 1h (`cacheTTL.quizzes`), so a slow-growing table silently degrades further.
- Evidence: `apps/web/src/app/[locale]/quizzes/_hooks/useQuizzesData.ts:32` `let query = supabase.from("quizzes").select("*");` — no `.limit()` anywhere in `loadQuizzes` (:32-44).
- Current · fetch-all, memory-cache `quizzes_all_admin_${isAdmin}` (:20). · Fix: add `.limit(60)` for the student view (admin can keep more or paginate) and select only `id,title,description,created_at`. · Effort S

### [FETCH-3] Quiz-player load is a 2-request waterfall though both queries key on the already-known `quizId`

- Priority P1 · Impact Medium — one avoidable round-trip serializes into /ar/quiz-play LCP (measured 5.86s); the questions query only needs `quizId`, not the quiz row.
- Evidence: `apps/web/src/lib/quiz.ts:183` `const { data: quiz, error: quizError } = await supabase` followed by `:191` `const { data: questions, error: questionsError } = await supabase` (`.eq('quiz_id', quizId)` at :194).
- Current · sequential awaits. · Fix: `Promise.all` the two queries (quiz-not-found still surfaces from the first result). · Effort S

### [FETCH-4] Two parallel caching systems with divergent semantics; the queryCache side is partially dead and partially uninvalidatable

- Priority P1 · Impact Medium — react-query (staleTime 5min, gcTime 30min, retry 1, `invalidateQueries`) governs subjects/summaries/news/appeals, while notifications, home quizzes, and the quizzes page run through the hand-rolled `queryCache` singleton which react-query mutations never invalidate (1h quiz TTL, 1min notifications TTL). Meanwhile `cacheKeys.summaries/news/appeals` + their TTLs in queryCache are dead config — those hooks moved to react-query but the keys/TTLs remain, inviting misuse. localStorage persistence also does synchronous JSON parse of large entries on first read.
- Evidence: `apps/web/src/components/QueryProvider.tsx:10` `export const queryClient = new QueryClient({` vs `apps/web/src/lib/queryCache.ts:163` `summaries: () => "summaries_all",` / `:179-183` TTLs for summaries/news/appeals whose hooks no longer call it (useSummaries.ts:13 uses react-query; useNews.ts:28 react-query; useAppeals.ts:17 react-query). Live queryCache users: useNotifications.ts:79, HomeClient.tsx:112-129, useQuizzesData.ts:22-44.
- Current · dual systems, inconsistent staleness/invalidation. · Fix: migrate the 3 remaining queryCache consumers to react-query (add `persistQueryClient` only for the public prefixes if offline restore matters), then delete dead `cacheKeys`/`cacheTTL` entries. · Effort M

### [FETCH-5] All 6 TRW hooks build a fresh Supabase client inside the hook body on every render

- Priority P1 · Impact Medium — each call constructs a full `SupabaseClient` (GoTrue + storage + realtime scaffolding); multiple instances contend for the auth Navigator lock and generate render-time garbage. The page-level caller memoizes correctly, the hooks do not.
- Evidence: `apps/web/src/hooks/trw/useTRWCourses.ts:5` `const supabase = createClient();` (same pattern in useTRWCategories.ts:5, useTRWMembership.ts:5, useTRWProgress.ts:5, useTRWCourseDetails.ts:5, useRedeemAccessCode.ts:5); `lib/supabase/client.ts:9` "Each call returns a fresh client". Correct contrast: `app/[locale]/non-academic/[subject]/page.tsx:28` `useMemo(() => createClient(), [])`.
- Current · per-call construction. · Fix: `useMemo(() => createClient(), [])` per hook (or one module-level client for anon TRW endpoints). · Effort S

### [FETCH-6] `useAppeals` mounts the whole notifications system just to call `notifyUser`, triggering a 50-row fetch + realtime subscription per admin tab mount

- Priority P2 · Impact Medium — every `useAppeals()` instance runs `auth.getUser()` + `notifications` fetch + a realtime channel setup it never uses for reading; the effect chain is unconditional on mount.
- Evidence: `apps/web/src/hooks/useAppeals.ts:14` `const { notifyUser } = useNotifications();`; `apps/web/src/hooks/useNotifications.ts:257-259` `useEffect(() => { fetchNotifications(); }, ...)` and realtime subscribe effect :262-345.
- Current · hook composition couples write-notify to fetch+subscribe. · Fix: split `notifyUser`/`notifyAdmins` into a standalone util (they are single inserts/RPCs) or a lazy context; keep the realtime UI hook separate. · Effort S

### [FETCH-7] Wide `select("*")` on list endpoints where only card fields are rendered

- Priority P2 · Impact Low — 11 `select("*")` client fetches; appeals (limit 30) ship full appeal payloads including message text into every admin tab, news ships full content body per card.
- Evidence: `apps/web/src/hooks/useAppeals.ts:22` `.select("*")` (limit 30 at :24); `apps/web/src/hooks/useNews.ts:33` `.select("*")` (limit 30 at :35); `apps/web/src/hooks/useSummaries.ts:20` `.select("*")` on the `summaries_with_ratings` view (limit 50).
- Current · star-select on capped lists. · Fix: enumerate columns actually consumed by the card components (keep `*` only where the row is edited in place). · Effort S

## Healthy areas

- QueryProvider defaults are sound and documented (staleTime 5min / gcTime 30min / retry 1) — QueryProvider.tsx:12-27.
- `useAppeals` pending-count uses `head:true` count instead of deriving from the capped list — useAppeals.ts:37-40.
- `useAiChat` is the only properly ranged/paginated client fetch (`range(0, CHAT_PAGE_SIZE-1)`, capped history window) — useAiChat.ts:54,152,204.
- Realtime lifecycle in useNotifications is correct: inflight dedupe map (:9,49-55), unsubscribe on unmount (:330-344), NavigatorLock retry guard (:306-317).
- queryCache localStorage persistence is PII-safe (only subjects/settings/platform/academic_options/levels prefixes persist) — queryCache.ts:18-24,97.
- HomeClient's quiz fetch has a reasoned limit (30 for 10 displayed) with a dedup'd state setter — HomeClient.tsx:123-125,148-154.
- `lib/quiz.ts:99` uses `Promise.all` for batch ops; useVideoRatings takes an explicit limit param (quiz.ts:130).

## Notes

- CLS 0.889–0.917 is layout-side (footer renders before client lists resolve); the data layer's contribution is that all list fetches are post-mount client queries — even with FETCH-2/7 fixed, pages need reserved space (out of my domain).
- `useSubjects` gates its query on academic params (`enabled: ... params.level !== null`, useSubjects.ts:62-64), so the subjects grid waits for an extra auth/profile round-trip before its first fetch — compounds the measured 0.889 CLS.
- Cap-side risk, not perf: `.limit(30)/(50)` caps silently truncate appeals/summaries/news with no pagination or "load more" anywhere except useAiChat.
