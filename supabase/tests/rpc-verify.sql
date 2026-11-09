-- ============================================================================
-- rpc-verify.sql - MasarX RPC behavior verification harness (spec 040)
-- Companion to rls-verify.sql: rls-verify covers WHO may touch WHAT
-- (policies); this file covers WHAT the server-authoritative functions DO.
-- ============================================================================
--
-- WHAT THIS VERIFIES
--   Section 1  norm_subject_name(v text)          — spec 038 normalizer vectors
--   Section 2  check_rate_limit(...)              — fixed-window math + purge
--   Section 3  finish_quiz_attempt + guard_quiz_attempt_grading trigger
--              — authoritative re-grade, ownership, idempotency, anti-cheat
--                (spec 030; the highest-risk untested pair in the repo)
--   Section 4  trw_redeem_access_code(p_code)     — the money path: auth guard,
--                invalid/expired/inactive rejection, duplicate rejection,
--                membership upsert (revoke reset), redemption ledger,
--                used_count + auto-deactivation at exhaustion, audit row
--
-- WHERE IT RUNS
--   Any PostgreSQL 17 built per supabase/migrations/README.md (vanilla PG +
--   anon/authenticated/service_role roles + the migration chain). A guarded
--   auth-schema prelude (Section 0) provides auth.uid() on vanilla PG via
--   request.jwt.claims; on a real Supabase project the platform's own
--   auth.uid() is left untouched.
--
-- HOW TO RUN
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rpc-verify.sql
--
--   auth.uid() is claim-driven: the harness impersonates users by setting
--   request.jwt.claims (SET LOCAL per scenario), NOT by switching roles —
--   the RPCs are SECURITY DEFINER, so role switching adds nothing.
--
-- PASS / FAIL
--   PASS = script completes with NOTICE lines per section, exit code 0.
--   FAIL = any "RPC-VERIFY FAILED: ..." exception aborts the run (psql
--          exits non-zero with ON_ERROR_STOP=1); the message names the
--          broken invariant. Every mutating scenario runs inside a
--          BEGIN/ROLLBACK pair — the script writes nothing that survives.
-- ============================================================================

SELECT current_database() AS database,
       current_user       AS connected_as,
       current_setting('server_version') AS postgres_version;

-- ----------------------------------------------------------------------------
-- Section 0: auth-schema prelude (vanilla-PG only; no-op on real Supabase)
-- ----------------------------------------------------------------------------
DO $outer$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    CREATE SCHEMA auth;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE AS $inner$
        SELECT CASE
          WHEN COALESCE(current_setting('request.jwt.claims', true), '') = '' THEN NULL
          ELSE NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
        END
      $inner$;
    $fn$;
  END IF;
END
$outer$;

-- ----------------------------------------------------------------------------
-- Helpers (temp schema, dropped at the end; assert_raises runs the query in
-- a subtransaction so an EXPECTED error does not abort the run)
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS rpc_verify;

CREATE OR REPLACE FUNCTION rpc_verify.assert_true(cond boolean, msg text)
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  IF NOT COALESCE(cond, false) THEN
    RAISE EXCEPTION 'RPC-VERIFY FAILED: %', msg;
  END IF;
  RAISE NOTICE '  ok: %', msg;
END
$fn$;

CREATE OR REPLACE FUNCTION rpc_verify.assert_raises(query text, msg text)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE caught text;
BEGIN
  BEGIN
    EXECUTE query;
  EXCEPTION WHEN OTHERS THEN
    caught := SQLERRM;
  END;
  IF caught IS NULL THEN
    RAISE EXCEPTION 'RPC-VERIFY FAILED (expected an error, got none): %', msg;
  END IF;
  RAISE NOTICE '  ok (raised: %): %', caught, msg;
  RETURN caught;
END
$fn$;

