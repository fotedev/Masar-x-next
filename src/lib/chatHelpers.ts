import { supabase } from './supabase';

export const chatHelpers = {
    /**
     * Records an analytics event to the database.
     */
    async recordAnalytics(params: {
        userId: string;
        actionType: string;
        contentType: string;
        contentId?: string;
        metadata?: Record<string, any>;
    }) {
        try {
            await supabase.from('analytics').insert({
                user_id: params.userId,
                action_type: params.actionType,
                content_type: params.contentType,
                content_id: params.contentId,
                metadata: params.metadata || {},
            });
        } catch {
            // ignore
        }
    },

    /**
     * Fetches a summary of analytics for the admin dashboard.
     */
    async getAdminAnalyticsSummary() {
        try {
            const { data, error } = await supabase.rpc('get_admin_analytics_summary');

            if (error) {
                return null;
            }

            return data;
        } catch {
            return null;
        }
    }
};
