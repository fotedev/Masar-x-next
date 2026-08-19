# Contract: Supabase Client Factory

This contract defines how the three apps get a Supabase client instance, and what each client is and is not allowed to do. It is the single chokepoint through which the apps talk to the existing Supabase project (per spec FR-015, FR-017, FR-018).

## What the shared package exports

```ts
// packages/shared/supabase/index.ts (signature, not implementation)

export type SupabaseRuntime = 'web' | 'desktop' | 'mobile';

export interface SupabaseClientOptions {
  runtime: SupabaseRuntime;
  /**
   * The Supabase project URL. Resolved at build time per runtime:
   *   - web: process.env.NEXT_PUBLIC_SUPABASE_URL
   *   - desktop: read from the app manifest (build-time constant)
   *   - mobile: expo-constants.expoConfig.extra.supabaseUrl
   */
  url: string;
  /**
   * The Supabase anon key. Same resolution rules as `url`.
   * MUST be the anon key, NEVER the service role key.
   */
  anonKey: string;
  /**
   * Optional: storage adapter for persisting the auth session.
   * - web: defaults to cookies (existing behavior)
   * - desktop: defaults to an encrypted file in the Electron userData dir
   * - mobile: defaults to expo-secure-store
   */
  storage?: SupabaseStorageAdapter;
}

export function createSupabaseClient(options: SupabaseClientOptions): SupabaseClient;

/**
 * Hard guarantee: createSupabaseClient MUST throw if `anonKey` matches
 * the shape of a service-role JWT (heuristic: role claim === 'service_role').
 * This is a build-time / startup-time guard, not a runtime per-request check.
 */
```

## What the apps are allowed to do

- Call `createSupabaseClient({ runtime: 'web' | 'desktop' | 'mobile', url, anonKey })` exactly once at app startup.
- Use the returned client for any operation that RLS permits for the signed-in user.
- Subscribe to auth state changes via `client.auth.onAuthStateChange(...)`.

## What the apps are NOT allowed to do

- ❌ Import `@supabase/supabase-js` directly. All access goes through the factory.
- ❌ Make any direct call to the Supabase REST API (`<project>.supabase.co/rest/...`) using the service role key, in any form (via the `@supabase/supabase-js` client, via raw `fetch`/`axios`/`node-fetch`/etc.), in any client context. All Supabase access goes through the factory (`createSupabaseClient`), which uses the anon key + RLS. gitleaks catches the key if it leaks into a built artifact, but does not prevent the call pattern itself.
- ❌ Pass the service role key to `createSupabaseClient` under any name. The factory throws on detection.
- ❌ Construct a Supabase URL that differs from the build-time-resolved value. (This catches the "I'll just hardcode a different project for testing" mistake.)
- ❌ Reach for the `service_role` role via a Postgres function or RPC. RLS is the only authorization layer.

## What the shared package does

- Resolves the URL and anon key from the runtime-specific source.
- Wraps the Supabase client in a thin layer that:
  - Sets a `client-info` header on every request (`platform=web|desktop|mobile`, `app_version=<semver>`).
  - Emits a `console.warn` (dev only) if the client is constructed with a non-`anon` JWT, even if the heuristic doesn't catch it.
  - Provides a typed `getCurrentSession()` and `requireUser()` helper.

## Security implications

- The anon key is intentionally not a secret; it is shipped to clients by design.
- The service role key MUST NOT appear in any client-readable source, env file, or build output. This is enforced by gitleaks on the built artifacts (see research.md §8 and spec FR-017).
- The factory's runtime parameter is not just metadata — it is a security-relevant signal. The same code on the web and on the mobile app behaves identically; the only difference is the env-var source. If you find yourself wanting the runtime to affect authorization, stop and add a RLS policy instead.

## Testing the contract

- Unit test: `createSupabaseClient` throws on a `service_role`-shaped key.
- Unit test: each runtime's env-var resolution is tested with a mock source.
- Integration test: a user signed in on the web and the same user signed in on the mobile app see the same data within 5 seconds (spec SC-005, scaled down to a unit test that exercises the session-refresh path).
- Build-time test: gitleaks on the built asar / Expo bundle returns zero matches for the service-role JWT pattern.