-- ----------------------------------------------------------------------------
-- Section 1: norm_subject_name — the spec 038 sync normalizer. The JS twin
-- (sync-reconcile norm()) must stay in lockstep; these vectors are the
-- contract both sides share.
-- ----------------------------------------------------------------------------
DO $$ BEGIN RAISE NOTICE 'Section 1: norm_subject_name'; END $$;
DO $$
BEGIN
  PERFORM rpc_verify.assert_true(public.norm_subject_name(NULL) = '', 'null -> empty');
  PERFORM rpc_verify.assert_true(public.norm_subject_name('') = '', 'empty -> empty');
  PERFORM rpc_verify.assert_true(public.norm_subject_name('Math  - 2') = 'math2', 'spaces/dots/hyphens stripped + lowered');
  PERFORM rpc_verify.assert_true(public.norm_subject_name('Data_Comm–2') = 'datacomm2', 'underscore + en-dash stripped');
  PERFORM rpc_verify.assert_true(public.norm_subject_name('الرياضيات') = 'الرياضيات', 'Arabic preserved (only case/punct normalized)');
  PERFORM rpc_verify.assert_true(public.norm_subject_name('  A.B  c--d  ') = 'abcd', 'mixed padding + punctuation');
  PERFORM rpc_verify.assert_true(public.norm_subject_name('  ') = '', 'whitespace-only -> empty');
END $$;

-- ----------------------------------------------------------------------------
-- Section 2: check_rate_limit — fixed window anchored at first insert,
-- stale-window purge, exact max_requests boundary.
-- ----------------------------------------------------------------------------
DO $$ BEGIN RAISE NOTICE 'Section 2: check_rate_limit'; END $$;
BEGIN;
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', false);
  -- unique identifier so concurrent runs / leftover rows cannot interfere
  PERFORM public.check_rate_limit('rpc-verify:wl', 'test', 3, 5);
  DELETE FROM public.rate_limits WHERE identifier = 'rpc-verify:wl';

  PERFORM rpc_verify.assert_true(public.check_rate_limit('rpc-verify:wl', 'test', 3, 5), '1st request allowed');
  PERFORM rpc_verify.assert_true(public.check_rate_limit('rpc-verify:wl', 'test', 3, 5), '2nd request allowed');
  PERFORM rpc_verify.assert_true(public.check_rate_limit('rpc-verify:wl', 'test', 3, 5), '3rd request allowed (boundary)');
  PERFORM rpc_verify.assert_true(NOT public.check_rate_limit('rpc-verify:wl', 'test', 3, 5), '4th request blocked at max=3');

  PERFORM rpc_verify.assert_true(
    (SELECT request_count = 3 FROM public.rate_limits
      WHERE identifier='rpc-verify:wl' AND endpoint='test'),
    'blocked request did not increment the counter');

  -- stale window is purged, then a fresh window starts at 1
  UPDATE public.rate_limits
     SET window_start = now() - interval '10 minutes'
   WHERE identifier = 'rpc-verify:wl' AND endpoint = 'test';
  PERFORM rpc_verify.assert_true(public.check_rate_limit('rpc-verify:wl', 'test', 3, 5), 'stale window purged -> allowed again');
  PERFORM rpc_verify.assert_true(
    (SELECT request_count = 1 FROM public.rate_limits
      WHERE identifier='rpc-verify:wl' AND endpoint='test'),
    'new window starts at count=1');

  -- different endpoints are independent
  PERFORM rpc_verify.assert_true(public.check_rate_limit('rpc-verify:wl', 'other', 1, 5), 'other endpoint starts fresh');
END $$;
ROLLBACK;

-- ----------------------------------------------------------------------------
-- Section 3: finish_quiz_attempt + guard_quiz_attempt_grading (spec 030).
-- No FKs bind quiz_attempts/quiz_questions/quiz_answers, so the fixture is
-- self-contained. Dirty client-side score is overwritten by the re-grade.
-- ----------------------------------------------------------------------------
DO $$ BEGIN RAISE NOTICE 'Section 3: finish_quiz_attempt + guard trigger'; END $$;
BEGIN;
DO $sc3$
DECLARE
  result jsonb;
  graded record;
