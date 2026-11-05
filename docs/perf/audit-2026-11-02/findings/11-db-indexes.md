# 11 — Postgres Indexes & Schema Access Paths

> Subagent auditor #11, 2026-11-02. Domain: supabase/migrations baseline + app query columns. **Scope correction:** since spec 031 (2026-10-31) the canonical chain is `20261031000000_baseline.sql` (introspection snapshot of production) + `20261031000001_storage_buckets.sql`; the old numbered chain 001-017 is archived at `supabase/migrations-archive/numbered-chain-001-019/`. The baseline carries ~88 app indexes (baseline:3695-3783) — far richer than the old chain, and several prior-exploration "missing index" claims are FALSE against the baseline. Only the genuinely-missing set below stands. All fixes are RECOMMENDATIONS for NEW timestamp migrations (never edit the baseline; apply via `supabase-masarx` MCP `apply_migration`).

## Findings

**Context correction to prior exploration:** the numbered chain 001..017 no longer exists as the canonical chain. Since spec 031 (2026-10-31), `supabase/migrations/` contains only `20261031000000_baseline.sql` — an introspection snapshot of **production** (project `jcufigozkhxazjbwhjjm`) — plus `20261031000001_storage_buckets.sql` (`supabase/migrations/README.md:3-13`). The baseline is therefore the authoritative index inventory, and it is far richer than the old chain suggested (~88 app indexes, baseline:3695-3783). The prod/fresh-build drift admitted in 010's header is resolved. All claims below were re-verified against the baseline, not the old chain.

### [DB-1] `reviews` FK columns `summary_id` / `quiz_id` / `user_id` / `video_id` have no index — hit by direct queries and both public rating views

- Priority P1 · Impact H — this is the only content table with zero usable indexes beyond a partial `course_id`; reviews grows with every user rating action, and both scale paths (view joins + `.eq()` filters) degrade to seq scans.
- Evidence:
  - FKs exist with no covering index: `supabase/migrations/20261031000000_baseline.sql:896` (`reviews.summary_id → summaries(id)`), `:897` (`reviews.quiz_id`), `:900` (`reviews.user_id`), `:924` (`reviews.course_id`), `:933` (`reviews.video_id`). The only reviews index is `idx_reviews_course_id ... WHERE (course_id IS NOT NULL)` (baseline:3761).
  - Direct queries filter these columns: `apps/web/src/hooks/useReviews.ts:29` (`.eq("summary_id", contentId)`) and `:31` (`.eq("quiz_id", contentId)`) — seq scan on every quiz/summary rating fetch.
  - `summaries_with_ratings` does `LEFT JOIN reviews r ON s.id = r.summary_id` (baseline:3828) and `quizzes_with_ratings` joins `ON q.id = r.quiz_id` (baseline:3844); the home feed reads `summaries_with_ratings` ordered by `avg_rating` (`apps/web/src/hooks/useSummaries.ts:19-22`).
- Fix (new migration only):

  ```sql
  CREATE INDEX idx_reviews_summary_id ON public.reviews(summary_id);
  CREATE INDEX idx_reviews_quiz_id ON public.reviews(quiz_id);
  -- optional, lower traffic: (user_id); video_id only if review_details is queried by video
  ```

  Effort S.

### [DB-2] `enrollments.course_id` unindexed — the unique index is `(student_id, course_id)` and cannot serve course-side lookups

- Priority P1 · Impact M — instructor dashboards resolve enrollments through the course side (join + RLS EXISTS), so every instructor/admin listing scans enrollments once tables grow.
- Evidence: `CONSTRAINT enrollments_student_id_course_id_key UNIQUE (student_id, course_id)` (baseline:521) creates a btree with `student_id` leading; `course_id`-alone is not covered. FK at baseline:925. Query path: `apps/web/src/hooks/useEnrollments.ts:41-56` — `from("enrollments").select("*, courses!inner(...)").eq("courses.instructor_id", instructorId)` → PostgREST filters courses (indexed) then joins `enrollments.course_id` unindexed. RLS repeats the same shape ("Instructors can view enrollments for their courses" EXISTS subquery, baseline:4085-4087). The student-side check (`student_id`+`course_id`) is fine — uses the composite unique index.
- Fix: `CREATE INDEX idx_enrollments_course_id ON public.enrollments(course_id);` (optionally `(course_id, status)`). Effort S.

