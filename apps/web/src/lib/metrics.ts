import "server-only";

/**
 * Lean product metrics on Upstash Redis (owner directive, 2026-10-21).
 *
 * Design constraints:
 * - Postgres is NOT an event log. The `analytics` table stopped receiving
 *   rows; the only counters that matter (file downloads, AI usage, active
 *   users) live here as atomic Redis operations — no rows, no identities.
 * - Active users use HyperLogLog keyed by UTC day: PFADD is one-way (the
 *   raw user id cannot be recovered from the registers) and idempotent per
 *   day, so repeated pings cannot inflate the metric.
 * - Everything FAILS OPEN: if Upstash is not configured or errors, metrics
 *   reads return zeros and writes are dropped. Analytics must never break
 *   a user flow.
 *
 * Reuses the same env vars / plain-REST pipeline pattern as rate-limit.ts
 * (no extra dependency). Upstash free tier is orders of magnitude above
 * the few hundred commands/day this produces.
 */

const FETCH_TIMEOUT_MS = 5_000;
const DAY_KEY_TTL_SECONDS = 40 * 24 * 60 * 60; // per-day keys outlive 14-day trends
const RECENT_LIST_MAX = 20;
const DOWNLOAD_DAILY_CAP = 200; // per-user abuse guard; PFADD needs none (idempotent)

interface UpstashConfig {
  url: string;
  token: string;
}

interface UpstashPipelineItem {
  result?: unknown;
  error?: string | null;
}

const getUpstashConfig = (): UpstashConfig | undefined => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : undefined;
};

export const isRedisConfigured = (): boolean => getUpstashConfig() !== undefined;

