import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adds request headers and IP for users
  sendDefaultPii: true,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Data Security (PII Redaction)
  beforeSend(event) {
    if (event.request && event.request.headers) {
      const sensitiveHeaders = ['authorization', 'cookie', 'set-cookie', 'x-api-key'];
      sensitiveHeaders.forEach(header => {
        if (event.request!.headers![header]) {
          event.request!.headers![header] = '[REDACTED]';
        }
      });
    }
    return event;
  },
});
