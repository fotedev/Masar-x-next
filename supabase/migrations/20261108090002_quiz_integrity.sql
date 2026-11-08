-- Quiz integrity — full-code review 2026-11-07 (P1.3: forged completed
-- attempts insertable; answer key readable; WP3: unpinned SECURITY DEFINER
-- functions with default-PUBLIC EXECUTE).
--
-- Part 1 of the quiz-integrity fix (spec 040 PR-1). The column-level grant
-- that removes correct_answer from anon/authenticated SELECT ships with
-- fix/quiz-answer-key so the database flip and the client payload rework
-- land together.

-- 1) Admin read path for full quiz_questions rows (definer, admin-gated,
--    pinned search_path). The admin quiz form uses this once the column
--    grant lands; INSERT/UPDATE of the key by admins is unaffected.
CREATE OR REPLACE FUNCTION public.admin_list_quiz_questions(p_quiz_id uuid)
RETURNS SETOF public.quiz_questions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT q.*
  FROM public.quiz_questions q
  WHERE q.quiz_id = p_quiz_id
    AND EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid())
  ORDER BY q.order_index;
$function$;

REVOKE ALL ON FUNCTION public.admin_list_quiz_questions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_quiz_questions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_quiz_questions(uuid) TO service_role;

-- 2) Reject forged completed attempts at INSERT. The production client
--    paths only ever insert score=0/unfinished rows (mobile quiz.ts:96,
--    web lib/quiz.ts startAttempt); completion happens exclusively through
--    the finish_quiz_attempt UPDATE path (guard_quiz_attempt_grading).
--    The dead legacy web fallback (quizService.submitAttempt) is removed
--    by fix/quiz-answer-key.
CREATE OR REPLACE FUNCTION public.guard_quiz_attempt_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.finished_at IS NOT NULL OR NEW.score <> 0 THEN
    RAISE EXCEPTION 'quiz_attempts must start unfinished and unscored (completion via finish_quiz_attempt)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_quiz_attempt_insert ON public.quiz_attempts;
CREATE TRIGGER trg_guard_quiz_attempt_insert
BEFORE INSERT ON public.quiz_attempts
FOR EACH ROW EXECUTE FUNCTION public.guard_quiz_attempt_insert();

-- 3) Pin search_path on the SECURITY DEFINER functions the baseline left
--    unpinned (WP3 core), and drop default-PUBLIC EXECUTE plus the anon
--    grants the register flagged. None of these is called via rpc() by any
--    app surface (verified 2026-11-08 across apps/web, apps/mobile,
--    packages/shared); the trigger/cron-internal ones also lose
--    authenticated EXECUTE (trigger firing does not check EXECUTE).
ALTER FUNCTION public.set_user_role(user_id uuid, new_role text) SET search_path TO 'public';
ALTER FUNCTION public.update_user_display_name(user_id uuid, display_name text) SET search_path TO 'public';
ALTER FUNCTION public.manual_ai_summarization(chat_uuid uuid) SET search_path TO 'public';
ALTER FUNCTION public.cleanup_expired_reset_tokens() SET search_path TO 'public';
ALTER FUNCTION public.handle_new_user() SET search_path TO 'public';
ALTER FUNCTION public.handle_auth_user_update() SET search_path TO 'public';
ALTER FUNCTION public.audit_table_changes() SET search_path TO 'public';
ALTER FUNCTION public.delete_old_ai_chat_messages() SET search_path TO 'public';
ALTER FUNCTION public.sync_user_role_to_metadata() SET search_path TO 'public';
ALTER FUNCTION public.remove_user_role_from_metadata() SET search_path TO 'public';

REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_user_display_name(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_user_display_name(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.manual_ai_summarization(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_reset_tokens() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_auth_user_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_table_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_old_ai_chat_messages() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_user_role_to_metadata() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.remove_user_role_from_metadata() FROM PUBLIC, anon, authenticated;
