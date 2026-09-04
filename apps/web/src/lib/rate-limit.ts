/**
 * Sliding-window rate limiting with pluggable durable backends (spec T006/FR-004).
 *
 * Backend priority:
 *   (a) Upstash Redis REST - when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *       are set. Sliding window ZSET per key: ZADD <nowMs> <reqId>,
 *       ZREMRANGEBYSCORE 0 <nowMs-windowMs>, ZCARD, PEXPIRE <windowMs>.
 *   (b) Supabase REST via service role - when NEXT_PUBLIC_SUPABASE_URL +
 *       SUPABASE_SERVICE_ROLE_KEY are set. Uses the existing `rate_limits` table
 *       (supabase/migrations/006_system_and_security.sql: id, key UNIQUE, hits,
 *       last_hit) via POST /rest/v1/rate_limits upsert (on_conflict=key). The
 *       table may not exist - on any structural error we permanently fall
 *       through to the in-memory store; on transient errors we fail open.
 *   (c) In-memory Map (per-instance behaviour; one-time production warning).
 *
 * The exported API is synchronous (API routes call it inline), so durable
 * stores are reconciled fire-and-forget: the synchronous decision reads a
 * local sliding-window projection (key -> request timestamps) that is merged
 * with the authoritative backend state on every check/record.
 *
 * Semantics: checkAIChatRateLimit() reserves one slot locally when allowed
 * (burst-safe, matches previous behaviour); recordAIChatRequest() confirms the
 * request against the durable backend. Store errors FAIL OPEN (log + allow).
 *
 * All fail-open paths keep console output as the signal of last resort.
 */

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

// Kept exported for API compatibility with existing consumers.
interface RateLimitEntry {
  count: number;
  windowStart: number;
  userId: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// AI Chat rate limit configuration
const AI_CHAT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 10, // 10 requests per window
  keyPrefix: 'rate_limit:ai_chat:',
};

const FETCH_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// Backend configuration (static process.env property access so the values are
// also visible in edge bundles; nothing is ever logged).
// ---------------------------------------------------------------------------

interface UpstashConfig {
  url: string;
  token: string;
}

interface SupabaseConfig {
  url: string;
  serviceKey: string;
}

const getUpstashConfig = (): UpstashConfig | undefined => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : undefined;
};

const getSupabaseConfig = (): SupabaseConfig | undefined => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceKey ? { url, serviceKey } : undefined;
};

let warnedNoDurableStore = false;

const warnNoDurableStoreOnce = (): void => {
  if (warnedNoDurableStore) return;
  warnedNoDurableStore = true;
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      JSON.stringify({
        level: 'warn',
        message: 'rate limiting: no durable store configured, using in-memory Map',
        hint: 'Set UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN (or NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY) to enforce limits across instances',
        timestamp: new Date().toISOString(),
      }),
    );
  }
};

// Throttled store-error logging: FAIL OPEN means log + allow, never throw.
const lastStoreErrorLogAt = new Map<string, number>();

const logStoreError = (backend: string, scope: string, err: unknown): void => {
  const now = Date.now();
  if (now - (lastStoreErrorLogAt.get(scope) ?? 0) < 60_000) return;
  lastStoreErrorLogAt.set(scope, now);
  console.error(
    `[rate-limit] ${backend} store error (${scope}) - failing open:`,
    err instanceof Error ? err.message : err,
  );
};

// ---------------------------------------------------------------------------
// Local sliding-window projection (the synchronous decision layer)
// ---------------------------------------------------------------------------

// key -> request timestamps (ms) inside the current sliding window
const rateLimitStore = new Map<string, number[]>();

function getRateLimitKey(config: RateLimitConfig, userId: string): string {
  return `${config.keyPrefix}${userId}`;
}

const pruneTimestamps = (timestamps: number[], now: number, windowMs: number): number[] => {
  const cutoff = now - windowMs;
  let start = 0;
  while (start < timestamps.length && timestamps[start] <= cutoff) start += 1;
  return start === 0 ? timestamps : timestamps.slice(start);
};

/** Returns the stored, pruned timestamp array for the key. */
const getLocalWindow = (key: string, now: number, windowMs: number): number[] => {
  const existing = rateLimitStore.get(key);
  if (!existing) return [];
  const pruned = pruneTimestamps(existing, now, windowMs);
  if (pruned.length === 0) rateLimitStore.delete(key);
  else rateLimitStore.set(key, pruned);
  return pruned;
};

