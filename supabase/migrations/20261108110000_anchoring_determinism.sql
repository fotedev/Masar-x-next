-- Spec 041 — anchoring determinism (review 2026-11-07, d08).
--
-- The spec-038 trigger resolved the anchor with `LIMIT 1` and no ORDER BY, so
-- when one subject's `name` normalized equal to another's `name_en`, the
-- anchored row was arbitrary. Tiebreak on creation time (oldest row wins —
-- the original seed) then id for a total order. Body otherwise identical to
-- 20261107030416 (SECURITY INVOKER preserved via CREATE OR REPLACE).

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
  ORDER BY s.created_at NULLS LAST, s.id
  LIMIT 1;
  IF NOT FOUND THEN
    NEW.subject_id := NULL;
  END IF;
  RETURN NEW;
END $$;

-- Triggers from 20261107030416 keep pointing at the same function; no
-- trigger DDL needed. Historical backfill UPDATEs in that migration already
-- ran and are not re-executed.