### [DB-3] Quiz-attempt history sorts per user — composite `(user_id, created_at)` opportunity

- Priority P2 · Impact M — today the planner filters via `idx_quiz_attempts_user_id` (baseline:3732) then sorts all of a user's attempts on every history load.
- Evidence: `apps/web/src/lib/quiz.ts:346-351` — `.from('quiz_attempts').select('*, quizzes(title)').eq('user_id', userId).order('created_at', { ascending: false })`.
- Fix: `CREATE INDEX idx_quiz_attempts_user_created ON public.quiz_attempts(user_id, created_at DESC);` then `idx_quiz_attempts_user_id` becomes redundant and can be dropped in the same migration. Effort S.

### [DB-4] Four duplicate/redundant indexes inflate write cost on hot paths

- Priority P2 · Impact M — notifications and password-reset writes are per-user hot paths; each redundant index is paid on every INSERT/UPDATE.
- Evidence (all in baseline):
  - `profiles_username_idx` (3741) and `idx_profiles_username` (3760) — both `btree(username)`; the UNIQUE constraint (baseline:454) already guarantees a third implicit one.
  - `idx_password_reset_tokens_token_hash` (3759) duplicates UNIQUE `ux_password_reset_tokens_token_hash` (3781).
  - `idx_notifications_user_id` (3713) is the leading column of `idx_notifications_user_read (user_id, read)` (3743) — the exact composite used by `apps/web/src/hooks/useNotifications.ts:119-120` — so the single-column index is subsumed.
  - `idx_content_analytics_content_type` (3723) duplicates the leading column of UNIQUE `(content_type, content_id)` (baseline:344); `idx_summaries_subject` USING **hash** (3739) is subsumed by the btree leading column of `(subject, lecture_id)` (3779) for equality lookups.
- Fix (one cleanup migration; verify `pg_stat_user_indexes.idx_scan` before dropping):

  ```sql
  DROP INDEX IF EXISTS public.idx_profiles_username;
  DROP INDEX IF EXISTS public.idx_password_reset_tokens_token_hash;
  DROP INDEX IF EXISTS public.idx_notifications_user_id;
  DROP INDEX IF EXISTS public.idx_content_analytics_content_type;
  DROP INDEX IF EXISTS public.idx_summaries_subject;
  ```

  Effort S.

### [DB-5] `audit_logs.user_id` FK unindexed on a trigger-written, append-only table

- Priority P2 · Impact L-M — no direct app query found, but the table grows fastest in the schema (trigger-written) and its RLS policies run EXISTS subqueries against `enrollments`/`courses` on read (baseline:3941-3947), so any future admin audit viewer inherits a seq scan; user deletion cascade (baseline:904) also scans.
- Evidence: FK `audit_logs_user_id_fkey` baseline:904; table at baseline:582-590; no `idx_audit_logs*` in baseline:3695-3783.
- Fix: `CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);` Effort S.

### [DB-6] News feed: separate `(is_active)` and `(created_at)` indexes — composite would serve the public feed as an ordered index scan

- Priority P2 · Impact L — feed is `eq(is_active) + order(created_at DESC)` (`apps/web/src/hooks/useNews.ts:32-39`); today the planner either sorts or picks one index. News is small; impact materializes only as it grows.
- Evidence: `idx_news_active` (baseline:3699), `idx_news_created_at` (baseline:3702).
- Fix: `CREATE INDEX idx_news_active_created ON public.news(is_active, created_at DESC);` (drop `idx_news_active` after). Effort S.

### [DB-7] Quiz listing: `(status, created_at)` composite — public "approved" listing + home page repeat the same access path

- Priority P2 · Impact L — `status = 'approved'` is also the anon RLS predicate ("Public can view approved quizzes", baseline:4173), so the composite doubles as the RLS access path.
- Evidence: queries `apps/web/src/app/[locale]/quizzes/_hooks/useQuizzesData.ts:32-37` (`.eq("status","approved").order("created_at")`), `apps/web/src/components/HomeClient.tsx:119-122`; separate indexes baseline:3746, 3747.
- Fix: `CREATE INDEX idx_quizzes_status_created ON public.quizzes(status, created_at DESC);` Sibling: summaries `(subject, status, created_at)` optional, not needed now (partial `idx_summaries_subject_approved` baseline:3740 serves the hottest fetch). Effort S.

