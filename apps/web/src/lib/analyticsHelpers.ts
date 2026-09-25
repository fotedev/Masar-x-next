import { supabase } from './supabase';
import type { Json } from '@/types/database';

export interface AdminAnalyticsSummary {
    totalUsers: number;
    totalMessages: number;
    totalViews: number;
    totalClicks: number;
    topContentTypes: Array<{
        type: string;
        count: number;
    }>;
    recentActivity: Array<{
        action: string;
        content_type: string;
        created_at: string;
        user_id?: string;
    }>;
}

export type AdminAnalyticsResult =
    | { data: AdminAnalyticsSummary; error: null }
    | { data: null; error: 'unauthorized' | 'load_failed' };

function isUnauthorizedError(error: { message?: string } | null): boolean {
    return error?.message?.toLowerCase().includes('unauthorized') ?? false;
}

export const analyticsHelpers = {
    /**
     * Records an analytics event to the database.
     */
    async recordAnalytics(params: {
        userId: string;
        actionType: string;
        contentType: string;
        contentId?: string;
        metadata?: Json;
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
    async getAdminAnalyticsSummary(): Promise<AdminAnalyticsResult> {
        try {
            const { data, error } = await supabase.rpc('get_admin_analytics_summary');

            if (error) {
                return {
                    data: null,
                    error: isUnauthorizedError(error) ? 'unauthorized' : 'load_failed',
                };
            }

            return { data: data as AdminAnalyticsSummary, error: null };
        } catch {
            return { data: null, error: 'load_failed' };
        }
    }
};
