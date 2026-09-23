// ============================================================================
// deepLink.ts — masarx:// deep-link parsing (spec 014, R030)
//
// The desktop shell registers a `masarx://` URL protocol so the OS can hand
// OAuth callbacks back to the app: the system browser completes the Google
// consent, Supabase redirects to `masarx://auth/callback?code=…`, and
// Windows launches/focuses Masar X with the URL in argv. This module is the
// single, pure, unit-tested gate for those URLs — main never forwards an
// argv entry it has not validated here.
//
// Only ONE deep link exists today: `masarx://auth/callback`. Anything else
// sharing the protocol (a wrong host, a wrong path, a malformed URL) is
// rejected — an attacker page can trivially invoke `masarx://` from a
// browser, so the shape check here is the first of two defenses (the
// renderer re-validates before exchanging the code, and a code is useless
// without the locally-stored PKCE verifier).
// ============================================================================

export const DEEP_LINK_PROTOCOL = "masarx";

/** The only deep-link host/path pair the shell routes. */
export const AUTH_CALLBACK_HOST = "auth";
export const AUTH_CALLBACK_PATH = "/callback";

/**
 * Scan a process argv-style array for the first entry that is a valid
 * `masarx://auth/callback?…` URL. Returns the raw URL string (exactly as
 * received, so the renderer can re-validate the same bytes) or `null`.
 */
export function parseDeepLinkUrl(argv: readonly string[]): string | null {
  const prefix = `${DEEP_LINK_PROTOCOL}://`;
  for (const arg of argv) {
    if (typeof arg !== "string") continue;
    if (!arg.toLowerCase().startsWith(prefix)) continue;
    try {
      const url = new URL(arg);
      if (url.protocol !== `${DEEP_LINK_PROTOCOL}:`) continue;
      if (url.host.toLowerCase() !== AUTH_CALLBACK_HOST) continue;
      if (url.pathname !== AUTH_CALLBACK_PATH) continue;
      return arg;
    } catch {
      // Malformed URL — not a deep link we can route.
      continue;
    }
  }
  return null;
}
