-- spec 037: sync-hardening — content-table timestamps + audit coverage
-- Reuses baseline functions (no new function bodies): set_updated_at() and
-- audit_table_changes() (UPDATE/DELETE with old/new row + auth.uid()).
-- Idempotent: ADD COLUMN IF NOT EXISTS + DROP TRIGGER IF EXISTS before CREATE.
-- Applied out-of-band to prod via MCP (ledger version 20261107012337); this
-- repo file is named 1:1 to keep the migration chains aligned (seeds pattern).

-- 1) updated_at columns where missing ------------------------------
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.quizzes  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2) auto-touch triggers (existing public.set_updated_at()) --------
DROP TRIGGER IF EXISTS set_subjects_updated_at ON public.subjects;
CREATE TRIGGER set_subjects_updated_at
  BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_quizzes_updated_at ON public.quizzes;
CREATE TRIGGER set_quizzes_updated_at
  BEFORE UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_subject_lectures_updated_at ON public.subject_lectures;
CREATE TRIGGER set_subject_lectures_updated_at
  BEFORE UPDATE ON public.subject_lectures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) audit coverage (existing public.audit_table_changes()) --------
-- subjects · subject_lectures · summaries · quizzes · news · videos · files
-- (summaries already had tr_update_summaries_updated_at from baseline:3898;
--  audit was only on courses/profiles/admins — content tables now covered)
DROP TRIGGER IF EXISTS tr_audit_subjects_changes ON public.subjects;
CREATE TRIGGER tr_audit_subjects_changes
  AFTER DELETE OR UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

DROP TRIGGER IF EXISTS tr_audit_subject_lectures_changes ON public.subject_lectures;
CREATE TRIGGER tr_audit_subject_lectures_changes
  AFTER DELETE OR UPDATE ON public.subject_lectures
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

DROP TRIGGER IF EXISTS tr_audit_summaries_changes ON public.summaries;
CREATE TRIGGER tr_audit_summaries_changes
  AFTER DELETE OR UPDATE ON public.summaries
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

DROP TRIGGER IF EXISTS tr_audit_quizzes_changes ON public.quizzes;
CREATE TRIGGER tr_audit_quizzes_changes
  AFTER DELETE OR UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

DROP TRIGGER IF EXISTS tr_audit_news_changes ON public.news;
CREATE TRIGGER tr_audit_news_changes
  AFTER DELETE OR UPDATE ON public.news
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

DROP TRIGGER IF EXISTS tr_audit_videos_changes ON public.videos;
CREATE TRIGGER tr_audit_videos_changes
  AFTER DELETE OR UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

DROP TRIGGER IF EXISTS tr_audit_files_changes ON public.files;
CREATE TRIGGER tr_audit_files_changes
  AFTER DELETE OR UPDATE ON public.files
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();
-- NOTE: quiz_questions deliberately excluded — the quiz-edit flow is
-- delete-all + re-insert, which would flood audit_logs; the reconcile
-- engine already detects question changes via the per-quiz question-set
-- hash in the sync ledger (see specs/037-sync-hardening/spec.md).
