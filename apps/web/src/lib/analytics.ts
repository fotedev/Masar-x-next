import { supabase } from './supabase';

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
     * Lean-analytics migration (owner directive, 2026-10-21): the Postgres
     * `analytics` table no longer receives event rows — page views, clicks
     * and the like were Free-Tier bloat and surveillance-style tracking.
     * The meaningful signals (file downloads, AI usage, active users) now
     * go through Redis counters via lib/metrics.ts and /api/metrics/event;
     * genuine sign-ins still land a user_login row via analyticsHelpers.
     *
     * This method stays as a no-op because trackEvent is threaded through
     * several component/hook signatures (useAiChat, quiz hooks, the desktop
     * workspace); ripping the plumbing out is deferred cleanup.
     */
    async trackEvent(_eventName: string, _metadata: AnalyticsMetadata = {}): Promise<void> {
        // intentionally empty
    }

    /**
     * Logs a system error or message to the `system_logs` table. This is
     * error/debug telemetry, NOT user analytics — it stays on Postgres.
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
                console.error('[analytics] system_logs insert failed:', log.level, error.message);
            }
        } catch {
            // ignore — system log writes must never throw into callers
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
