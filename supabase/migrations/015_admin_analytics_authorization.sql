-- =============================================================================
-- 015: Admin analytics authorization
-- Spec 016, finding F17.
--
-- SECURITY DEFINER bypasses RLS, so authorization must be procedural. Keep the
-- JSON contract unchanged for real admins and fail before reading any analytics
-- table for every other caller.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_analytics_summary()
RETURNS pg_catalog.json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    result pg_catalog.json;
    total_users_count integer;
    total_messages_count integer;
    total_views_count integer;
    total_clicks_count integer;
    top_content_data pg_catalog.json;
    recent_activity_data pg_catalog.json;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'unauthorized';
    END IF;

    -- Active users: login or relevant activity within the last 30 days.
    SELECT count(DISTINCT u.id)
    INTO total_users_count
    FROM auth.users u
    LEFT JOIN public.analytics a ON u.id = a.user_id
    WHERE (a.action_type = 'user_login' AND a.created_at >= now() - interval '30 days')
       OR (a.created_at >= now() - interval '30 days' AND a.action_type IN ('summary_view', 'summary_click', 'ai_interaction', 'content_view', 'link_click'));

    SELECT count(*)
    INTO total_messages_count
    FROM public.assistant_messages;

    SELECT count(*)
    INTO total_views_count
    FROM public.analytics
    WHERE action_type = 'content_view';

    SELECT count(*)
    INTO total_clicks_count
    FROM public.analytics
    WHERE action_type IN ('summary_click', 'link_click');

    SELECT pg_catalog.json_agg(
        pg_catalog.json_build_object(
            'type', content_type,
            'count', view_count
        )
    )
    INTO top_content_data
    FROM (
        SELECT
            content_type,
            count(*) AS view_count
        FROM public.analytics
        WHERE action_type = 'content_view'
        GROUP BY content_type
        ORDER BY view_count DESC
        LIMIT 10
    ) top_content;

    SELECT pg_catalog.json_agg(
        pg_catalog.json_build_object(
            'action', action_type,
            'content_type', content_type,
            'created_at', created_at::text
        )
    )
    INTO recent_activity_data
    FROM (
        SELECT
            CASE
                WHEN action_type = 'content_view' THEN 'عرض'
                WHEN action_type = 'summary_click' THEN 'نقر'
                WHEN action_type = 'summary_view' THEN 'عرض ملخص'
                WHEN action_type = 'ai_interaction' THEN 'تفاعل مع الذكاء الاصطناعي'
                WHEN action_type = 'link_click' THEN 'نقر على رابط'
                WHEN action_type = 'user_login' THEN 'تسجيل دخول'
                WHEN action_type = 'user_logout' THEN 'تسجيل خروج'
                ELSE action_type
            END AS action_type,
            content_type,
            created_at
        FROM public.analytics
        WHERE action_type NOT IN ('user_login', 'user_logout')
        ORDER BY created_at DESC
        LIMIT 20
    ) recent;

    result := pg_catalog.json_build_object(
        'totalUsers', coalesce(total_users_count, 0),
        'totalMessages', coalesce(total_messages_count, 0),
        'totalViews', coalesce(total_views_count, 0),
        'totalClicks', coalesce(total_clicks_count, 0),
        'topContentTypes', coalesce(top_content_data, '[]'::pg_catalog.json),
        'recentActivity', coalesce(recent_activity_data, '[]'::pg_catalog.json)
    );

    RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_admin_analytics_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_analytics_summary() TO authenticated;
