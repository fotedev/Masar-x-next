/**
 * Dynamic Expo config.
 *
 * Spreads the static `app.json` (name, slug, version, orientation, scheme,
 * supportsRTL, bundle identifiers, plugins) and injects the Supabase env
 * vars into `extra`, where `expo-constants` reads them at runtime
 * (apps/mobile/src/lib/supabase.ts). See
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

  return {
    ...config,
    extra: {
      ...(config.extra ?? {}),
      supabaseUrl,
      supabaseAnonKey,
    },
  };
};