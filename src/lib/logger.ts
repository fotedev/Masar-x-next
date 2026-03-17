const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  error: (message: string, error?: unknown, context?: Record<string, unknown>) => {
    if (isDev) {
      console.error(`[ERROR] ${message}`, {
        error,
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
