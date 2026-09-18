-- ============================================================================
-- 010_launch_rls_remediation.sql — pre-launch RLS punch list
--
-- Targets the LIVE production schema (G3.9 drift: several tables/policies
-- here exist only in prod or migrations.old, not in migrations 001-009;
-- re-applying this file on a fresh 001-009 build is NOT supported for the
-- quizzes/courses/summaries sections without the legacy schema).
-- Every statement is idempotent; re-running is safe.
--
-- Fixes (audit: docs/audits/mvp-readiness-audit-2026-09-18/):
--   1. summaries           — UPDATE/DELETE USING(true) + all-status SELECT for
--                            any authenticated user → owner-or-admin writes,
--                            approved-only public reads, admin-only status.
--   2. system_access_codes — authenticated SELECT leaked redeemable keys →
--                            security-definer RPC replaces client-side check.
--   3. quizzes             — client wrote created_by while all live policies
--                            check user_id → backfill + canonical user_id.
--   4. courses             — no anon SELECT despite public /courses route.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. summaries: owner-or-admin writes, approved-only public reads
-- ---------------------------------------------------------------------------

-- The live policies are quoted names (see docs/audits/rls-audit-2026-09-18.md:365-367).
DROP POLICY IF EXISTS "Authenticated users can delete summaries" ON public.summaries;
DROP POLICY IF EXISTS "Authenticated users can update summaries" ON public.summaries;
DROP POLICY IF EXISTS "Authenticated users can view all summaries" ON public.summaries;

-- Kept as-is: "Anyone can view approved summaries" (SELECT TO public,
-- status = 'approved') and "summaries_insert_authenticated"
-- (INSERT WITH CHECK auth.uid() = user_id).

DROP POLICY IF EXISTS summaries_select_own_or_admin ON public.summaries;
CREATE POLICY summaries_select_own_or_admin
  ON public.summaries FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS summaries_update_own_or_admin ON public.summaries;
CREATE POLICY summaries_update_own_or_admin
  ON public.summaries FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS summaries_delete_own_or_admin ON public.summaries;
CREATE POLICY summaries_delete_own_or_admin
  ON public.summaries FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- RLS cannot restrict per-column updates: without this guard the owner of a
-- pending summary could flip its own status to 'approved' via the API and
-- publish it unmoderated. Status transitions stay admin/service-role-only.
-- (edit-summary/useEditSummary never write status — verified 2026-09-19.)
CREATE OR REPLACE FUNCTION public.summaries_status_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT COALESCE(public.is_admin(), false)
     AND current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Only admins can change summary status'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS summaries_status_guard ON public.summaries;
CREATE TRIGGER summaries_status_guard
  BEFORE UPDATE OF status ON public.summaries
  FOR EACH ROW EXECUTE FUNCTION public.summaries_status_guard();

-- ---------------------------------------------------------------------------
-- 2. system_access_codes: no client-readable keys, RPC-verified redemption
-- ---------------------------------------------------------------------------

-- The header's secret-code gate (Header.tsx verifyAccessKey) previously
-- SELECTed the matching row and UPDATEd used_count directly from the browser.
DROP POLICY IF EXISTS "Allow authenticated users to read access keys"
  ON public.system_access_codes;

-- Kept as-is: "Allow admins to manage access keys" (ALL TO public, admin
-- USING; WITH CHECK defaults to the same admin expression).

-- Atomic verify-and-consume. FOR UPDATE locks the row so concurrent calls
-- cannot push used_count past max_uses. Returns a status enum instead of the
-- row, so the key value never crosses the wire.
CREATE OR REPLACE FUNCTION public.verify_system_access_code(p_access_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used int;
  v_max  int;
BEGIN
  SELECT used_count, max_uses INTO v_used, v_max
    FROM public.system_access_codes
   WHERE access_key = p_access_key
     AND expires_at > now()
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'invalid';
  END IF;

  IF v_used >= v_max THEN
    RETURN 'exhausted';
  END IF;

  UPDATE public.system_access_codes
     SET used_count = used_count + 1
   WHERE access_key = p_access_key
     AND expires_at > now();

  RETURN 'valid';
END;
$$;

-- Supabase default privileges grant EXECUTE on new functions to anon,
-- authenticated and service_role explicitly (not just PUBLIC), so each role
-- must be revoked individually. The gate requires a login: enterMatrix writes
-- profiles.show_extra_assets, and unauthenticated brute-force of the key
-- space should not be possible via RPC.
REVOKE ALL ON FUNCTION public.verify_system_access_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_system_access_code(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.verify_system_access_code(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. quizzes: align data with the user_id-canonical live policies
-- ---------------------------------------------------------------------------

-- All four live quizzes policies check auth.uid() = user_id
-- (rls-audit-2026-09-18.md:324-334). The admin dashboard wrote created_by;
-- ensure the column exists, then backfill both directions.
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.quizzes
   SET user_id = COALESCE(user_id, created_by)
 WHERE user_id IS NULL AND created_by IS NOT NULL;

UPDATE public.quizzes
   SET created_by = COALESCE(created_by, user_id)
 WHERE created_by IS NULL AND user_id IS NOT NULL;

-- Safety net for future inserts that omit user_id.
ALTER TABLE public.quizzes ALTER COLUMN user_id SET DEFAULT auth.uid();

-- ---------------------------------------------------------------------------
-- 4. courses: anon read for published courses (public /courses route + sitemap)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS courses_anon_view_published ON public.courses;
CREATE POLICY courses_anon_view_published
  ON public.courses FOR SELECT TO anon
  USING (is_published = true);
