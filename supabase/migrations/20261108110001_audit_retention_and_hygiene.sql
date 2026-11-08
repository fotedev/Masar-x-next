-- Spec 041 — audit_logs retention, grant hygiene, course-materials scoping
-- (review 2026-11-07, d08).

-- 1) Retention. audit_logs is written on every UPDATE/DELETE of 10 tables
--    (baseline courses/profiles/admins + spec-037 subjects/subject_lectures/
--    summaries/quizzes/news/videos/files) and had no pruning at all.
--    Default 90 days, floor of 7 so a stray call cannot wipe recent history.
CREATE OR REPLACE FUNCTION public.prune_audit_logs(p_days integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  deleted integer;
BEGIN
  IF p_days < 7 THEN
    RAISE EXCEPTION 'prune_audit_logs: retention below 7 days is refused';
  END IF;
  DELETE FROM public.audit_logs
  WHERE "timestamp" < now() - make_interval(days => greatest(p_days, 7));
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END $$;

REVOKE ALL ON FUNCTION public.prune_audit_logs(integer) FROM PUBLIC, anon, authenticated;
-- Scheduled via pg_cron below (runs as postgres); interactive runs need an
-- elevated role by design.

-- 2) Schedule nightly at 03:00 UTC. pg_cron is available-but-not-installed on
--    prod (verified 2026-11-08); installing it here is the standard Supabase
--    pattern. Unschedule first so the migration stays idempotent.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

SELECT cron.unschedule('prune-audit-logs')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-audit-logs');

SELECT cron.schedule(
  'prune-audit-logs',
  '0 3 * * *',
  $$SELECT public.prune_audit_logs(90)$$
);

-- 3) Grant hygiene: baseline granted DELETE/INSERT/UPDATE on audit_logs to
--    anon+authenticated blanket; RLS has no matching policies so the grants
--    are dead surface — remove them (SELECT stays for the existing read
--    policies).
REVOKE DELETE, INSERT, UPDATE ON public.audit_logs FROM anon, authenticated;

-- 4) course-materials scoping. Spec 040's stopgap let ANY authenticated user
--    read the bucket; the baseline policies intended {course-uuid}/... paths
--    + enrollment. Prod probe 2026-11-08: the bucket holds ZERO objects and
--    no app code uploads to it, so tightening to enrollment-scoped is a
--    zero-impact closure of the dormant surface. The path→uuid cast is
--    guarded (CASE, not a bare cast) so a non-uuid first segment can never
--    error the policy, and enrollment/instructor checks run through a
--    SECURITY DEFINER helper so enrollments RLS cannot hide the row the
--    policy needs to see.
CREATE OR REPLACE FUNCTION public.storage_course_materials_readable(p_name text, p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  WITH seg AS (
    SELECT CASE
      WHEN (storage.foldername(p_name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN ((storage.foldername(p_name))[1])::uuid
      ELSE NULL::uuid
    END AS course_id
  )
  SELECT
    seg.course_id IS NOT NULL
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.enrollments e
        WHERE e.course_id = seg.course_id
          AND e.student_id = p_user
          AND e.status = 'active'
      )
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = seg.course_id
          AND c.instructor_id = p_user
      )
    )
  FROM seg
$$;

REVOKE ALL ON FUNCTION public.storage_course_materials_readable(text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storage_course_materials_readable(text, uuid)
  TO authenticated;

DROP POLICY IF EXISTS "course_materials_read_authenticated" ON storage.objects;
CREATE POLICY "course_materials_read_enrolled" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'course-materials'
    AND public.storage_course_materials_readable(name, auth.uid())
  );
