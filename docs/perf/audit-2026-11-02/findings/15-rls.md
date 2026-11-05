# 15 — RLS Policy & SECURITY DEFINER Execution Cost

> Subagent auditor #15, 2026-11-02. Domain: supabase/migrations/20261031000000_baseline.sql (production snapshot). Scope correction: the baseline contains **187 CREATE POLICY statements** (169 public + 18 storage), not ~47 — the snapshot captured accumulated production policies. All fixes are RECOMMENDATION SQL for one new migration (suggested name `20261102xxxxxx_rls_policy_perf.sql`).

## Findings

### [RLS-1] Summaries OR-policies call `is_admin()` (SECURITY DEFINER subquery) per scanned row

- **P1 · Impact H** — The three `summaries` policies mix a table column (`user_id`) with bare `is_admin()` in an OR, so the planner cannot treat the admin check as a one-time filter; it executes a subquery into `public.admins` **for every row scanned**. `is_admin()` itself calls bare `auth.uid()` internally (another per-row JWT-claims parse). This is exactly the per-row risk on the biggest content table.
- **Evidence:** `baseline:4214` `USING (((auth.uid() = user_id) OR is_admin()))` (DELETE); `baseline:4216` (SELECT); `baseline:4217` (UPDATE, both USING and WITH CHECK). Function body: `baseline:1438-1447` — `STABLE SECURITY DEFINER`, `SELECT EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid())`.
- **Contrast (verified):** policies shaped `USING (is_admin())` with no table-column references (`baseline:3920-3924`, `3935/3937/3939`, `4187/4195`, `4117`, `4210-4212`, `4123-4126`, `3961`) are pseudo-constant quals → one-time filter, evaluated once per query. Those are fine; only the OR-mixed shape is per-row.
- **Current:** bare `is_admin()` + bare `auth.uid()` per row. **Fix (new migration):**

  ```sql
  CREATE OR REPLACE POLICY summaries_select_own_or_admin ON public.summaries
    FOR SELECT TO authenticated
    USING ((select auth.uid()) = user_id OR (select public.is_admin()));
  CREATE OR REPLACE POLICY summaries_delete_own_or_admin ON public.summaries
    FOR DELETE TO authenticated
    USING ((select auth.uid()) = user_id OR (select public.is_admin()));
  CREATE OR REPLACE POLICY summaries_update_own_or_admin ON public.summaries
    FOR UPDATE TO authenticated
    USING ((select auth.uid()) = user_id OR (select public.is_admin()))
    WITH CHECK ((select auth.uid()) = user_id OR (select public.is_admin()));
  ```

  The `(select ...)` wrapper forces a one-shot InitPlan. **Effort S.**

### [RLS-2] Quizzes OR-policies: bare `auth.uid()` per row (admin EXISTS part is fine)

- **P1 · Impact M** — Verified: the `EXISTS (SELECT 1 FROM admins …)` subqueries in the quizzes policies are *uncorrelated* with the scanned table (only `auth.uid()` inside), so the planner hoists them into a one-time InitPlan — not the per-row risk the briefing implied. The residual per-row cost is bare `auth.uid()`, evaluated on every row of the OR.
- **Evidence:** `baseline:4183` `((auth.uid() = user_id) OR (status = 'approved') OR (EXISTS (SELECT 1 FROM admins WHERE (admins.user_id = auth.uid()))))` (SELECT); `baseline:4174` (DELETE); `baseline:4178-4182` (UPDATE, USING + WITH CHECK).
- **Fix:** `CREATE OR REPLACE POLICY "Users can view own or approved quizzes, admins see all" ON public.quizzes FOR SELECT TO authenticated USING (((select auth.uid()) = user_id OR status = 'approved' OR (select public.is_admin())));` — likewise 4174 / 4178-4182: replace bare `auth.uid()` with `(select auth.uid())` and the admin EXISTS with `(select public.is_admin())`. **Effort S.**

### [RLS-3] `rate_limits` grows without bound — expired rows for *other* identifiers are never deleted

