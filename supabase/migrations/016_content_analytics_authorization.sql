-- =============================================================================
-- 016: Content analytics authorization
-- Spec 016, finding F17 (follow-up to 015).
--
-- Same rationale as 015: SECURITY DEFINER bypasses RLS, so authorization must
-- be procedural. This function returns TABLE (not json) and is LANGUAGE sql,
-- which cannot RAISE, so it is converted to plpgsql with RETURN QUERY to fail
-- explicitly for non-admins instead of returning ambiguous empty rows.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_content_analytics_internal()
RETURNS TABLE(content_id text, content_type text, views_count bigint, clicks_count bigint, unique_views_count bigint, last_updated timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'unauthorized';
    END IF;

    RETURN QUERY
    SELECT
        a.content_id,
        a.content_type,
        count(*) FILTER (WHERE a.action_type = 'content_view') AS views_count,
        count(*) FILTER (WHERE a.action_type = 'summary_click') AS clicks_count,
        count(DISTINCT a.metadata->>'session_id') FILTER (WHERE a.action_type = 'content_view') AS unique_views_count,
        max(a.created_at) AS last_updated
    FROM public.analytics AS a
    GROUP BY a.content_id, a.content_type;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_content_analytics_internal() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_content_analytics_internal() TO authenticated;