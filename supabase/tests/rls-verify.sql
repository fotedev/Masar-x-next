-- ============================================================================
-- rls-verify.sql - MasarX RLS verification harness
-- Spec 004 / T055 (code part). See supabase/tests/README.md for usage.
-- ============================================================================
--
-- WHAT THIS VERIFIES
--   Section 1  Every client-accessible table in schema `public` has
--              Row Level Security ENABLED. Fails loudly (RAISE EXCEPTION)
--              naming any offender.
--              1a. Static inventory of all 19 tables created by the active
--                  migration chain 001..008 (supabase/migrations/).
--              1b. Dynamic sweep of ALL base tables in `public`, so any
--                  future migration that forgets RLS fails this harness.
--              1c. User-data views must be security_invoker views.
--   Section 2  Policy inventory (tablename, policyname, cmd, roles),
--              ordered - documentation output.
--   Section 3  Positive/negative behavior tests per key user-data table,
--              executed as `authenticated` / `service_role` inside
--              transactions that always ROLL BACK.
--
-- WHERE THE TABLE LIST COMES FROM
--   supabase/migrations/002_core_identity.sql        profiles, admins
--   supabase/migrations/003_academic_structure.sql   academic_levels, departments, subjects, platform_settings
--   supabase/migrations/004_content_management.sql   courses, quizzes, summaries, enrollments
--   supabase/migrations/005_interactions_and_media.sql videos, files, reviews (+ 2 security_invoker views)
--   supabase/migrations/006_system_and_security.sql  audit_logs, system_logs, rate_limits, password_reset_tokens, notifications
--   supabase/migrations/007_subject_lectures.sql     subject_lectures
--   supabase/migrations/008_jwt_role_sync.sql        (no tables - triggers/functions only)
--
--   `supabase/migrations.old/` is LEGACY and NOT part of the active chain.
--   It mentions quiz_attempts / quiz_answers / news / appeals / chat tables
--   that migrations 001..008 do not create. Section 1b still fails any such
--   table if it exists in a given environment WITHOUT RLS, and Section 3.10
--   conditionally tests quiz_attempts when present.
--
-- HOW TO RUN
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls-verify.sql
--   or paste the whole file into Supabase Dashboard -> SQL Editor.
--
--   CI runs this against a DISPOSABLE Supabase branch database (never
--   production). Sections 1 and 2 run anywhere; Section 3 additionally
--   needs the seed rows documented in supabase/tests/README.md.
--
-- PASS / FAIL
--   PASS = script completes with NOTICE lines per section and exit code 0.
--   FAIL = any RAISE EXCEPTION aborts the run (psql exits non-zero with
--          ON_ERROR_STOP=1); the message names the table and the fix.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Section 0: context + preflight
-- ----------------------------------------------------------------------------
SELECT current_database()                       AS database,
       current_user                             AS connected_as,
       current_setting('server_version')        AS postgres_version;

-- Section 3 uses SET LOCAL ROLE authenticated / service_role. That requires
-- the connected role to be a member of those roles. Managed Supabase
-- projects grant this membership to the `postgres` role; a local psql
-- superuser also satisfies it.
DO $preflight$
DECLARE
  has_authenticated boolean;
  has_service_role  boolean;
BEGIN
  SELECT pg_has_role(current_user, 'authenticated', 'member'),
         pg_has_role(current_user, 'service_role', 'member')
    INTO has_authenticated, has_service_role;

  IF NOT has_authenticated THEN
    RAISE EXCEPTION
      'RLS VERIFY FAILED: role % cannot SET ROLE authenticated. Run as the Supabase postgres role or a superuser (see supabase/tests/README.md).',
      current_user;
  END IF;

  IF NOT has_service_role THEN
    RAISE NOTICE
      'PREFLIGHT WARNING: role % cannot SET ROLE service_role; block 3.8b will fail. Managed Supabase projects grant this to the postgres role.',
      current_user;
  ELSE
    RAISE NOTICE 'PREFLIGHT PASS: % can assume authenticated and service_role', current_user;
  END IF;
END
$preflight$;

