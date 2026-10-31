-- ============================================================================
-- 018_audit_hotfix_hardening.sql — 2026-10-24
--
-- Hardens the live security findings from the 2026-10-24 30-agent audit
-- (masarx-plan/bug-audit-2026-10-24/REPORT.md). Written against the LIVE
-- prod schema (introspected 2026-10-24), which is the migrations.old
-- lineage — several facts here differ from the numbered-chain files:
--   * enrollments live CHECK is ('pending','active','expired') while the
--     app writes 'rejected' (useEnrollments.ts), so every instructor
--     rejection currently fails; the instructor UPDATE policy's WITH CHECK
--     also excludes 'rejected'.
--   * trw_access_codes grants SELECT (including the code column) to
--     authenticated — any user can enumerate live codes (audit C3).
--   * trw_materials/trw_courses/trw_modules do NOT exist on prod; the
--     public-read policies the audit flagged exist only in the repo record
--     (migrations.old). The policy fix below is applied conditionally so a
--     future table creation cannot reintroduce it.
--   * profiles.show_extra_assets is grantable by its own user via
--     PostgREST (audit H36): the UPDATE policy has no column guard and the
--     old verify_system_access_code RPC only counts a check — the client
--     then wrote the grant itself. Entitlement is now server-side.
-- C5 (self-service admin escalation) was introspected and is NOT live:
-- prod's is_admin() is table-membership-based and set_user_role is already
-- revoked from PUBLIC/anon/authenticated. The repo record divergence is
-- tracked by the migration-consolidation effort instead.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- H20: enrollment status vocabulary + instructor reject path
-- ---------------------------------------------------------------------------
ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enrollments_status_check;
ALTER TABLE public.enrollments
  ADD CONSTRAINT enrollments_status_check
  CHECK (status IN ('pending', 'active', 'expired', 'rejected', 'cancelled'));

DROP POLICY IF EXISTS "Instructors can approve enrollments for their courses" ON public.enrollments;
CREATE POLICY "Instructors can approve enrollments for their courses"
  ON public.enrollments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
       WHERE courses.id = enrollments.course_id
         AND courses.instructor_id = auth.uid()
    )
    AND status = 'pending'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses
       WHERE courses.id = enrollments.course_id
         AND courses.instructor_id = auth.uid()
    )
    AND status IN ('active', 'expired', 'rejected')
  );

-- H21 client-retry support: a student may revive their own rejected/expired
-- application back to 'pending' (the app upserts on the UNIQUE conflict).
-- An active enrollment can never be touched through this policy.
DROP POLICY IF EXISTS "Students can reapply after rejection" ON public.enrollments;
CREATE POLICY "Students can reapply after rejection"
  ON public.enrollments FOR UPDATE
  TO authenticated
  USING (auth.uid() = student_id AND status IN ('rejected', 'expired'))
  WITH CHECK (auth.uid() = student_id AND status = 'pending');

-- ---------------------------------------------------------------------------
-- C3: access codes must not be enumerable
-- (redemption flows through the security-definer trw_redeem_access_code RPC)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "trw_access_codes_select_auth" ON public.trw_access_codes;

-- ---------------------------------------------------------------------------
-- C2 (future-proofing): if the trw content tables ever appear on this
-- database, the URL-bearing table must not carry the audited public-read
-- policy. No-op today (tables verified absent on prod 2026-10-24).
-- ---------------------------------------------------------------------------
DO $c2$
DECLARE
  v_table_exists boolean;
  v_fn_exists    boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'trw_materials'
  ) INTO v_table_exists;
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'is_trw_member_for_category'
  ) INTO v_fn_exists;

  IF v_table_exists AND v_fn_exists THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow public read on trw_materials" ON public.trw_materials';
    EXECUTE 'DROP POLICY IF EXISTS "trw_materials_member_read" ON public.trw_materials';
    EXECUTE $policy$CREATE POLICY "trw_materials_member_read"
      ON public.trw_materials FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
            FROM public.trw_modules m
            JOIN public.trw_courses c ON c.id = m.course_id
           WHERE m.id = trw_materials.module_id
             AND public.is_trw_member_for_category(c.category_id)
        )
      )$policy$;
  END IF;
END
$c2$;

-- ---------------------------------------------------------------------------
-- H36: server-side entitlement for profiles.show_extra_assets
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS extra_assets_entitled boolean NOT NULL DEFAULT false;

-- Backfill before the guard trigger exists: anyone who currently has the
-- flag on keeps their access through the new server-side path.
UPDATE public.profiles
   SET extra_assets_entitled = true
 WHERE show_extra_assets IS TRUE
   AND extra_assets_entitled IS NOT TRUE;

CREATE OR REPLACE FUNCTION public.guard_extra_assets_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- The entitlement flag is server-managed; only redeem_system_access_code,
  -- which sets app.extra_assets_grant for its transaction, may change it.
  IF NEW.extra_assets_entitled IS DISTINCT FROM OLD.extra_assets_entitled
     AND COALESCE(current_setting('app.extra_assets_grant', true), '') <> 'on'
  THEN
    RAISE EXCEPTION 'extra_assets_entitled is managed server-side only';
  END IF;

  -- show_extra_assets may switch on only for entitled users. Entitled users
  -- keep the disable / re-enable toggle (with its existing 2h cooldown);
  -- never-entitled users cannot self-grant through PostgREST any more.
  IF NEW.show_extra_assets IS TRUE
     AND OLD.show_extra_assets IS DISTINCT FROM TRUE
     AND NEW.extra_assets_entitled IS NOT TRUE
     AND COALESCE(current_setting('app.extra_assets_grant', true), '') <> 'on'
  THEN
    RAISE EXCEPTION 'show_extra_assets requires server-side entitlement';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_extra_assets_entitlement ON public.profiles;
CREATE TRIGGER trg_guard_extra_assets_entitlement
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_extra_assets_columns();

CREATE OR REPLACE FUNCTION public.redeem_system_access_code(p_access_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_code    public.system_access_codes%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'unauthenticated');
  END IF;

  -- Best-effort per-user throttle (fail-open like every other
  -- check_rate_limit call site): 20 attempts / hour / user.
  BEGIN
    IF public.check_rate_limit(v_user_id::text, 'system_access_code_redeem', 20, 60) IS FALSE THEN
      RETURN jsonb_build_object('success', false, 'reason', 'rate_limited');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  SELECT * INTO v_code
    FROM public.system_access_codes
   WHERE access_key = p_access_key
   FOR UPDATE;

  IF NOT FOUND OR v_code.expires_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid');
  END IF;

  IF COALESCE(v_code.used_count, 0) >= COALESCE(v_code.max_uses, 1) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'exhausted');
  END IF;

  UPDATE public.system_access_codes
     SET used_count = COALESCE(used_count, 0) + 1
   WHERE access_key = p_access_key;

  PERFORM set_config('app.extra_assets_grant', 'on', true);

  UPDATE public.profiles
     SET extra_assets_entitled = true,
         show_extra_assets = true
   WHERE id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'profile_missing');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_system_access_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_system_access_code(text) TO authenticated;
