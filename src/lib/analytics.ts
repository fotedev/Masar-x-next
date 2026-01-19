import { supabase } from './supabase';
import { getSessionId } from './session';

// Types for Analytics
export interface AnalyticsEvent {
    name: string;
    page?: string;
    metadata?: Record<string, any>;
}

export interface SystemLog {
    level: 'info' | 'warn' | 'error' | 'fatal';
    message: string;
    statusCode?: number;
    requestId?: string;
    endpoint?: string;
    metadata?: Record<string, any>;
}

class AnalyticsService {
    /**
     * Tracks a generic event (e.g., "summary_view", "summary_click").
     * Uses user_id for admin analytics and does NOT track personal user info.
     */
    async trackEvent(eventName: string, metadata: Record<string, any> = {}) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return; // Don't track for non-authenticated users

            const page = window.location.pathname;
            let actionType = eventName;
            let contentType = metadata.contentType || 'unknown';
            let contentId = metadata.id || metadata.contentId;

            // Map event names to analytics action types
            switch (eventName) {
                case 'summary_view':
                    actionType = 'content_view';
                    contentType = 'summary';
                    break;
                case 'summary_click':
                    actionType = 'summary_click';
                    contentType = 'summary';
                    break;
                case 'page_view':
                    actionType = 'page_view';
                    contentType = 'page';
                    break;
                case 'ai_interaction':
                    actionType = 'ai_interaction';
                    contentType = 'ai_response';
                    break;
                default:
                    actionType = 'other';
                    break;
            }

            const { error } = await supabase.from('analytics').insert({
                user_id: user.id,
                action_type: actionType,
                content_type: contentType,
                content_id: contentId,
                metadata: {
                    ...metadata,
                    page: page,
                    session_id: getSessionId()
                },
            });

            if (error) {
                console.error('Failed to track event:', error);
            }
        } catch (err) {
            console.error('Error tracking event:', err);
        }
    }

    /**
     * Tracks a page view.
     */
    async trackPageView() {
        await this.trackEvent('page_view');
    }

    /**
     * Logs a system error or message.
     * Useful for debugging without exposing user data.
     */
    async log(log: SystemLog) {
        try {
            const { error } = await supabase.from('system_logs').insert({
                level: log.level,
                message: log.message,
                status_code: log.statusCode,
                request_id: log.requestId,
                endpoint: log.endpoint,
                metadata: log.metadata,
            });

            if (error) {
                console.error('Failed to send log:', error);
            }
        } catch (err) {
            console.error('Error sending log:', err);
        }
    }

    /**
     * Helper to log an error specifically.
     */
    async logError(error: Error | string, context: Partial<SystemLog> = {}) {
        const message = error instanceof Error ? error.message : error;
        await this.log({
            level: 'error',
            message,
            ...context,
            metadata: {
                ...(context.metadata || {}),
                stack: error instanceof Error ? error.stack : undefined,
            },
        });
    }
}

export const analytics = new AnalyticsService();
