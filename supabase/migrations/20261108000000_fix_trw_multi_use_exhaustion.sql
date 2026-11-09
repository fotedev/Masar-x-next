-- Spec 040 (W7 finding) — fix multi-use access-code exhaustion.
--
-- BUG (found by supabase/tests/rpc-verify.sql on a portable-PG rebuild of
-- this migration chain): trw_redeem_access_code increments used_count in
-- one UPDATE and deactivates the code in a SECOND statement. The
-- `no_exhausted_active` CHECK (NOT (used_count >= max_uses AND is_active))
-- fires the moment used_count reaches max_uses while the row is still
-- active — so the FINAL redemption of any code with max_uses > 1 raises a
-- check-constraint error to the caller instead of succeeding, and the
-- rollback leaves the code forever "redeemable-but-always-erroring".
--
-- Prod exposure at authoring time (2026-11-08): zero codes with
-- max_uses > 1 exist, so the defect is latent — but every future multi-use
-- code would break on its last redemption.
--
-- FIX: collapse increment + auto-deactivation into ONE atomic UPDATE so
-- the CHECK evaluates the post-statement row (used_count+1, is_active
-- recomputed together). is_active = is_active AND (new_count < max_uses)
-- also keeps a manually-deactivated code deactivated.
--
-- APPLICATION: repo-file only for now — apply to production via the
-- supabase-masarx MCP apply_migration (which writes the ledger row and
-- should then rename this file 1:1 to the ledger version). Owner decision
-- tracked in spec 040.

CREATE OR REPLACE FUNCTION public.trw_redeem_access_code(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_code        public.trw_access_codes%ROWTYPE;
  v_plan        public.trw_plan_definitions%ROWTYPE;
  v_user_id     UUID := auth.uid();
  v_expires_at  TIMESTAMPTZ;
  v_membership  public.trw_memberships%ROWTYPE;
BEGIN
  -- Guard: must be authenticated
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Lock + fetch the code atomically
  SELECT * INTO v_code
  FROM public.trw_access_codes
  WHERE code = p_code
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND used_count < max_uses
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_or_expired_code');
  END IF;

  -- Check for duplicate redemption
  IF EXISTS (
    SELECT 1 FROM public.trw_access_code_redemptions
    WHERE code_id = v_code.id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_redeemed');
  END IF;

  -- Compute membership expiry
  v_expires_at := CASE
    WHEN v_code.membership_duration_days IS NOT NULL
      THEN now() + (v_code.membership_duration_days || ' days')::INTERVAL
    ELSE NULL  -- Permanent
  END;

  -- Fetch plan
  SELECT * INTO v_plan FROM public.trw_plan_definitions WHERE id = v_code.plan_id;

  -- Upsert membership
  INSERT INTO public.trw_memberships (user_id, plan_id, granted_by, expires_at, notes)
  VALUES (v_user_id, v_code.plan_id, NULL, v_expires_at, 'Redeemed via code: ' || p_code)
  ON CONFLICT (user_id, plan_id) DO UPDATE
    SET expires_at = EXCLUDED.expires_at,
        revoked_at = NULL,
        granted_at = now(),
        notes      = EXCLUDED.notes
  RETURNING * INTO v_membership;

  -- Record redemption
  INSERT INTO public.trw_access_code_redemptions (code_id, user_id, membership_id)
  VALUES (v_code.id, v_user_id, v_membership.id);

  -- Increment usage and auto-deactivate at exhaustion ATOMICALLY (one
  -- statement — the no_exhausted_active CHECK evaluates the combined row,
  -- so the final redemption succeeds instead of erroring).
  UPDATE public.trw_access_codes
     SET used_count = used_count + 1,
         is_active = is_active AND (used_count + 1 < max_uses)
   WHERE id = v_code.id;

  -- Write audit log
  INSERT INTO public.trw_membership_audit_log
    (membership_id, user_id, actor_id, action, plan_slug, notes)
  VALUES
    (v_membership.id, v_user_id, NULL, 'granted', v_plan.slug, 'Code redemption');

  RETURN jsonb_build_object(
    'success',    true,
    'plan_slug',  v_plan.slug,
    'expires_at', v_expires_at
  );
END;
$function$
;
