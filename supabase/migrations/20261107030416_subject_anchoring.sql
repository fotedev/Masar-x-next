-- Spec 038 — subject anchoring: subject_id FK layer on content tables
-- Additive only; idempotent; zero app changes (app keeps name-string queries).

-- 1) columns (nullable by design: unmapped names stay NULL — the 3 manifest-only
--    Y2 subjects are unseeded pending owner decision; user content is out of sync scope)
ALTER TABLE public.subject_lectures ADD COLUMN IF NOT EXISTS subject_id uuid;
ALTER TABLE public.summaries        ADD COLUMN IF NOT EXISTS subject_id uuid;
ALTER TABLE public.quizzes          ADD COLUMN IF NOT EXISTS subject_id uuid;

-- 2) shared normalizer — matches sync-reconcile.mjs norm(): lowercase, strip
--    whitespace/dots/hyphens/en-dash/underscores
CREATE OR REPLACE FUNCTION public.norm_subject_name(v text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT lower(regexp_replace(coalesce(v, ''), '[\s.\-–_]+', '', 'g'));
$$;

-- 3) backfill against subjects.name then subjects.name_en (quiz seeds write the
--    Arabic subjects.name verbatim; expected 100% coverage on seeded rows)
UPDATE public.subject_lectures sl
SET subject_id = s.id
FROM public.subjects s
WHERE sl.subject_id IS NULL
  AND (public.norm_subject_name(s.name) = public.norm_subject_name(sl.subject)
    OR (s.name_en IS NOT NULL AND public.norm_subject_name(s.name_en) = public.norm_subject_name(sl.subject)));

UPDATE public.summaries sm
SET subject_id = s.id
FROM public.subjects s
WHERE sm.subject_id IS NULL
  AND (public.norm_subject_name(s.name) = public.norm_subject_name(sm.subject)
    OR (s.name_en IS NOT NULL AND public.norm_subject_name(s.name_en) = public.norm_subject_name(sm.subject)));

UPDATE public.quizzes q
SET subject_id = s.id
FROM public.subjects s
WHERE q.subject_id IS NULL AND q.subject IS NOT NULL
  AND (public.norm_subject_name(s.name) = public.norm_subject_name(q.subject)
    OR (s.name_en IS NOT NULL AND public.norm_subject_name(s.name_en) = public.norm_subject_name(q.subject)));

-- 4) FK constraints — DO-block guard (Postgres has no ADD CONSTRAINT IF NOT EXISTS)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['subject_lectures','summaries','quizzes'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'fk_' || t || '_subject_id'
        AND conrelid = ('public.' || t)::regclass
        AND contype = 'f'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT fk_%s_subject_id FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE SET NULL',
        t, t
      );
    END IF;
  END LOOP;
END $$;

-- 5) auto-anchor trigger: every insert / subject edit resolves the anchor from
--    the string (string is today's source of truth; NULL when nothing matches).
--    SECURITY INVOKER — user-content inserts resolve via the subjects SELECT policy.
CREATE OR REPLACE FUNCTION public.sync_subject_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.subject IS NULL THEN
    NEW.subject_id := NULL;
    RETURN NEW;
  END IF;
  SELECT s.id INTO NEW.subject_id
  FROM public.subjects s
  WHERE public.norm_subject_name(s.name) = public.norm_subject_name(NEW.subject)
     OR (s.name_en IS NOT NULL AND public.norm_subject_name(s.name_en) = public.norm_subject_name(NEW.subject))
  LIMIT 1;
  IF NOT FOUND THEN
    NEW.subject_id := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tr_sync_subject_id ON public.subject_lectures;
CREATE TRIGGER tr_sync_subject_id BEFORE INSERT OR UPDATE OF subject ON public.subject_lectures
FOR EACH ROW EXECUTE FUNCTION public.sync_subject_id();

DROP TRIGGER IF EXISTS tr_sync_subject_id ON public.summaries;
CREATE TRIGGER tr_sync_subject_id BEFORE INSERT OR UPDATE OF subject ON public.summaries
FOR EACH ROW EXECUTE FUNCTION public.sync_subject_id();

DROP TRIGGER IF EXISTS tr_sync_subject_id ON public.quizzes;
CREATE TRIGGER tr_sync_subject_id BEFORE INSERT OR UPDATE OF subject ON public.quizzes
FOR EACH ROW EXECUTE FUNCTION public.sync_subject_id();
