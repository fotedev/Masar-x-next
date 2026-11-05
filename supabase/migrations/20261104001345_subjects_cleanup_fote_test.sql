-- Spec 034 — remove the demo subjects "FOTE" and "test" (owner-directed 2026-11-04:
-- "لماذا مازالت المواد التجريبية"). Counts verified before apply: subjects=2,
-- subject_lectures=2, quizzes/videos/files/summaries/news=0. Nothing FK-references
-- subjects.id (name-based tagging convention), so name-guarded deletes are safe and
-- idempotent (rerun = no-op).
DELETE FROM public.subject_lectures WHERE subject IN ('FOTE', 'test');
DELETE FROM public.subjects WHERE name IN ('FOTE', 'test');