### [DB-8] Low-traffic FKs with no index and no current query path (hygiene batch)

- Priority P2 · Impact L — none hit by app queries, but each is an ON DELETE cascade/set-null scan waiting for a user deletion. Evidence (FK lines in baseline, none indexed): `videos.user_id` :906, `files.user_id` :907, `quizzes.created_by` :934, `news.created_by` :884, `appeals.reviewed_by` :886, `ai_summaries.last_message_id` :877, `tracked_links.created_by` :931, `waitlist.user_id` :935 (covered only by `lower(email), source`, :3782).
- Fix (single batch migration, skip any with no foreseeable access path):

  ```sql
  CREATE INDEX idx_videos_user_id ON public.videos(user_id);
  CREATE INDEX idx_files_user_id ON public.files(user_id);
  CREATE INDEX idx_quizzes_created_by ON public.quizzes(created_by);
  CREATE INDEX idx_news_created_by ON public.news(created_by);
  CREATE INDEX idx_appeals_reviewed_by ON public.appeals(reviewed_by);
  ```

  Effort S.

### [DB-9] TRW child tables: partial FK coverage

- Priority P2 · Impact L — `trw_access_code_redemptions` covered for `(code_id, user_id)` by UNIQUE (baseline:798) but `membership_id` is not; `trw_membership_audit_log.membership_id` (:917) and `trw_access_codes.plan_id` (:918) have nothing. No app query path found (forward-proofing).
- Fix: `CREATE INDEX idx_trw_redemptions_membership ON public.trw_access_code_redemptions(membership_id); CREATE INDEX idx_trw_membership_audit_membership ON public.trw_membership_audit_log(membership_id); CREATE INDEX idx_trw_access_codes_plan ON public.trw_access_codes(plan_id);` Effort S.

## Healthy areas (verified, no action)

- **`notifications`** — the exact composite used by the app exists: `idx_notifications_user_read (user_id, read)` (baseline:3743) matches `useNotifications.ts:119-120`; `created_at` and `read` also indexed (3714-3715).
- **`quiz_answers.attempt_id`** — prior claim of "unindexed" is FALSE: `UNIQUE (attempt_id, question_id)` (baseline:599-600) serves `lib/quiz.ts:221-223`.
- **Lecture content page** — all four parallel fetches (`useLectureContent.ts:53-76`) are covered: `summaries/videos/files/quizzes (subject, lecture_id)` composites (baseline:3779-3782).
- **`subjects.name` lookup** — served by UNIQUE constraint `subjects_name_key` (baseline:490).
- **`courses`/`enrollments` student side** — `idx_courses_instructor_id` (3748) serves the instructor dashboard; student enrollment check uses the composite unique index.
- **`password_reset_tokens`** — fully indexed on token, token_hash, user_id, email, expires_at (3734-3737, 3759, 3781).
- **jsonb** — no PostgREST containment/text-search on any jsonb column anywhere (no `.contains(`/`.textSearch(` calls); all read/written whole — no GIN needed. Only unindexed jsonb access is the `changed_data->>'student_id'` expression inside audit_logs RLS (baseline:3947), evaluated only on audit-log reads.
- **Appeals** — `status`, `created_at`, `(content_id, content_type)`, `created_by` all indexed (baseline:3703-3704, 3727, 3744), matching `useAppeals.ts:23,40`.

## Notes

- **Migration tooling**: the duplicate `014` numbering is resolved, not live — the numbered chain is archived at `supabase/migrations-archive/numbered-chain-001-019/`; rule 3 forbids reintroducing it (`supabase/migrations/README.md:28`). All fixes above batch into 2-3 new migrations (DB-1+DB-2 together; DB-3/4/5/6/7/8/9 as a cleanup batch with a pre-drop `idx_scan` check).
- **Drift corrections**: "tables in prod but not in canonical chain" (quiz_attempts, appeals, news, analytics, assistant_messages, content_analytics) — resolved: all are in the baseline snapshot (tables at baseline:178-856) with indexes. Claimed missing `notifications.user_id` / `videos.subject_id` / `files.subject_id` indexes exist (under `subject`, the actual column name, not `subject_id`). The genuinely-missing set is DB-1 through DB-9.
- Impact ratings assume row growth with users/reviews; no DB access was performed (per rules), so table sizes are unknown.
- 18 files read (under cap).