const clampTimestamp = (ts: number, now: number, windowMs: number): number => {
  if (!Number.isFinite(ts)) return now;
  return Math.min(Math.max(ts, now - windowMs + 1), now);
};

/**
 * Merge an authoritative remote request count (e.g. Upstash ZCARD) into the
 * local projection. We only ever raise the local count (conservative); missing
 * requests are represented as synthetic timestamps at `syntheticAt`.
 */
const mergeRemoteCount = (
  key: string,
  remoteCount: number,
  config: RateLimitConfig,
  options?: { now?: number; syntheticAt?: number },
): void => {
  if (!Number.isFinite(remoteCount) || remoteCount <= 0) return;
  const now = options?.now ?? Date.now();
  const window = getLocalWindow(key, now, config.windowMs);
  const deficit = Math.min(
    Math.floor(remoteCount) - window.length,
    config.maxRequests,
  );
  if (deficit <= 0) return;
  const at = clampTimestamp(options?.syntheticAt ?? now, now, config.windowMs);
  for (let i = 0; i < deficit; i += 1) window.push(at);
  rateLimitStore.set(key, window);
};

const decideLocally = (config: RateLimitConfig, userId: string): RateLimitResult => {
  const key = getRateLimitKey(config, userId);
  const now = Date.now();
  const window = getLocalWindow(key, now, config.windowMs);

  if (window.length >= config.maxRequests) {
    const resetTime = window[0] + config.windowMs;
    return {
      allowed: false,
      remaining: 0,
      resetTime,
      retryAfter: Math.max(1, Math.ceil((resetTime - now) / 1000)),
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, config.maxRequests - window.length - 1),
    resetTime: window.length > 0 ? window[0] + config.windowMs : now + config.windowMs,
  };
};

// ---------------------------------------------------------------------------
// Backend (a): Upstash Redis REST (no extra dependencies, plain fetch)
// ---------------------------------------------------------------------------

