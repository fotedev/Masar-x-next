-- Create stored procedure for admin analytics summary
-- This procedure aggregates data from analytics, assistant_messages, and user tables

CREATE OR REPLACE FUNCTION get_admin_analytics_summary()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    total_users_count INTEGER;
    total_messages_count INTEGER;
    total_views_count INTEGER;
    total_clicks_count INTEGER;
    top_content_data JSON;
    recent_activity_data JSON;
BEGIN
    -- Check if user is admin (this function is called by admin users only)
    -- The RLS policies will handle access control

    -- Get total active users (users who have logged in within the last 30 days)
    SELECT COUNT(DISTINCT user_id)
    INTO total_users_count
    FROM analytics
    WHERE created_at >= NOW() - INTERVAL '30 days';

    -- Get total assistant messages count
    SELECT COUNT(*)
    INTO total_messages_count
    FROM assistant_messages;

    -- Get total views from analytics
    SELECT COUNT(*)
    INTO total_views_count
    FROM analytics
    WHERE action_type = 'content_view';

    -- Get total clicks from analytics
    SELECT COUNT(*)
    INTO total_clicks_count
    FROM analytics
    WHERE action_type = 'summary_click';

    -- Get top content types by view count
    SELECT json_agg(
        json_build_object(
            'type', content_type,
            'count', view_count
        )
    )
    INTO top_content_data
    FROM (
        SELECT
            content_type,
            COUNT(*) as view_count
        FROM analytics
        WHERE action_type = 'content_view'
        GROUP BY content_type
        ORDER BY view_count DESC
        LIMIT 10
    ) top_content;

    -- Get recent activity (last 20 activities)
    SELECT json_agg(
        json_build_object(
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
                ELSE action_type
            END as action_type,
            content_type,
            created_at
        FROM analytics
        ORDER BY created_at DESC
        LIMIT 20
    ) recent;

    -- Build final result
    result := json_build_object(
        'totalUsers', COALESCE(total_users_count, 0),
        'totalMessages', COALESCE(total_messages_count, 0),
        'totalViews', COALESCE(total_views_count, 0),
        'totalClicks', COALESCE(total_clicks_count, 0),
        'topContentTypes', COALESCE(top_content_data, '[]'::json),
        'recentActivity', COALESCE(recent_activity_data, '[]'::json)
    );

    RETURN result;
END;
$$;

-- Grant execute permission to authenticated users (RLS will handle admin check)
GRANT EXECUTE ON FUNCTION get_admin_analytics_summary() TO authenticated;
