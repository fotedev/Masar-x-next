const isDev = process.env.NODE_ENV !== "production";

type PgErrorLike = {
  code?: string;
  message?: string;
  detail?: string;
  hint?: string;
  position?: string;
  severity?: string;
  schema?: string;
  table?: string;
  column?: string;
  dataType?: string;
  constraint?: string;
  routine?: string;
};

const extractPgError = (cause: unknown): PgErrorLike | null => {
  if (!cause || typeof cause !== "object") return null;
  const c = cause as Record<string, unknown>;
  // pg driver / Drizzle cause shape: { code, message, detail, hint, ... }
  if (typeof c.code === "string" && /^[0-9A-Z]{5}$/.test(c.code)) {
    return {
      code: c.code,
      message: typeof c.message === "string" ? c.message : undefined,
      detail: typeof c.detail === "string" ? c.detail : undefined,
      hint: typeof c.hint === "string" ? c.hint : undefined,
      severity: typeof c.severity === "string" ? c.severity : undefined,
      schema: typeof c.schema === "string" ? c.schema : undefined,
      table: typeof c.table === "string" ? c.table : undefined,
      column: typeof c.column === "string" ? c.column : undefined,
      dataType: typeof c.dataType === "string" ? c.dataType : undefined,
      constraint: typeof c.constraint === "string" ? c.constraint : undefined,
      routine: typeof c.routine === "string" ? c.routine : undefined,
    };
  }
  return null;
};

const summarizeError = (label: string, error: unknown): string | null => {
  if (error instanceof Error) {
    const anyErr = error as Error & { cause?: unknown };
    const pg = extractPgError(anyErr.cause);
    if (pg) {
      const parts = [`${label}: ${error.message}`];
      if (pg.message && pg.message !== error.message) parts.push(`cause: ${pg.message}`);
      if (pg.detail) parts.push(`detail: ${pg.detail}`);
      if (pg.hint) parts.push(`hint: ${pg.hint}`);
      if (pg.code) parts.push(`[${pg.code}]`);
      if (pg.table) parts.push(`table=${pg.schema ?? "public"}.${pg.table}`);
      if (pg.column) parts.push(`column=${pg.column}`);
      return parts.join(" | ");
    }
    return `${label}: ${error.message}`;
  }
  return null;
};

const normalizeError = (error: unknown) => {
  if (error instanceof Error) {
    const anyErr = error as Error & { cause?: unknown };
    const pg = extractPgError(anyErr.cause);
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: anyErr.cause,
      // Flattened PG error fields for at-a-glance debugging without expanding nested objects
      pg: pg ?? undefined,
    };
  }

  if (typeof error === "string") return { message: error };
  if (error && typeof error === "object") {
    try {
      const asRec = error as Record<string, unknown>;
      const message =
        typeof asRec.message === "string" ? asRec.message : undefined;
      const name = typeof asRec.name === "string" ? asRec.name : undefined;
      const stack = typeof asRec.stack === "string" ? asRec.stack : undefined;
      return { name, message, stack, raw: asRec };
    } catch {
      return { raw: error };
    }
  }

  return { message: String(error) };
};

// ---------------------------------------------------------------------------
// T016: Production error/warn forwarding to Sentry - no new dependencies.
//
// Console output above is ALWAYS kept: it is the fallback per spec EC, and a
// monitoring outage must never break the app. When SENTRY_DSN is configured,
// every error()/warn() additionally POSTs a minimal Sentry envelope
// (fire-and-forget, fully guarded). When no DSN is set in production, a
// one-time structured warning is emitted instead.
// ---------------------------------------------------------------------------

const MONITORING_TIMEOUT_MS = 5_000;

interface SentryDsnConfig {
  key: string;
  endpoint: string;
}

let parsedSentryDsn: SentryDsnConfig | null | undefined;
let warnedForwardingUnconfigured = false;

const parseSentryDsn = (dsn: string): SentryDsnConfig | null => {
  try {
    // Expected shape: https://<key>@<host>/<projectId>
    const url = new URL(dsn);
    const key = url.username;
    const projectId = url.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
    if (url.protocol !== "https:" || !key || !url.host || !projectId) return null;
    return { key, endpoint: `https://${url.host}/api/${projectId}/envelope/` };
  } catch {
    return null;
  }
};

