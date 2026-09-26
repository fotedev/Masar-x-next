/**
 * Dynamic Expo config.
 *
 * Spreads the static `app.json` (name, slug, version, orientation, scheme,
 * supportsRTL, bundle identifiers, plugins) and injects env vars into
 * `extra`, where `expo-constants` reads them at runtime
 * (apps/mobile/src/lib/supabase.ts, src/lib/sentry.ts). See
 * specs/004-multi-platform-expansion/contracts/supabase-client.md:
 *
 *   "mobile: expo-constants.expoConfig.extra.supabaseUrl"
 *
 * Only the public anon key is allowed here (spec FR-017 / US5): the
 * service-role key MUST never be referenced by any client config.
 */
module.exports = ({ config }) => {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    // Dev-only guidance. The production build resolves these from the
    // EAS secret environment (see eas.json profiles + README.md).
    console.warn(
      "[masarx] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set. " +
        "The app will show the clear 'cannot reach Masar X' configuration state instead of " +
        "crashing. Set them in .env.local (local dev) or as EAS env vars (cloud builds).",
    );
  }

  // Sentry DSN (spec 023): public-by-design client identifier, read from
  // the EAS/build environment. Empty string = crash reporting disabled
  // (src/lib/sentry.ts boots the app normally without it).
  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";

  // Web origin for auth hand-offs that complete in the browser (spec 019
  // C3/T082): the password-reset email link opens the web app's
  // /reset-password page (spec 004 T047 decision — reset completes on
  // web). Overridable via EXPO_PUBLIC_WEB_ORIGIN for local dev.
  const webOrigin = process.env.EXPO_PUBLIC_WEB_ORIGIN || "https://masarx.vercel.app";

  return {
    ...config,
    extra: {
      ...(config.extra ?? {}),
      supabaseUrl,
      supabaseAnonKey,
      webOrigin,
      sentryDsn,
    },
  };
};