- **P1 · Impact M** — Verified: the in-function DELETE (`baseline:1870-1872`) removes rows only for the *same* `(identifier, endpoint)`. Every distinct IP/identifier that ever hits the endpoint leaves a row forever; the unique index bloats and all three statements per call slow down. No retention/cron exists anywhere in the baseline (grep confirms only lines 570-580, 1870-1881, 3758, 3895 touch the table).
- **Evidence:** `baseline:1870-1872`; table `baseline:570-579` (no retention); index `baseline:3758` `ux_rate_limits_identifier_endpoint`.
- **Fix (new migration):**

  ```sql
  CREATE OR REPLACE FUNCTION public.cleanup_stale_rate_limits() RETURNS void
  LANGUAGE sql SET search_path TO '' AS
  $$ DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 hour'; $$;
  -- schedule via pg_cron (or Supabase Dashboard cron):
  SELECT cron.schedule('rate-limits-cleanup', '*/15 * * * *',
    $$SELECT public.cleanup_stale_rate_limits();$$);
  ```

  **Effort S.**

### [RLS-4] `check_rate_limit` executes 3 statements per call where 1 would do

- **P2 · Impact M** — Verified the DELETE+SELECT+UPSERT shape: `baseline:1870-1881`. Each of the three statements re-probes the same unique index, and every successful increment also fires `tr_update_rate_limits_updated_at` (`baseline:3895`). At high request rates this triples executor work on the RPC hot path.
- **Fix (semantics-preserving single statement):** single `INSERT … ON CONFLICT (identifier, endpoint) DO UPDATE` with window-aware `request_count` reset, `RETURNING request_count, window_start` and the boolean computed from the returned row (full function body in the audit session; self-heals the stale row in-place, replacing the DELETE's lazy-cleanup role; global retention stays in RLS-3). Needs a test pass for race semantics — hence **Effort M**.

### [RLS-5] Bare `auth.uid()` per row across the remaining hot-table policies

- **P2 · Impact M** — `auth.uid()` parses the request JWT-claims JSON on every invocation; the planner cannot hoist a bare stable function call compared against a column. Affects notifications, chat, attempts, profiles, trw, tracked_links, etc. Highest-value targets: notifications list (`baseline:4118-4120`), ai_chat_messages (`baseline:3925-3927`), quiz_attempts history (`baseline:4147-4148`, plus admin policy `4144`), enrollments (`4088-4091`), trw_* (`4227-4235`), tracked_links (`4226`), profiles (`4127-4132`).
- **Fix:** mechanical rewrite `auth.uid()` → `(select auth.uid())` in every public-schema policy expression (Supabase-documented initplan pattern); prioritize the five hot-read tables above. **Effort M** (many policies, but mechanical in one migration).

### [RLS-6] `quiz_questions` SELECT policy runs a correlated EXISTS (plus nested `auth.uid()`) per question row

- **P2 · Impact M** — Verified correlation: the subplan references `quiz_questions.quiz_id`, so it re-executes for each scanned question row; the nested admin EXISTS is inside that, and `auth.uid()` is called per row within it. Listing N questions = N subplan executions (each a `quizzes` PK probe) + N JWT parses.
- **Evidence:** `baseline:4168-4172`; same shape in insert/update/delete policies at `baseline:4149-4167`.
- **Fix:** hoist the invariants: `(quizzes.status = 'approved' OR quizzes.user_id = (select auth.uid()) OR (select public.is_admin()))` inside the EXISTS — leaves only the unavoidable `quizzes.id = quiz_questions.quiz_id` PK probe per row. **Effort S.**

### [RLS-7] Duplicate overlapping permissive policies (policy sprawl) — every SELECT pays extra quals

- **P2 · Impact L-M** — Verified duplicates (permissive policies are OR-combined; each adds plan quals):
  - `profiles`: 4 SELECT policies (`baseline:4127` public `true`, `4131` authenticated `true`), 2 INSERT (`4128` TO public, `4130` TO authenticated), 2 UPDATE (`4129`, `4132`) — three duplicated pairs on the hottest user table.
  - `academic_levels`: `baseline:3918` + `3919` (identical `TO public USING (true)`).
  - `departments`: `baseline:4064` + `4065` (identical).
  - `reviews`: `baseline:4193` (`TO public USING(true)`) + `4194` (`TO authenticated USING(true)`).
- **Fix:** drop the redundant member (e.g. `DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;` keep 4130; keep one UPDATE pair — both are `id = auth.uid()`; `DROP POLICY IF EXISTS reviews_select_all ON public.reviews;` keep 4193; dedupe academic_levels/departments). **Effort S.**

### [RLS-8] `audit_logs` student policy parses `changed_data` jsonb per row; no supporting index

- **P2 · Impact L** — Verified: `baseline:3947-3949` `(changed_data ->> 'student_id') = (auth.uid())::text OR EXISTS(…)` — per-row jsonb text extraction; `audit_logs` (`baseline:582-590`) has no secondary indexes. Any student-path SELECT on this table is a full scan with per-row jsonb parsing.
- **Fix:** if the app actually exposes this read path, add `CREATE INDEX idx_audit_logs_student_id ON public.audit_logs ((changed_data->>'student_id'));` — otherwise mark the policy for removal (dead policy = pure overhead). **Effort S.**

### [RLS-9] `profiles` pays 4 BEFORE-UPDATE triggers per row, two of which do the same job; plus a duplicate username index

- **P2 · Impact L** — Verified triggers on `profiles`: `tr_update_profiles_updated_at` (`baseline:3889`), `trg_enforce_show_extra_assets_cooldown` (`3904`), `set_profiles_updated_at` (`3907` — also stamps `updated_at`), `trg_guard_extra_assets_entitlement` (`3914`). Two triggers both maintain `updated_at`. Duplicate index: `profiles_username_idx` (`baseline:3741`) and `idx_profiles_username` (`baseline:3760`) — identical btree, doubling index maintenance on every profile write. (DB-4 also lists the username duplicate.)
- **Fix:** `DROP TRIGGER set_profiles_updated_at ON public.profiles;` (keep one updated_at stamper) and `DROP INDEX public.idx_profiles_username;` (keep 3741). **Effort S.**

## Healthy areas (verified)

- **`is_admin()` implementation** (`baseline:1438-1447`): `LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'` — correct volatility, inline search_path, and the per-call lookup is index-backed (`idx_admins_user_id`, `baseline:3771`). The cost problem is only its *placement* (RLS-1), not the function itself.
- **`is_trw_member()`** (`baseline:1497-1509`): STABLE definer, inline search_path, backed by `idx_trw_memberships_user_lookup` (`baseline:3776`); only used in a single-row INSERT WITH CHECK → evaluated once.
- **`summaries_status_guard` trigger** (`baseline:1686-1699`, attached `3908` as `BEFORE UPDATE OF status`): (a) `OF status` means it only fires when the status column is in the SET list, (b) short-circuit evaluation means `is_admin()` runs only when the status actually changes and the caller isn't privileged. Not a blanket per-update cost.
- **`check_rate_limit` security hygiene** (`baseline:1861-1885`): `SECURITY DEFINER SET search_path TO ''` (strongest form), `ON CONFLICT` backed by a real unique index (`ux_rate_limits_identifier_endpoint`, `baseline:3758`). Only the bloat (RLS-3) and statement count (RLS-4) need attention.
- **Analytics insert path:** no anon insert policy exists; only `analytics_insert_for_authenticated` (`baseline:3934`) WITH CHECK on a single-row insert → one evaluation. `waitlist_insert_any` anon `WITH CHECK (true)` is trivially cheap.
- **Correlated enrollment EXISTS policies** (e.g. `baseline:3971-3973` course_files, `4189-4191` reviews): backed by `enrollments` UNIQUE(student_id, course_id) (`baseline:522`) — PK-unique probes per row, and INSERT WITH CHECK variants evaluate once per statement. Acceptable.
- **`notify_admins_of_content`** (`baseline:1736-1787`): eligibility checks are PK/index-probes (`idx_appeals_content` 3703, summaries/news PKs), insert fan-out bounded by admin count.
- **`finish_quiz_attempt`** (`baseline:3565-3614`): single PK `SELECT … FOR UPDATE`, idempotent short-circuit, one re-grade UPDATE — no scan risk.

## Notes

- RLS-1/2/5 rewrites change policy expressions; verify semantics (including the `service_role` bypass paths) with `EXPLAIN` before/after on `summaries`, `quizzes`, `notifications`. Nothing here weakens any policy — all rewrites are evaluation-order/initplan changes only.
- The 187-policy count vs the prior "~47" is a scope correction: the baseline is a faithful snapshot and production genuinely accumulated ~4× the historical chain's policies — RLS-7 is the cleanup edge of that.
- Files: baseline.sql only (9 files read/grepped total).
