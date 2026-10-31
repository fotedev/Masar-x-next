-- ============================================================
-- 013_semester_management.sql — Spec 013 (lightweight semester management)
--
-- Profile-driven display filtering: `profiles.semester` is the single
-- controller of what a student sees. Admins set a global default
-- (`platform_settings['default_semester']`, applied to new signups) and can
-- bulk-migrate passive students to a new term with one RPC call. Students may
-- always switch their own semester (`semester_manually_set = true` protects
-- that choice from bulk migrations unless the admin forces it).
--
-- Display/UX only — nothing here gates content server-side; no new tables.
--
-- NOTE (prod drift, same pattern documented in 010): the 1..2 semester CHECK
-- was already widened to 1..3 directly on prod; this file is idempotent and
-- converges to the same end state on any environment.
-- ============================================================

-- 1. Intent-preservation columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS semester_manually_set boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS semester_updated_at timestamptz;

-- 2. Semester CHECK: allow 1|2|3 (3 = summer). Drop-then-add is idempotent.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_semester_range;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_semester_range
  CHECK (semester IS NULL OR semester BETWEEN 1 AND 3);

-- 3. Global default semester for new signups (backfilled from active_semester)
INSERT INTO public.platform_settings (key, value, updated_at)
VALUES (
  'default_semester',
  COALESCE(
    (SELECT value FROM public.platform_settings WHERE key = 'active_semester'),
    '{"semester": 1}'::jsonb
  ),
  now()
)
ON CONFLICT (key) DO NOTHING;

-- 4. New-user trigger: inherit the platform default semester (passive choice —
--    bulk migration may move it later; explicit onboarding still overrides).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, semester, semester_manually_set)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE((
      SELECT (value->>'semester')::int
      FROM public.platform_settings
      WHERE key = 'default_semester'
    ), 1),
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 5. Admin bulk migration — ONE atomic statement (READ COMMITTED re-checks the
--    WHERE predicate on row-lock wait, so a concurrent student self-update
--    that commits first is never clobbered), admins excluded, default semester
--    upserted in the same transaction. Returns the migrated row count.
CREATE OR REPLACE FUNCTION public.admin_migrate_student_semesters(
  p_target_semester int,
  p_overwrite_manual boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF p_target_semester NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'invalid_semester';
  END IF;

  UPDATE public.profiles
     SET semester = p_target_semester,
         semester_manually_set = false,
         semester_updated_at = now()
   WHERE (COALESCE(NOT semester_manually_set, true) OR p_overwrite_manual)
     AND NOT EXISTS (
       SELECT 1 FROM public.admins WHERE admins.user_id = profiles.id
     );
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.platform_settings (key, value, updated_at)
  VALUES ('default_semester', jsonb_build_object('semester', p_target_semester), now())
  ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value,
         updated_at = now();

  RETURN v_count;
END;
$$;

-- 6. Privileges: the owning user must be able to update the new columns even
--    if default privileges were narrowed; the RPC is admin-guarded internally.
GRANT UPDATE ON public.profiles TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_migrate_student_semesters(int, boolean) TO authenticated;
