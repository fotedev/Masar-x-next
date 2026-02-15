import { supabase } from './supabase';
import { getSessionId } from './session';

// Types for Analytics
export interface AnalyticsEvent {
    name: string;
    page?: string;
    metadata?: Record<string, unknown>;
}

export interface SystemLog {
    level: 'info' | 'warn' | 'error' | 'fatal';
    message: string;
    statusCode?: number;
    requestId?: string;
    endpoint?: string;
    metadata?: Record<string, unknown>;
}

type AnalyticsMetadata = Record<string, unknown> & {
    contentType?: string;
    id?: string;
    contentId?: string;
};

class AnalyticsService {
    /**
     * Tracks a generic event (e.g., "summary_view", "summary_click").
     * Uses user_id for admin analytics and does NOT track personal user info.
     */
    async trackEvent(eventName: string, metadata: AnalyticsMetadata = {}) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return; // Don't track for non-authenticated users

            const page = window.location.pathname;
            let actionType = eventName;
            let contentType = metadata.contentType || 'unknown';
            const contentId = metadata.id || metadata.contentId;

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

            try {
                await supabase.from('analytics').insert({
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
            } catch {
                // ignore
            }
        } catch {
            // ignore
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
            try {
                await supabase.from('system_logs').insert({
                    level: log.level,
                    message: log.message,
                    status_code: log.statusCode,
                    request_id: log.requestId,
                    endpoint: log.endpoint,
                    metadata: log.metadata,
                });
            } catch {
                // ignore
            }
        } catch {
            // ignore
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