-- ----------------------------------------------------------------------------
-- Section 1a: static inventory - every table from migrations 002..008 must
-- exist in schema public AND have relrowsecurity = true.
-- ----------------------------------------------------------------------------
DO $rls_static$
DECLARE
  expected text[] := ARRAY[
    -- 002_core_identity
    'profiles', 'admins',
    -- 003_academic_structure
    'academic_levels', 'departments', 'subjects', 'platform_settings',
    -- 004_content_management
    'courses', 'quizzes', 'summaries', 'enrollments',
    -- 005_interactions_and_media
    'videos', 'files', 'reviews',
    -- 006_system_and_security
    'audit_logs', 'system_logs', 'rate_limits', 'password_reset_tokens', 'notifications',
    -- 007_subject_lectures
    'subject_lectures'
  ];
  t         text;
  missing   text := '';
  no_rls    text := '';
BEGIN
  FOREACH t IN ARRAY expected LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = t
         AND c.relkind IN ('r', 'p')   -- ordinary + partitioned tables
    ) THEN
      missing := missing || t || ' ';
    ELSIF NOT EXISTS (
      SELECT 1
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = t
         AND c.relkind IN ('r', 'p')
         AND c.relrowsecurity = true
    ) THEN
      no_rls := no_rls || t || ' ';
    END IF;
  END LOOP;

  IF missing <> '' THEN
    RAISE EXCEPTION 'RLS VERIFY FAILED: expected tables missing from schema public: %', missing;
  END IF;

  IF no_rls <> '' THEN
    RAISE EXCEPTION 'RLS VERIFY FAILED: tables without row level security: %', no_rls;
  END IF;

  RAISE NOTICE 'SECTION 1a PASS: all % expected tables exist with RLS enabled', array_length(expected, 1);
END
$rls_static$;

-- ----------------------------------------------------------------------------
-- Section 1b: dynamic sweep - ANY base table in schema public without RLS
-- fails, including tables from legacy or future migrations.
-- ----------------------------------------------------------------------------
DO $rls_sweep$
DECLARE
  t         record;
  offenders text := '';
BEGIN
  FOR t IN
    SELECT c.relname, c.relrowsecurity
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p')
       AND c.relisshared = false
  LOOP
    IF NOT t.relrowsecurity THEN
      offenders := offenders || t.relname || ' ';
    END IF;
  END LOOP;

  IF offenders <> '' THEN
    RAISE EXCEPTION
      'RLS VERIFY FAILED: public tables created without RLS (fix the migration that added them): %',
      offenders;
  END IF;

  RAISE NOTICE 'SECTION 1b PASS: no base table in schema public lacks RLS';
END
$rls_sweep$;

-- ----------------------------------------------------------------------------
-- Section 1c: user-data views must be security_invoker (migration 005
-- declared review_details and lectures_with_ratings WITH (security_invoker)).
-- An owner-rights view would silently bypass the base tables RLS.
-- ----------------------------------------------------------------------------
DO $view_invoker$
DECLARE
  expected   text[] := ARRAY['review_details', 'lectures_with_ratings'];
  t          text;
  v          record;
  missing    text := '';
  no_invoker text := '';
BEGIN
  FOREACH t IN ARRAY expected LOOP
    SELECT c.relname, c.reloptions
      INTO v
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = t
       AND c.relkind = 'v';

    IF NOT FOUND THEN
      missing := missing || t || ' ';
    ELSIF coalesce(array_to_string(v.reloptions, ','), '') NOT LIKE '%security_invoker%' THEN
      no_invoker := no_invoker || t || ' ';
    END IF;
  END LOOP;

  IF missing <> '' THEN
    RAISE EXCEPTION 'RLS VERIFY FAILED: expected security_invoker views missing from schema public: %', missing;
  END IF;

  IF no_invoker <> '' THEN
    RAISE EXCEPTION 'RLS VERIFY FAILED: views without security_invoker (can bypass base-table RLS): %', no_invoker;
  END IF;

  RAISE NOTICE 'SECTION 1c PASS: user-data views use security_invoker';
END
$view_invoker$;

-- ----------------------------------------------------------------------------
-- Section 2: policy inventory (documentation output, ordered)
-- ----------------------------------------------------------------------------
SELECT tablename, policyname, cmd, roles
  FROM pg_catalog.pg_policies
 WHERE schemaname = 'public'
 ORDER BY tablename, cmd, policyname;

