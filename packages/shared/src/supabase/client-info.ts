import type { SupabaseRuntime } from "./types";

/**
 * Build the value for the `client-info` HTTP header.
 *
 * Per `specs/004-multi-platform-expansion/contracts/supabase-client.md`:
 *
 *   "Sets a `client-info` header on every request
 *    (`platform=web|desktop|mobile`, `app_version=<semver>`)."
 *
 * The format is `platform=<runtime>; app_version=<semver>`. We keep the
 * values simple and stable so they can be parsed server-side for
 * analytics and abuse detection without coupling to the project's
 * specific naming.
 */
export function buildClientInfo(
  runtime: SupabaseRuntime,
  appVersion: string,
): string {
  return `platform=${runtime}; app_version=${appVersion}`;
}
