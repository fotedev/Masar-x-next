// import * as Sentry from "@sentry/nextjs";

/*
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adds request headers and IP for users
  sendDefaultPii: true,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Attach local variable values to stack frames
  includeLocalVariables: true,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

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
*/

// This export will instrument router navigations
export const onRouterTransitionStart = () => {}; // Sentry.captureRouterTransitionStart;
