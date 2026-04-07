const isDev = process.env.NODE_ENV !== 'production';

const normalizeError = (error: unknown) => {
  if (error instanceof Error) {
    const anyErr = error as Error & { cause?: unknown };
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: anyErr.cause,
    };
  }

  if (typeof error === 'string') return { message: error };
  if (error && typeof error === 'object') {
    try {
      const asRec = error as Record<string, unknown>;
      const message = typeof asRec.message === 'string' ? asRec.message : undefined;
      const name = typeof asRec.name === 'string' ? asRec.name : undefined;
      const stack = typeof asRec.stack === 'string' ? asRec.stack : undefined;
      return { name, message, stack, raw: asRec };
    } catch {
      return { raw: error };
    }
  }

  return { message: String(error) };
};

export const logger = {
  error: (message: string, error?: unknown, context?: Record<string, unknown>) => {
    if (isDev) {
      console.error(`[ERROR] ${message}`, {
        error: normalizeError(error),
        ...context,
        timestamp: new Date().toISOString(),
      });
    }
    // In production, we could send this to a service like Sentry or LogSnag
  },
  warn: (message: string, context?: Record<string, unknown>) => {
    if (isDev) {
      console.warn(`[WARN] ${message}`, {
        ...context,
        timestamp: new Date().toISOString(),
      });
    }
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