const upstashPipeline = async (
  upstash: UpstashConfig,
  commands: unknown[][],
): Promise<unknown[]> => {
  const res = await fetch(`${upstash.url.replace(/\/+$/, '')}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${upstash.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
    signal:
      typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(FETCH_TIMEOUT_MS)
        : undefined,
  });
  if (!res.ok) throw new Error(`Upstash pipeline HTTP ${res.status}`);
  const data = (await res.json()) as UpstashPipelineItem[];
  if (!Array.isArray(data)) throw new Error('Upstash pipeline: unexpected response shape');
  const failed = data.find(
    (item) => item && typeof item.error === 'string' && item.error.length > 0,
  );
  if (failed) throw new Error(`Upstash pipeline error: ${String(failed.error)}`);
  return data.map((item) => item?.result);
};

const runQuietly = (scope: string, task: Promise<unknown>): void => {
  task.catch((err: unknown) => {
    console.error(
      '[metrics]',
      scope,
      'failed (dropped):',
      err instanceof Error ? err.message : err,
    );
  });
};

const utcDayKey = (date: Date): string => date.toISOString().slice(0, 10);

const dayKeys = (endDate: Date, count: number): string[] => {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    keys.push(utcDayKey(new Date(endDate.getTime() - i * 24 * 60 * 60 * 1000)));
  }
  return keys;
};

const pushRecent = (
  commands: unknown[][],
  entry: { action: string; content_type: string; created_at: string },
): void => {
  commands.push(['lpush', 'm:recent', JSON.stringify(entry)]);
  commands.push(['ltrim', 'm:recent', 0, RECENT_LIST_MAX - 1]);
};

/** Daily downloads + all-time counter + per-file ZSET + capped activity feed. */
export function recordFileDownload(
  userId: string,
  file: { id?: string; title?: string; fileUrl?: string },
): void {
  const upstash = getUpstashConfig();
  if (!upstash) return;
  const ref = file.id ?? file.fileUrl;
  if (!ref || ref.length > 500) return;

  const now = new Date();
  const dk = utcDayKey(now);
  const capKey = `m:rl:${userId}:${dk}`;

  runQuietly(
    'download',
    upstashPipeline(upstash, [
      ['incr', capKey],
      ['expire', capKey, DAY_KEY_TTL_SECONDS],
    ]).then(async (capResult) => {
      if (Number(capResult[0] ?? 0) > DOWNLOAD_DAILY_CAP) return; // silent drop

      const commands: unknown[][] = [
        ['incr', `m:dl:${dk}`],
        ['expire', `m:dl:${dk}`, DAY_KEY_TTL_SECONDS],
        ['incr', 'm:dl:total'],
        ['zincrby', 'm:dl:byfile', 1, ref],
      ];
      if (file.title) {
        commands.push(['hset', 'm:file:names', ref, file.title.slice(0, 200)]);
      }
      pushRecent(commands, {
        action: 'file_download',
        content_type: 'file',
        created_at: now.toISOString(),
      });
      await upstashPipeline(upstash, commands);
    }),
  );
}

/** Called server-side from the AI routes after an accepted chat request. */
export function recordAiQuestion(userId: string): void {
  const upstash = getUpstashConfig();
  if (!upstash) return;
  const now = new Date();
  const dk = utcDayKey(now);

  const commands: unknown[][] = [
    ['incr', `m:ai:${dk}`],
    ['expire', `m:ai:${dk}`, DAY_KEY_TTL_SECONDS],
    ['incr', 'm:ai:total'],
  ];
  pushRecent(commands, {
    action: 'ai_question',
    content_type: 'ai_assistant',
    created_at: now.toISOString(),
  });
  void userId; // kept for signature symmetry / future per-user metrics
  runQuietly('ai-question', upstashPipeline(upstash, commands));
}

/**
 * One call per authenticated app load. PFADD is idempotent per day, so no
 * cap is needed — repeat pings cannot inflate the HLL.
 */
export function pingActiveUser(userId: string): void {
  const upstash = getUpstashConfig();
  if (!upstash) return;
  const dk = utcDayKey(new Date());
  runQuietly(
    'active-ping',
    upstashPipeline(upstash, [
      ['pfadd', `m:au:${dk}`, userId],
      ['expire', `m:au:${dk}`, DAY_KEY_TTL_SECONDS],
    ]),
  );
}

export interface MetricDailyCount {
  date: string;
  downloads: number;
  aiQuestions: number;
  activeUsers: number;
}

export interface MetricsSnapshot {
  redisConfigured: boolean;
  totalDownloads: number;
  totalAiQuestions: number;
  activeUsers30d: number;
  dailyCounts: MetricDailyCount[];
  topFiles: Array<{ ref: string; title: string | null; count: number }>;
  recentActivity: Array<{ action: string; content_type: string; created_at: string }>;
}

const EMPTY_SNAPSHOT: MetricsSnapshot = {
  redisConfigured: false,
  totalDownloads: 0,
  totalAiQuestions: 0,
  activeUsers30d: 0,
  dailyCounts: [],
  topFiles: [],
  recentActivity: [],
};

const asCount = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

export async function getAdminMetrics(): Promise<MetricsSnapshot> {
  const upstash = getUpstashConfig();
  if (!upstash) return EMPTY_SNAPSHOT;

  const now = new Date();
  const trendDays = dayKeys(now, 14); // oldest first
  const activeDays = dayKeys(now, 30);

  let results: unknown[];
  try {
    results = await upstashPipeline(upstash, [
      ['mget', ...trendDays.map((d) => `m:dl:${d}`)],
      ['mget', ...trendDays.map((d) => `m:ai:${d}`)],
      ['get', 'm:dl:total'],
      ['get', 'm:ai:total'],
      ['pfcount', ...activeDays.map((d) => `m:au:${d}`)],
      ['zrevrange', 'm:dl:byfile', 0, 9, 'withscores'],
      ['hgetall', 'm:file:names'],
      ['lrange', 'm:recent', 0, RECENT_LIST_MAX - 1],
      ...trendDays.map((d) => ['pfcount', `m:au:${d}`]),
    ]);
  } catch (err: unknown) {
    console.error(
      '[metrics] read failed:',
      err instanceof Error ? err.message : err,
    );
    return EMPTY_SNAPSHOT;
  }

  const dailyDownloads = (results[0] as Array<unknown> | undefined) ?? [];
  const dailyAi = (results[1] as Array<unknown> | undefined) ?? [];
  const totalDownloads = asCount(results[2]);
  const totalAiQuestions = asCount(results[3]);
  const activeUsers30d = asCount(results[4]);
  const topRaw = (results[5] as Array<unknown> | undefined) ?? [];
  const fileNames = (results[6] as Record<string, string> | undefined) ?? {};
  const recentRaw = (results[7] as Array<unknown> | undefined) ?? [];
  const perDayActive = results.slice(8);

  const topFiles: MetricsSnapshot['topFiles'] = [];
  for (let i = 0; i + 1 < topRaw.length; i += 2) {
    const ref = String(topRaw[i]);
    topFiles.push({
      ref,
      title: fileNames[ref] ?? null,
      count: asCount(topRaw[i + 1]),
    });
  }

  const recentActivity = recentRaw
    .map((entry) => {
      try {
        const parsed = JSON.parse(String(entry)) as {
          action?: string;
          content_type?: string;
          created_at?: string;
        };
        return {
          action: parsed.action ?? 'unknown',
          content_type: parsed.content_type ?? 'unknown',
          created_at: parsed.created_at ?? '',
        };
      } catch {
        return null;
      }
    })
    .filter((e): e is MetricsSnapshot['recentActivity'][number] => e !== null);

  const dailyCounts = trendDays.map((date, i) => ({
    date,
    downloads: asCount(dailyDownloads[i]),
    aiQuestions: asCount(dailyAi[i]),
    activeUsers: asCount(perDayActive[i]),
  }));

  return {
    redisConfigured: true,
    totalDownloads,
    totalAiQuestions,
    activeUsers30d,
    dailyCounts,
    topFiles,
    recentActivity,
  };
}