BEGIN
  PERFORM set_config('request.jwt.claims', '', false);

  -- unauthenticated caller refused (42501)
  PERFORM rpc_verify.assert_raises(
    $q$SELECT public.finish_quiz_attempt(gen_random_uuid())$q$,
    'unauthenticated caller is refused');

  -- authenticated fixture
  PERFORM set_config('request.jwt.claims',
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);

  -- auth.users row (FK target for quiz_attempts.user_id)
  INSERT INTO auth.users (id, email, role) VALUES
    ('11111111-1111-1111-1111-111111111111', 'owner@rpc-verify.local', 'authenticated'),
    ('66666666-6666-6666-6666-666666666666', 'other@rpc-verify.local', 'authenticated');

  INSERT INTO public.quizzes (id, title, status) VALUES
    ('33333333-3333-3333-3333-333333333333', 'RPC Verify Fixture Quiz', 'approved');

  INSERT INTO public.quiz_questions (id, quiz_id, question, options, correct_answer, order_index) VALUES
    ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'Q1', '[1,2,3,4]', 1, 0),
    ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'Q2', '[1,2,3,4]', 2, 1);

  -- Seeded CLEAN (score=0, unfinished) — guard_quiz_attempt_insert (spec 040
  -- PR-1 #200) forbids forged completed attempts at INSERT. The dirty client
  -- score is applied below through the grading-flag escape hatch, so the
  -- authoritative-regrade assertion still proves the client value loses.
  INSERT INTO public.quiz_attempts (id, quiz_id, user_id, score, total_questions, started_at)
  VALUES ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333',
          '11111111-1111-1111-1111-111111111111', 0, 0, now() - interval '61 seconds');

  INSERT INTO public.quiz_answers (attempt_id, question_id, selected_option) VALUES
    ('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 1),  -- correct
    ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444', 3);  -- wrong

  -- client-side score tampering is blocked by the guard trigger
  PERFORM rpc_verify.assert_raises(
    $q$UPDATE public.quiz_attempts SET score = 100 WHERE id = '55555555-5555-5555-5555-555555555555'$q$,
    'guard trigger blocks client-side score writes');
  PERFORM rpc_verify.assert_raises(
    $q$UPDATE public.quiz_attempts SET finished_at = now() WHERE id = '55555555-5555-5555-5555-555555555555'$q$,
    'guard trigger blocks client-side finished_at writes');

  -- grading flag on -> the SAME update succeeds (the RPC's own escape hatch)
  PERFORM set_config('app.quiz_grading', 'on', true);
  UPDATE public.quiz_attempts SET score = 999 WHERE id = '55555555-5555-5555-5555-555555555555';
  PERFORM set_config('app.quiz_grading', '', true);

  -- ownership: another user's attempt is refused
  PERFORM set_config('request.jwt.claims',
    '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', false);
  PERFORM rpc_verify.assert_raises(
    $q$SELECT public.finish_quiz_attempt('55555555-5555-5555-5555-555555555555')$q$,
    'another user''s attempt is refused');

  -- back to the owner: authoritative re-grade
  PERFORM set_config('request.jwt.claims',
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);

  SELECT public.finish_quiz_attempt('55555555-5555-5555-5555-555555555555') INTO result;

  PERFORM rpc_verify.assert_true(result->>'success' = 'true', 'finish returns success');
  PERFORM rpc_verify.assert_true((result->>'score')::int = 1, 'authoritative score = 1 (client sent 999)');
  PERFORM rpc_verify.assert_true((result->>'total_questions')::int = 2, 'total = question count for the quiz');
  PERFORM rpc_verify.assert_true(jsonb_array_length(result->'answers') = 2, 'answers payload has both entries');
  PERFORM rpc_verify.assert_true((result->'answers'->0->>'question_id') = '22222222-2222-2222-2222-222222222222', 'answers ordered by order_index');
  PERFORM rpc_verify.assert_true((result->'answers'->0->>'is_correct')::boolean, 'q1 graded correct');
  PERFORM rpc_verify.assert_true(NOT (result->'answers'->1->>'is_correct')::boolean, 'q2 graded wrong');

  SELECT * INTO graded FROM public.quiz_attempts WHERE id = '55555555-5555-5555-5555-555555555555';
  PERFORM rpc_verify.assert_true(graded.score = 1 AND graded.total_questions = 2, 'row persisted with server grade');
  PERFORM rpc_verify.assert_true(graded.finished_at IS NOT NULL, 'finished_at set by the RPC');
  PERFORM rpc_verify.assert_true(graded.time_taken_seconds BETWEEN 59 AND 63, 'time fallback from started_at (~61s)');

  -- idempotent retry returns the stored grade, does not re-grade
  SELECT public.finish_quiz_attempt('55555555-5555-5555-5555-555555555555') INTO result;
  PERFORM rpc_verify.assert_true(result->>'reason' = 'already_finished', 'retry returns already_finished');
  PERFORM rpc_verify.assert_true((result->>'score')::int = 1, 'retry keeps the stored score');

  -- unknown / missing attempt refused
  PERFORM rpc_verify.assert_raises(
    $q$SELECT public.finish_quiz_attempt(gen_random_uuid())$q$,
    'unknown attempt id refused');
END
$sc3$;
ROLLBACK;

-- ----------------------------------------------------------------------------
-- Section 4: trw_redeem_access_code — the money path (baseline:1530).
-- Note: the used_count >= max_uses rejection branch is unreachable as a live
-- row (CHECK no_exhausted_active forbids active+exhausted) — the RPC
-- auto-deactivates at exhaustion, which is asserted below instead.
-- ----------------------------------------------------------------------------
DO $$ BEGIN RAISE NOTICE 'Section 4: trw_redeem_access_code'; END $$;
BEGIN;
  SELECT set_config('request.jwt.claims', '', false);

  -- auth.users rows (FK targets for trw_memberships.user_id)
  INSERT INTO auth.users (id, email, role) VALUES
    ('11111111-1111-1111-1111-111111111111', 'owner@rpc-verify.local', 'authenticated'),
    ('66666666-6666-6666-6666-666666666666', 'other@rpc-verify.local', 'authenticated'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'third@rpc-verify.local', 'authenticated');

  INSERT INTO public.trw_plan_definitions (id, slug, name, is_active) VALUES
    ('77777777-7777-7777-7777-777777777777', 'starter', 'Starter', true);

  INSERT INTO public.trw_access_codes (id, code, plan_id, max_uses, used_count, expires_at, membership_duration_days, is_active) VALUES
    ('88888888-8888-8888-8888-888888888888', 'GOODCODE', '77777777-7777-7777-7777-777777777777', 2, 0, NULL, 30, true),
    ('99999999-9999-9999-9999-999999999999', 'OLDCODE',  '77777777-7777-7777-7777-777777777777', 5, 0, now() - interval '1 day', 30, true),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'DEADCODE', '77777777-7777-7777-7777-777777777777', 5, 0, NULL, 30, false);

  -- unauthenticated -> structured not_authenticated error (NOT an exception)
  DO $$
DECLARE result jsonb;
BEGIN
  SELECT public.trw_redeem_access_code('GOODCODE') INTO result;
  PERFORM rpc_verify.assert_true(result->>'success' = 'false' AND result->>'error' = 'not_authenticated',
    'unauthenticated -> not_authenticated');
END $$;

  -- invalid code family
  SELECT set_config('request.jwt.claims',
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
  DO $$
DECLARE result jsonb;
BEGIN
  SELECT public.trw_redeem_access_code('NOSUCHCODE') INTO result;
  PERFORM rpc_verify.assert_true(result->>'error' = 'invalid_or_expired_code', 'unknown code rejected');

  SELECT public.trw_redeem_access_code('OLDCODE') INTO result;
  PERFORM rpc_verify.assert_true(result->>'error' = 'invalid_or_expired_code', 'expired code rejected');

  SELECT public.trw_redeem_access_code('DEADCODE') INTO result;
  PERFORM rpc_verify.assert_true(result->>'error' = 'invalid_or_expired_code', 'inactive code rejected');
END $$;

  -- happy path + full ledger
  DO $$
DECLARE result jsonb;
BEGIN
  SELECT public.trw_redeem_access_code('GOODCODE') INTO result;
  PERFORM rpc_verify.assert_true(result->>'success' = 'true', 'valid code succeeds');
  PERFORM rpc_verify.assert_true(result->>'plan_slug' = 'starter', 'plan slug returned');
  PERFORM rpc_verify.assert_true((result->>'expires_at')::timestamptz > now() + interval '29 days', '30-day membership expiry');

  PERFORM rpc_verify.assert_true(
    (SELECT count(*) = 1 FROM public.trw_memberships
      WHERE user_id = '11111111-1111-1111-1111-111111111111'),
    'membership row created');
  PERFORM rpc_verify.assert_true(
    (SELECT revoked_at IS NULL AND expires_at IS NOT NULL FROM public.trw_memberships
      WHERE user_id = '11111111-1111-1111-1111-111111111111'),
    'membership active with expiry');
  PERFORM rpc_verify.assert_true(
    (SELECT count(*) = 1 FROM public.trw_access_code_redemptions
      WHERE code_id = '88888888-8888-8888-8888-888888888888'),
    'redemption recorded');
  PERFORM rpc_verify.assert_true(
    (SELECT used_count = 1 FROM public.trw_access_codes WHERE code = 'GOODCODE'),
    'used_count incremented');
  PERFORM rpc_verify.assert_true(
    (SELECT count(*) = 1 FROM public.trw_membership_audit_log
      WHERE user_id = '11111111-1111-1111-1111-111111111111' AND action = 'granted' AND plan_slug = 'starter'),
    'audit row written');
END $$;

  -- duplicate redemption rejected
  DO $$
DECLARE result jsonb;
BEGIN
  SELECT public.trw_redeem_access_code('GOODCODE') INTO result;
  PERFORM rpc_verify.assert_true(result->>'error' = 'already_redeemed', 'duplicate redemption rejected');
END $$;

  -- second user redeems the same multi-use code; exhaustion auto-deactivates
  SELECT set_config('request.jwt.claims',
    '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', false);
  DO $$
DECLARE result jsonb;
BEGIN
  SELECT public.trw_redeem_access_code('GOODCODE') INTO result;
  PERFORM rpc_verify.assert_true(result->>'success' = 'true', 'second user redeems multi-use code');
  PERFORM rpc_verify.assert_true(
    (SELECT used_count = 2 AND is_active = false FROM public.trw_access_codes WHERE code = 'GOODCODE'),
    'used_count=2 -> auto-deactivated (CHECK no_exhausted_active stays satisfied)');
END $$;

  -- exhausted code now rejected for a third user
  SELECT set_config('request.jwt.claims',
    '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', false);
  DO $$
DECLARE result jsonb;
BEGIN
  SELECT public.trw_redeem_access_code('GOODCODE') INTO result;
  PERFORM rpc_verify.assert_true(result->>'error' = 'invalid_or_expired_code', 'exhausted code rejected');
END $$;

  -- re-grant resets a revoked membership (ON CONFLICT DO UPDATE); the third
  -- user holds no membership yet, so seed a revoked one first
  INSERT INTO public.trw_memberships (user_id, plan_id, expires_at, revoked_at)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '77777777-7777-7777-7777-777777777777', NULL, now());
  SELECT set_config('request.jwt.claims',
    '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', false);
  INSERT INTO public.trw_access_codes (code, plan_id, max_uses, used_count, expires_at, membership_duration_days, is_active)
  VALUES ('REVOKEFIX', '77777777-7777-7777-7777-777777777777', 5, 0, NULL, 30, true);
  DO $$
DECLARE result jsonb;
BEGIN
  SELECT public.trw_redeem_access_code('REVOKEFIX') INTO result;
  PERFORM rpc_verify.assert_true(result->>'success' = 'true', 're-redeem on existing membership succeeds');
  PERFORM rpc_verify.assert_true(
    (SELECT count(*) = 1 FROM public.trw_memberships
      WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    'upsert did not duplicate the membership row');
  PERFORM rpc_verify.assert_true(
    (SELECT revoked_at IS NULL FROM public.trw_memberships
      WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    'revocation cleared by the redemption upsert');
END $$;

  -- NULL duration -> permanent membership (expires_at stays NULL)
  INSERT INTO public.trw_access_codes (code, plan_id, max_uses, used_count, expires_at, membership_duration_days, is_active)
  VALUES ('PERMANENT', '77777777-7777-7777-7777-777777777777', 5, 0, NULL, NULL, true);
  SELECT set_config('request.jwt.claims',
    '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', false);
  DO $$
DECLARE result jsonb;
BEGIN
  SELECT public.trw_redeem_access_code('PERMANENT') INTO result;
  PERFORM rpc_verify.assert_true(result->>'success' = 'true' AND result->>'expires_at' IS NULL,
    'NULL duration -> permanent membership');
  PERFORM rpc_verify.assert_true(
    (SELECT expires_at IS NULL FROM public.trw_memberships
      WHERE user_id = '66666666-6666-6666-6666-666666666666'),
    'permanent membership persisted with NULL expiry');
END $$;
ROLLBACK;

-- ----------------------------------------------------------------------------
-- Cleanup helpers + summary
-- ----------------------------------------------------------------------------
DROP SCHEMA rpc_verify CASCADE;

DO $$
BEGIN
  RAISE NOTICE 'rpc-verify: ALL SECTIONS PASSED (norm_subject_name, check_rate_limit, finish_quiz_attempt + guard, trw_redeem_access_code)';
END $$;
