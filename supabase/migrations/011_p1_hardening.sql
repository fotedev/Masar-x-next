-- ============================================================================
-- 011_p1_hardening.sql — P1-7/P1-8 punch list (audit 2026-09-18, items 7-8)
--
-- Targets the LIVE production schema (G3.9 drift; see 010 header).
-- Every statement is idempotent; re-running is safe.
--
--   1. notifications  — authenticated INSERT WITH CHECK (true) let any user
--                       deliver arbitrary title/message to ANY inbox
--                       (phishing vector) → owner-scoped direct inserts +
--                       security-definer RPC for the legitimate fan-out
--                       (student appeal notifications, admin news fan-out).
--   2. analytics      — anon INSERT (true) dropped: trackEvent returns early
--                       for guests (lib/analytics.ts), so the anon policy was
--                       pure attack surface, not telemetry.
--   3. link_logs      — "Allow system to insert logs" INSERT TO public (true)
--                       dropped: zero writers found in web/shared/functions;
--                       server-side writers would bypass RLS anyway.
--   4. system_logs    — anon+authenticated INSERT (true) constrained to valid
--                       levels and bounded message length; keeps the live
--                       client-diagnostics path (login/signup logError).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. notifications: owner-scoped inserts, provenance-checked admin fan-out
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated users can create notifications"
  ON public.notifications;

-- Kept as-is: owner-scoped SELECT/UPDATE policies.
-- createNotification() in useNotifications.ts has no callers today; this
-- policy keeps self-notifications possible without cross-user targeting.
DROP POLICY IF EXISTS notifications_insert_own ON public.notifications;
CREATE POLICY notifications_insert_own
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Replaces the client-side fan-out (useNotifications.notifyAdmins), which
-- previously read the admins table in the browser and inserted rows for
-- arbitrary user_ids. The RPC proves provenance instead:
--   - the caller filed an appeal against this exact content, OR
--   - the caller is an admin (news publish fan-out).
-- Notification `type` is validated against the column CHECK values, and
-- content length is bounded server-side.
CREATE OR REPLACE FUNCTION public.notify_admins_of_content(
  p_type text,
  p_related_type text,
  p_related_id uuid,
  p_title text,
  p_message text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean := false;
BEGIN
  IF p_type NOT IN ('admin_submission', 'content_published', 'system')
     OR p_related_type NOT IN ('summary', 'news') THEN
    RAISE EXCEPTION 'Invalid notification type or related_type'
      USING ERRCODE = '22023';
  END IF;

  IF p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 1 AND 200
     OR p_message IS NULL OR char_length(btrim(p_message)) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Invalid notification content length'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    (
      EXISTS (
        SELECT 1 FROM public.appeals
         WHERE created_by = auth.uid()
           AND content_id = p_related_id
           AND content_type = p_related_type
      )
      OR (
        COALESCE(public.is_admin(), false)
        AND (
          (p_related_type = 'summary'
            AND EXISTS (SELECT 1 FROM public.summaries WHERE id = p_related_id))
          OR
          (p_related_type = 'news'
            AND EXISTS (SELECT 1 FROM public.news WHERE id = p_related_id))
        )
      )
    )
  INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Not allowed to notify admins about this content'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.notifications
    (user_id, title, message, type, related_id, related_type, read)
  SELECT a.user_id, p_title, p_message, p_type, p_related_id, p_related_type, false
    FROM public.admins a;
END;
$$;

-- Supabase default privileges grant EXECUTE on new functions to anon,
-- authenticated and service_role explicitly; revoke each individually.
REVOKE ALL ON FUNCTION public.notify_admins_of_content(text, text, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_admins_of_content(text, text, uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.notify_admins_of_content(text, text, uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. analytics: drop the anon insert (guests never track — verified)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS analytics_insert_for_anon ON public.analytics;

-- ---------------------------------------------------------------------------
-- 3. link_logs: drop the public insert (no writers anywhere)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow system to insert logs" ON public.link_logs;

-- ---------------------------------------------------------------------------
-- 4. system_logs: constrain the client-diagnostics insert
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow anonymous insert to system_logs" ON public.system_logs;
DROP POLICY IF EXISTS system_logs_insert_constrained ON public.system_logs;
CREATE POLICY system_logs_insert_constrained
  ON public.system_logs FOR INSERT TO anon, authenticated
  WITH CHECK (
    level IN ('info', 'warn', 'error', 'fatal')
    AND char_length(message) BETWEEN 1 AND 2000
  );
