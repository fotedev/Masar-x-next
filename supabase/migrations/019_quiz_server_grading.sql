-- ============================================================================
-- 019_quiz_server_grading.sql — 2026-10-24 (spec 030, audit finding C4)
--
-- Makes quiz grading server-authoritative:
--   * finish_quiz_attempt(p_attempt_id, p_time_taken_seconds) re-grades the
--     attempt's saved answers against quiz_questions.correct_answer,
--     overwrites the client-sent is_correct flags, computes score and
--     total_questions server-side, finalizes the attempt, and rebuilds the
--     answers jsonb authoritatively.
--   * A guard trigger blocks direct client UPDATEs of the grading columns
--     (score/total_questions/finished_at/status/answers/time_taken_seconds)
--     — the RPC is the only sanctioned writer, via the app.quiz_grading GUC.
--
-- Spec: specs/030-quiz-server-grading/spec.md
-- Canonical RPC style: migrations/011 notify_admins_of_content.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.finish_quiz_attempt(
  p_attempt_id uuid,
  p_time_taken_seconds integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid;
  v_attempt     public.quiz_attempts%ROWTYPE;
  v_score       integer;
  v_total       integer;
  v_answers     jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'finish_quiz_attempt requires an authenticated caller'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_attempt
    FROM public.quiz_attempts
   WHERE id = p_attempt_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'quiz attempt not found' USING ERRCODE = '42501';
  END IF;

  IF v_attempt.user_id <> v_user_id THEN
    RAISE EXCEPTION 'quiz attempt does not belong to the caller'
      USING ERRCODE = '42501';
  END IF;

  -- Idempotent retry: return the stored graded state instead of re-grading.
  IF v_attempt.finished_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'reason', 'already_finished',
      'score', v_attempt.score,
      'total_questions', v_attempt.total_questions,
      'answers', COALESCE(v_attempt.answers, '[]'::jsonb)
    );
  END IF;

  -- Authoritative re-grade: overwrite the client-sent is_correct flags.
  UPDATE public.quiz_answers qa
     SET is_correct = (
           qa.selected_option IS NOT NULL
           AND qa.selected_option = qq.correct_answer
         )
    FROM public.quiz_questions qq
   WHERE qa.question_id = qq.id
     AND qa.attempt_id = v_attempt.id;

  SELECT count(*) FILTER (WHERE a.is_correct),
         (SELECT count(*) FROM public.quiz_questions qq
           WHERE qq.quiz_id = v_attempt.quiz_id)
    INTO v_score, v_total
    FROM public.quiz_answers a
   WHERE a.attempt_id = v_attempt.id;

  -- Authoritative answers payload in the shape the history/review UIs read.
  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'question_id', a.question_id,
             'selected_option', a.selected_option,
             'is_correct', a.is_correct
           ) ORDER BY qq.order_index
         ), '[]'::jsonb)
    INTO v_answers
    FROM public.quiz_answers a
    JOIN public.quiz_questions qq ON qq.id = a.question_id
   WHERE a.attempt_id = v_attempt.id;

  PERFORM set_config('app.quiz_grading', 'on', true);

  UPDATE public.quiz_attempts
     SET score = v_score,
         total_questions = v_total,
         finished_at = now(),
         status = 'completed',
         time_taken_seconds = COALESCE(
           p_time_taken_seconds,
           floor(EXTRACT(EPOCH FROM (now() - v_attempt.started_at)))::integer
         ),
         last_updated_at = now(),
         answers = v_answers
   WHERE id = v_attempt.id;

  RETURN jsonb_build_object(
    'success', true,
    'score', v_score,
    'total_questions', v_total,
    'answers', v_answers
  );
END;
$$;

-- Guard: clients may finalize only through the RPC. Mirrors migration 018's
-- extra_assets_entitlement guard pattern.
CREATE OR REPLACE FUNCTION public.guard_quiz_attempt_grading()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(current_setting('app.quiz_grading', true), '') <> 'on'
     AND (
       NEW.score IS DISTINCT FROM OLD.score
       OR NEW.total_questions IS DISTINCT FROM OLD.total_questions
       OR NEW.finished_at IS DISTINCT FROM OLD.finished_at
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.answers IS DISTINCT FROM OLD.answers
       OR NEW.time_taken_seconds IS DISTINCT FROM OLD.time_taken_seconds
     )
  THEN
    RAISE EXCEPTION 'quiz attempt grading is managed server-side only (spec 030)';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_quiz_attempt_score ON public.quiz_attempts;
CREATE TRIGGER trg_guard_quiz_attempt_score
  BEFORE UPDATE ON public.quiz_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_quiz_attempt_grading();

-- 011 footer: Supabase default privileges grant EXECUTE on new functions to
-- anon, authenticated and service_role explicitly; revoke each individually.
REVOKE ALL ON FUNCTION public.finish_quiz_attempt(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finish_quiz_attempt(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.finish_quiz_attempt(uuid, integer) TO authenticated;
