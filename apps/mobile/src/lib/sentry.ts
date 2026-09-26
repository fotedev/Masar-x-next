/**
 * Sentry crash reporting init (spec 023).
 *
 * Mirrors the Supabase config contract: the DSN is injected at build time
 * by app.config.js from EXPO_PUBLIC_SENTRY_DSN into `expoConfig.extra`
 * and read here through expo-constants. The DSN is a public-by-design
 * client identifier; the SENTRY_AUTH_TOKEN used for source-map uploads
 * never reaches the client.
 *
 * Missing DSN is a supported state, not an error: the app boots normally
 * with Sentry inert (same "unconfigured ≠ crash" contract as
 * supabase.ts). Sentry only uploads when it is initialized, so an
 * uninitialized build sends nothing.
 */
import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

interface SentryExtra {
  sentryDsn?: string;
}

/** Initialize Sentry exactly once, from index.js before mounting the app. */
export function initSentry(): void {
  const dsn =
    ((Constants.expoConfig?.extra ?? {}) as SentryExtra).sentryDsn ?? "";

  if (!dsn) {
    if (__DEV__) {
      console.warn(
        "[masarx] EXPO_PUBLIC_SENTRY_DSN is not set. Crash reporting is " +
          "disabled and the app runs normally. Set it in .env.local (local " +
          "dev) or as an EAS env var for preview/production builds " +
          "(see apps/mobile/README.md).",
      );
    }
    return;
  }

  Sentry.init({
    dsn,
    debug: __DEV__,
  });
}
