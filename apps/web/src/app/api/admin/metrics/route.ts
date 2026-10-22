import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/api-auth';
import { isAdminRole } from '@/lib/auth/roles';
import { createClient } from '@/lib/supabase/server';
import { getAdminMetrics } from '@/lib/metrics';
import { logger } from '@/lib/logger';

/**
 * Admin dashboard metrics read endpoint (lean-analytics architecture,
 * 2026-10-21): aggregates live from Upstash Redis counters plus the two
 * Postgres facts that are genuine relational data (assistant-message
 * counts from ai_chat_messages). Authorization mirrors the admin layout
 * gate: a valid session AND an admins-table row with an admin role.
 *
 * Response keeps the same top-level keys the dashboard already consumed
 * from the old RPC (totalUsers/totalMessages/totalViews/totalClicks/
 * topContentTypes/recentActivity) so the UI swap is a data-source change
 * only — "Views" now means file downloads and "Clicks" means AI
 * questions (card labels updated in the dashboard i18n). `dailyCounts`
 * powers honest 7d-vs-prior-7d trend badges without capped-row math.
 */

const TREND_DAYS = 14;

export async function GET() {
  const auth = await requireAuthenticatedUser();
  if (!('user' in auth)) return auth.response;

  const supabase = await createClient();
  const { data: adminRow } = await supabase
    .from('admins')
    .select('role')
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (!adminRow || !isAdminRole(adminRow.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const snapshot = await getAdminMetrics();

  // Assistant messages are real relational data: all-time total plus a
  // per-day breakdown for the trend windows. Row counts are tiny (the
  // table held 22 assistant rows as of 2026-10-21), so selecting the
  // timestamps and bucketing in-process is cheaper than any RPC.
  const since = new Date(Date.now() - (TREND_DAYS - 1) * 24 * 60 * 60 * 1000);
  since.setUTCHours(0, 0, 0, 0);
  const { data: messageRows, error: messagesError } = await supabase
    .from('ai_chat_messages')
    .select('created_at')
    .eq('role', 'assistant')
    .gte('created_at', since.toISOString());

  if (messagesError) {
    logger.error('[api/admin/metrics] assistant messages query failed', messagesError);
  }

  const perDayMessages = new Map<string, number>();
  let recentMessages = 0;
  for (const row of messageRows ?? []) {
    recentMessages += 1;
    const day = String(row.created_at).slice(0, 10);
    perDayMessages.set(day, (perDayMessages.get(day) ?? 0) + 1);
  }

  // All-time total: cheap exact count on the same indexed table.
  const { count: totalMessages, error: totalError } = await supabase
    .from('ai_chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'assistant');

  if (totalError) {
    logger.error('[api/admin/metrics] assistant messages count failed', totalError);
  }

  const dailyCounts = snapshot.dailyCounts.map((day) => ({
    ...day,
    assistantMessages: perDayMessages.get(day.date) ?? 0,
  }));

  return NextResponse.json({
    totalUsers: snapshot.activeUsers30d,
    totalMessages: totalMessages ?? recentMessages,
    totalViews: snapshot.totalDownloads,
    totalClicks: snapshot.totalAiQuestions,
    topContentTypes: snapshot.topFiles.map((file) => ({
      type: file.title ?? file.ref,
      count: file.count,
    })),
    recentActivity: snapshot.recentActivity,
    dailyCounts,
    redisConfigured: snapshot.redisConfigured,
  });
}

export const runtime = 'nodejs';