const newRequestId = (): string => {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}-${Math.random().toString(36).slice(2)}`;
};

const fetchTimeoutSignal = (): AbortSignal | undefined => {
  try {
    return typeof AbortSignal !== 'undefined' &&
      typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(FETCH_TIMEOUT_MS)
      : undefined;
  } catch {
    return undefined;
  }
};

interface UpstashPipelineItem {
  result?: unknown;
  error?: string | null;
}

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
    signal: fetchTimeoutSignal(),
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

const reconcileUpstash = async (
  config: RateLimitConfig,
  key: string,
  op: 'peek' | 'record',
  upstash: UpstashConfig,
): Promise<void> => {
  const now = Date.now();

  if (op === 'record') {
    // Sliding window: add this request, prune expired scores, read the
    // authoritative count, then keep a TTL on the key for cleanup.
    const results = await upstashPipeline(upstash, [
      ['zadd', key, now, newRequestId()],
      ['zremrangebyscore', key, 0, now - config.windowMs],
      ['zcard', key],
      ['pexpire', key, config.windowMs],
    ]);
    mergeRemoteCount(key, Number(results[2] ?? 0), config, { now: Date.now() });
    return;
  }

  // peek: refresh the projection without counting a new request.
  const results = await upstashPipeline(upstash, [
    ['zremrangebyscore', key, 0, now - config.windowMs],
    ['zcard', key],
  ]);
  mergeRemoteCount(key, Number(results[1] ?? 0), config, { now });
};

// ---------------------------------------------------------------------------
// Backend (b): Supabase REST `rate_limits` upsert via service role.
// Table shape (006_system_and_security.sql): id uuid pk, key text UNIQUE,
// hits int, last_hit timestamptz, created_at timestamptz.
// ---------------------------------------------------------------------------

interface SupabaseRateLimitRow {
  hits?: unknown;
  last_hit?: unknown;
}

const isStructuralSupabaseError = (err: unknown): boolean => {
  const message = err instanceof Error ? err.message : String(err);
  // 404 (PGRST205: table/relation missing), 42P01 undefined_table, unknown column
  return /HTTP 404\b|42P01|PGRST20[45]|does not exist/i.test(message);
};

const reconcileSupabase = async (
  config: RateLimitConfig,
  key: string,
  op: 'peek' | 'record',
  supabase: SupabaseConfig,
): Promise<void> => {
  const now = Date.now();
  const base = supabase.url.replace(/\/+$/, '');
  const headers: Record<string, string> = {
    apikey: supabase.serviceKey,
    Authorization: `Bearer ${supabase.serviceKey}`,
    'Content-Type': 'application/json',
  };

  // Read the current row (missing row or missing table are both recoverable).
  const readRes = await fetch(
    `${base}/rest/v1/rate_limits?select=hits,last_hit&key=eq.${encodeURIComponent(key)}&limit=1`,
    { headers, signal: fetchTimeoutSignal() },
  );
  if (!readRes.ok) throw new Error(`Supabase rate_limits read HTTP ${readRes.status}`);
  const rows = (await readRes.json()) as SupabaseRateLimitRow[];
  const row = rows[0];
  const remoteHits = typeof row?.hits === 'number' ? row.hits : 0;
  const lastHitMs =
    typeof row?.last_hit === 'string' ? new Date(row.last_hit).getTime() : Number.NaN;
  // Hits outside the current window no longer count (window reset).
  const remoteActive =
    Number.isFinite(lastHitMs) && now - lastHitMs < config.windowMs ? remoteHits : 0;

  // Raise the local projection to the authoritative remote count.
  mergeRemoteCount(key, remoteActive, config, {
    now,
    syntheticAt: Number.isFinite(lastHitMs) ? lastHitMs : now,
  });

  if (op === 'peek') return;

  // Upsert the merged count (+ this request). Races between instances can only
  // under-count (fail-open direction).
  const localCount = getLocalWindow(key, now, config.windowMs).length;
  const newHits = Math.max(localCount, remoteActive + 1);
  const writeRes = await fetch(`${base}/rest/v1/rate_limits?on_conflict=key`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ key, hits: newHits, last_hit: new Date(now).toISOString() }]),
    signal: fetchTimeoutSignal(),
  });
  if (!writeRes.ok) throw new Error(`Supabase rate_limits upsert HTTP ${writeRes.status}`);
};

// ---------------------------------------------------------------------------
// Fire-and-forget reconciliation (keeps the exported API synchronous)
// ---------------------------------------------------------------------------

let supabaseDemoted = false;

const reconcileStore = (
  config: RateLimitConfig,
  key: string,
  op: 'peek' | 'record',
): void => {
  const upstash = getUpstashConfig();
  const supabase = upstash ? undefined : getSupabaseConfig();

  if (upstash) {
    void reconcileUpstash(config, key, op, upstash).catch((err: unknown) => {
      // FAIL OPEN: the local (approximate) decision stands.
      logStoreError('upstash', op, err);
    });
    return;
  }

  if (supabase && !supabaseDemoted) {
    void reconcileSupabase(config, key, op, supabase).catch((err: unknown) => {
      if (isStructuralSupabaseError(err)) {
        // Table missing etc. - permanently fall through to the in-memory store.
        supabaseDemoted = true;
        logStoreError('supabase', 'demoted-to-memory', err);
        return;
      }
      // FAIL OPEN: the local (approximate) decision stands.
      logStoreError('supabase', op, err);
    });
    return;
  }

  if (!supabaseDemoted) warnNoDurableStoreOnce();
};

// ---------------------------------------------------------------------------
// Exported API (signature-compatible with the previous in-memory version)
// ---------------------------------------------------------------------------

export function checkAIChatRateLimit(userId: string): RateLimitResult {
  const key = getRateLimitKey(AI_CHAT_RATE_LIMIT, userId);
  const decision = decideLocally(AI_CHAT_RATE_LIMIT, userId);
  if (decision.allowed) {
    // Reserve the slot synchronously so concurrent requests are burst-safe.
    const now = Date.now();
    const window = getLocalWindow(key, now, AI_CHAT_RATE_LIMIT.windowMs);
    window.push(now);
    rateLimitStore.set(key, window);
  }
  reconcileStore(AI_CHAT_RATE_LIMIT, key, 'peek');
  return decision;
}

export function recordAIChatRequest(userId: string): void {
  const key = getRateLimitKey(AI_CHAT_RATE_LIMIT, userId);
  // Confirm the request against the durable backend (the local slot was
  // already reserved by checkAIChatRateLimit).
  reconcileStore(AI_CHAT_RATE_LIMIT, key, 'record');
}

export { AI_CHAT_RATE_LIMIT };
export type { RateLimitConfig, RateLimitEntry, RateLimitResult };