-- ----------------------------------------------------------------------------
-- Section 3: behavior tests (run as authenticated / service_role).
--
-- Conventions used by every block:
--   * Each block runs inside BEGIN ... ROLLBACK; nothing persists.
--   * set_config('request.jwt.claims', ...) is transaction-local; Supabase
--     auth.uid() / auth.role() read exactly this setting.
--   * Positive test = query runs without permission error.
--   * Negative test = write that MUST be rejected; if it succeeds, RLS is
--     broken and we RAISE EXCEPTION. RLS is checked before foreign keys on
--     INSERT, so a passing seed (see README) makes the verdicts exact.
--   * TODO(LIVE-JWT) marks spots where a real signed JWT (or a seeded
--     fixture) is needed; CI supplies these on the disposable branch DB.
-- ----------------------------------------------------------------------------
BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config(
    'request.jwt.claims',
    '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}',
    true
  );

  -- 3.1 profiles ------------------------------------------------------------
  -- profiles are public-read BY DESIGN ("Public profiles are viewable by
  -- everyone"), so only writes are scoped: insert own id only.
  DO $t31a$
  DECLARE
    n int;
  BEGIN
    SELECT count(*) INTO n FROM public.profiles
     WHERE id = '00000000-0000-0000-0000-0000000000a1';

    IF n = 0 THEN
      INSERT INTO public.profiles (id, full_name)
      VALUES ('00000000-0000-0000-0000-0000000000a1', 'RLS harness user A');
      RAISE NOTICE '3.1 profiles PASS: own-profile insert allowed';
    ELSE
      RAISE NOTICE '3.1 profiles PASS: own profile row visible (seeded; insert skipped)';
    END IF;
  END
  $t31a$;

  DO $t31b$
  BEGIN
    BEGIN
      INSERT INTO public.profiles (id, full_name)
      VALUES ('00000000-0000-0000-0000-0000000000a2', 'RLS harness intruder');
      RAISE EXCEPTION 'RLS VERIFY FAILED: profiles allowed inserting another user id (insert policy missing or broken)';
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE '3.1 profiles PASS: cross-user insert rejected as expected';
      WHEN unique_violation THEN
        RAISE EXCEPTION 'RLS VERIFY FAILED: profiles insert for another user passed RLS (hit unique violation)';
      WHEN foreign_key_violation THEN
        RAISE EXCEPTION 'RLS VERIFY INCONCLUSIVE: user B missing from auth.users - apply the seed in supabase/tests/README.md and re-run';
    END;
  END
  $t31b$;

  -- 3.2 summaries -----------------------------------------------------------
  -- Public read (USING true), admin-managed writes: non-admin INSERT must fail.
  DO $t32a$
  DECLARE
    n int;
  BEGIN
    SELECT count(*) INTO n FROM public.summaries;
    RAISE NOTICE '3.2 summaries PASS: public read allowed (visible rows: %)', n;
  END
  $t32a$;

  DO $t32b$
  BEGIN
    BEGIN
      INSERT INTO public.summaries (title, user_id)
      VALUES ('rls-harness', '00000000-0000-0000-0000-0000000000a1');
      RAISE EXCEPTION 'RLS VERIFY FAILED: summaries allowed a non-admin INSERT (no insert policy present)';
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE '3.2 summaries PASS: non-admin insert rejected as expected';
      WHEN foreign_key_violation THEN
        RAISE EXCEPTION 'RLS VERIFY INCONCLUSIVE: user A missing from auth.users - apply the seed in supabase/tests/README.md and re-run';
    END;
  END
  $t32b$;

  -- 3.3 quizzes -------------------------------------------------------------
  -- Public read, admin-managed writes: non-admin INSERT must fail. (No
  -- user_id column, so this block has no FK dependency.)
  DO $t33a$
  DECLARE
    n int;
  BEGIN
    SELECT count(*) INTO n FROM public.quizzes;
    RAISE NOTICE '3.3 quizzes PASS: public read allowed (visible rows: %)', n;
  END
  $t33a$;

  DO $t33b$
  BEGIN
    BEGIN
      INSERT INTO public.quizzes (title) VALUES ('rls-harness');
      RAISE EXCEPTION 'RLS VERIFY FAILED: quizzes allowed a non-admin INSERT';
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE '3.3 quizzes PASS: non-admin insert rejected as expected';
    END;
  END
  $t33b$;

  -- TODO(LIVE-JWT): admin write paths. Seed an admins row for user A, then
  -- re-run with A authenticated: INSERT/UPDATE/DELETE on courses, quizzes,
  -- summaries, subject_lectures must then succeed. Requires a real signed-in
  -- admin (or a branch DB with the admins fixture); CI supplies it.

  -- 3.4 enrollments ---------------------------------------------------------
  -- Students see ONLY their own rows; only admins can write.
  DO $t34a$
  DECLARE
    own int;
    other int;
  BEGIN
    SELECT count(*) INTO own
      FROM public.enrollments
     WHERE student_id = '00000000-0000-0000-0000-0000000000a1';

    SELECT count(*) INTO other
      FROM public.enrollments
     WHERE student_id <> '00000000-0000-0000-0000-0000000000a1';

    IF other <> 0 THEN
      RAISE EXCEPTION 'RLS VERIFY FAILED: enrollments exposed % rows of other students', other;
    END IF;
    RAISE NOTICE '3.4 enrollments PASS: own rows visible (%), other students rows invisible', own;
  END
  $t34a$;

  DO $t34b$
  BEGIN
    BEGIN
      INSERT INTO public.enrollments (student_id, course_id)
      VALUES ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1');
      RAISE EXCEPTION 'RLS VERIFY FAILED: enrollments allowed a student INSERT (only admins may write)';
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE '3.4 enrollments PASS: student insert rejected as expected';
      WHEN foreign_key_violation THEN
        RAISE EXCEPTION 'RLS VERIFY INCONCLUSIVE: seed incomplete (user A or course c1 missing) - see supabase/tests/README.md';
    END;
  END
  $t34b$;

  -- 3.5 reviews -------------------------------------------------------------
  -- Writers may only author rows for themselves (WITH CHECK auth.uid() =
  -- user_id) and only against quiz/summary/video targets. The negative test
  -- below uses NULL FKs, so it needs no content seed: RLS WITH CHECK fires
  -- before any FK constraint.
  DO $t35b$
  BEGIN
    BEGIN
      INSERT INTO public.reviews (rating, content, user_id)
      VALUES (5, 'rls-harness', '00000000-0000-0000-0000-0000000000a2');
      RAISE EXCEPTION 'RLS VERIFY FAILED: reviews allowed inserting with another user id (WITH CHECK broken)';
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE '3.5 reviews PASS: insert-as-other-user rejected as expected';
    END;
  END
  $t35b$;

  -- TODO(LIVE-SEED) positive: as user A, insert a review on a seeded quiz
  -- (user_id = A, quiz_id = seeded quiz). CI supplies the fixture on the
  -- branch DB; the expected result is success and a visible own row.

  -- 3.6 notifications -------------------------------------------------------
  -- Users see and update ONLY their own rows; no user insert policy exists.
  DO $t36a$
  DECLARE
    other int;
  BEGIN
    SELECT count(*) INTO other
      FROM public.notifications
     WHERE user_id <> '00000000-0000-0000-0000-0000000000a1';

    IF other <> 0 THEN
      RAISE EXCEPTION 'RLS VERIFY FAILED: notifications exposed % rows of other users', other;
    END IF;
    RAISE NOTICE '3.6 notifications PASS: other users rows invisible';
  END
  $t36a$;

  DO $t36b$
  BEGIN
    BEGIN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES ('00000000-0000-0000-0000-0000000000a1', 'rls-harness', 'x', 'info');
      RAISE EXCEPTION 'RLS VERIFY FAILED: notifications allowed a client INSERT (no insert policy exists)';
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE '3.6 notifications PASS: client insert rejected as expected';
      WHEN foreign_key_violation THEN
        RAISE EXCEPTION 'RLS VERIFY INCONCLUSIVE: user A missing from auth.users - apply the seed in supabase/tests/README.md and re-run';
    END;
  END
  $t36b$;

  -- 3.7 admins --------------------------------------------------------------
  -- The admins table is admin-only read. User A is not an admin here.
  DO $t37$
  DECLARE
    n int;
  BEGIN
    SELECT count(*) INTO n FROM public.admins;
    IF n <> 0 THEN
      RAISE EXCEPTION 'RLS VERIFY FAILED: non-admin authenticated user can read the admins table (% rows)', n;
    END IF;
    RAISE NOTICE '3.7 admins PASS: admins table invisible to non-admin';
  END
  $t37$;

  -- 3.8 password_reset_tokens ----------------------------------------------
  -- 3.8a: total blackout for authenticated users.
  DO $t38a$
  DECLARE
    n int;
  BEGIN
    SELECT count(*) INTO n FROM public.password_reset_tokens;
    IF n <> 0 THEN
      RAISE EXCEPTION 'RLS VERIFY FAILED: authenticated user can read password_reset_tokens (% rows)', n;
    END IF;
    RAISE NOTICE '3.8a password_reset_tokens PASS: invisible to authenticated';
  END
  $t38a$;
ROLLBACK;

BEGIN;
  SET LOCAL ROLE service_role;
  SELECT set_config('request.jwt.claims', '{"role": "service_role"}', true);

  -- 3.8b: service_role CAN read (its policies key off auth.role()).
  DO $t38b$
  DECLARE
    n int;
  BEGIN
    SELECT count(*) INTO n FROM public.password_reset_tokens;
    RAISE NOTICE '3.8b password_reset_tokens PASS: service_role read allowed (rows: %)', n;
  END
  $t38b$;
ROLLBACK;

BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config(
    'request.jwt.claims',
    '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}',
    true
  );

  -- 3.9 audit_logs / system_logs / rate_limits ------------------------------
  -- Admin-only read (audit/system) and deny-all (rate_limits has RLS but
  -- zero policies): an authenticated user must see nothing.
  DO $t39$
  DECLARE
    n int;
  BEGIN
    SELECT count(*) INTO n FROM public.audit_logs;
    IF n <> 0 THEN
      RAISE EXCEPTION 'RLS VERIFY FAILED: audit_logs visible to non-admin (% rows)', n;
    END IF;

    SELECT count(*) INTO n FROM public.system_logs;
    IF n <> 0 THEN
      RAISE EXCEPTION 'RLS VERIFY FAILED: system_logs visible to non-admin (% rows)', n;
    END IF;

    SELECT count(*) INTO n FROM public.rate_limits;
    IF n <> 0 THEN
      RAISE EXCEPTION 'RLS VERIFY FAILED: rate_limits visible to authenticated (% rows) - deny-all broken', n;
    END IF;

    RAISE NOTICE '3.9 PASS: audit_logs, system_logs, rate_limits all invisible to authenticated';
  END
  $t39$;

  -- 3.10 quiz_attempts (CONDITIONAL / legacy) -------------------------------
  -- The active chain (001..008) does NOT create quiz_attempts; it appears
  -- only in supabase/migrations.old/. If the table exists in this
  -- environment, verify RLS and the owner-scoped read posture; otherwise
  -- SKIP loudly.
  DO $t310$
  DECLARE
    tbl oid;
    n   int;
  BEGIN
    tbl := to_regclass('public.quiz_attempts');
    IF tbl IS NULL THEN
      RAISE NOTICE '3.10 quiz_attempts SKIP: not present (not part of migrations 001..008)';
      RETURN;
    END IF;

    IF NOT (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid = tbl) THEN
      RAISE EXCEPTION 'RLS VERIFY FAILED: quiz_attempts exists without RLS';
    END IF;

    EXECUTE 'SELECT count(*) FROM public.quiz_attempts WHERE user_id IS NULL OR user_id <> $1'
       INTO n
      USING '00000000-0000-0000-0000-0000000000a1';

    IF n <> 0 THEN
      RAISE EXCEPTION 'RLS VERIFY FAILED: quiz_attempts exposed % rows not owned by the caller', n;
    END IF;

    RAISE NOTICE '3.10 quiz_attempts PASS: RLS enabled and rows owner-scoped (legacy table present)';
  END
  $t310$;
ROLLBACK;

DO $summary$
BEGIN
  RAISE NOTICE 'RLS VERIFY COMPLETE: Sections 1-2 asserted, Section 3 behavioral blocks passed (or explicitly SKIPped).';
END
$summary$;