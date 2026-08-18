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

// TODO: Wire up a real monitoring service here (e.g. Sentry, Logtail, Axiom).
// import * as Sentry from '@sentry/nextjs';
// const sendToMonitoring = (level, message, error, context) => Sentry.captureException(error, { extra: context });

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
  },
  warn: (message: string, context?: Record<string, unknown>) => {
    console.warn(`[WARN] ${message}`, {
      ...context,
      timestamp: new Date().toISOString(),
    });
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