const getSentryDsn = (): SentryDsnConfig | null => {
  if (parsedSentryDsn === undefined) {
    const raw = process.env.SENTRY_DSN;
    parsedSentryDsn = raw ? parseSentryDsn(raw) : null;
    if (raw && parsedSentryDsn === null) {
      console.warn(
        "[MONITOR] SENTRY_DSN is set but could not be parsed - error forwarding disabled",
      );
    }
  }
  return parsedSentryDsn;
};

const newEventId = (): string => {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
};

const extractErrorFacts = (
  error: unknown,
): { name?: string; message?: string; stack?: string } => {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  if (error && typeof error === "object") {
    const rec = error as Record<string, unknown>;
    return {
      name: typeof rec.name === "string" ? rec.name : undefined,
      message: typeof rec.message === "string" ? rec.message : undefined,
      stack: typeof rec.stack === "string" ? rec.stack : undefined,
    };
  }
  if (typeof error === "string") return { message: error };
  return {};
};

const fetchTimeoutSignal = (): AbortSignal | undefined => {
  try {
    return typeof AbortSignal !== "undefined" &&
      typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(MONITORING_TIMEOUT_MS)
      : undefined;
  } catch {
    return undefined;
  }
};

// Monitoring hook (extends the previous TODO stub): fire-and-forget envelope
// POST to the Sentry store endpoint. Never throws, never awaits.
const sendToMonitoring = (
  level: "error" | "warning",
  message: string,
  error?: unknown,
  context?: Record<string, unknown>,
): void => {
  const dsn = getSentryDsn();
  if (!dsn) {
    if (!isDev && !warnedForwardingUnconfigured) {
      warnedForwardingUnconfigured = true;
      console.warn(
        JSON.stringify({
          level: "warn",
          message: "error forwarding unconfigured",
          hint: "Set SENTRY_DSN to forward error/warn events to Sentry",
          timestamp: new Date().toISOString(),
        }),
      );
    }
    return;
  }

  // Full try/catch per spec EC: monitoring must never break the app.
  try {
    if (typeof fetch !== "function") return;

    const eventId = newEventId();
    const sentAt = new Date().toISOString();
    const facts = extractErrorFacts(error);

    const event: Record<string, unknown> = {
      event_id: eventId,
      timestamp: sentAt,
      platform: "node",
      environment: process.env.NODE_ENV ?? "development",
      level,
      logger: "masarx.logger",
      message,
      extra: {
        ...context,
        logger_message: message,
        ...(facts.name ? { error_name: facts.name } : {}),
        ...(facts.stack ? { stack: facts.stack } : {}),
      },
    };
    if (facts.message || facts.name) {
      event.exception = {
        values: [{ type: facts.name ?? "Error", value: facts.message ?? message }],
      };
    }

    // Minimal Sentry envelope: header line, item header line, event payload.
    const envelope =
      [
        JSON.stringify({ event_id: eventId, sent_at: sentAt }),
        JSON.stringify({ type: "event" }),
        JSON.stringify(event),
      ].join("\n") + "\n";

    void fetch(dsn.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${dsn.key}`,
      },
      body: envelope,
      signal: fetchTimeoutSignal(),
    }).catch(() => {
      // Swallow network failures - console output above is the fallback.
    });
  } catch {
    // Never throw from logging (spec EC).
  }
};

export const logger = {
  error: (
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
  ) => {
    const summary = summarizeError(message, error);
    console.error(`[ERROR] ${summary ?? message}`, {
      error: normalizeError(error),
      ...context,
      timestamp: new Date().toISOString(),
    });
    sendToMonitoring("error", summary ?? message, error, context);
  },
  warn: (message: string, context?: Record<string, unknown>) => {
    console.warn(`[WARN] ${message}`, {
      ...context,
      timestamp: new Date().toISOString(),
    });
    sendToMonitoring("warning", message, undefined, context);
  },
  info: (message: string, context?: Record<string, unknown>) => {
    if (isDev) {
      console.info(`[INFO] ${message}`, {
        ...context,
        timestamp: new Date().toISOString(),
      });
    }
  },
  debug: (message: string, context?: Record<string, unknown>) => {
    if (isDev) {
      console.debug(`[DEBUG] ${message}`, {
        ...context,
        timestamp: new Date().toISOString(),
      });
    }
  },
};
