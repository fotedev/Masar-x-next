-- =============================================================================
-- 017: Admin analytics truthful counts
-- Fix batch 2026-10-21 (admin-dashboard audit, 20-agent sweep).
--
-- Three defects in 015's get_admin_analytics_summary():
--   1. totalMessages read public.assistant_messages — a table nothing in the
--      repo ever writes (chat persists to ai_chat_messages since 009), so the
--      "Assistant Messages" card was permanently 0. Count assistant-role rows
--      from ai_chat_messages instead.
--   2. recent_activity pre-translated action_type into Arabic literals while
--      the client matched English literals ('click', 'ai_interaction', …) —
--      every trend badge and most action labels were dead code. Return RAW
--      action_type; display translation belongs to the client's i18n.
--   4. Views counted action_type='content_view', an event the client has
--      NEVER written once (prod analytics: 0 content_view rows ever; the
--      real writer emits 'page_view' — 1,700+ rows). Count both so the
--      Views card reflects actual usage; the client's views trend already
--      treats page_view as a view.
--   3. recent_activity omitted user_id (needed by the client's active-users
--      trend) and its LIMIT 20 starved the 7d-vs-prior-7d trend windows.
--      Include user_id, raise the window to 100.
--
-- Authorization contract unchanged from 015: SECURITY DEFINER, procedural
-- is_admin() gate, no anon access.
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

    -- Assistant messages: the live chat persistence table (009). role='assistant'
    -- excludes the mirrored user-side rows so the card counts what its label says.
    SELECT count(*)
    INTO total_messages_count
    FROM public.ai_chat_messages
    WHERE role = 'assistant';

    SELECT count(*)
    INTO total_views_count
    FROM public.analytics
    WHERE action_type IN ('content_view', 'page_view');

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
        WHERE action_type IN ('content_view', 'page_view')
        GROUP BY content_type
        ORDER BY view_count DESC
        LIMIT 10
    ) top_content;

    -- RAW action_type (client translates via i18n) + user_id (client's
    -- active-users trend needs it). Window of 100 feeds the 7d/prev-7d math.
    SELECT pg_catalog.json_agg(
        pg_catalog.json_build_object(
            'action', action_type,
            'content_type', content_type,
            'created_at', created_at::text,
            'user_id', user_id::text
        )
    )
    INTO recent_activity_data
    FROM (
        SELECT
            action_type,
            content_type,
            created_at,
            user_id
        FROM public.analytics
        WHERE action_type NOT IN ('user_login', 'user_logout')
        ORDER BY created_at DESC
        LIMIT 100
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
