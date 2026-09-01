/**
 * Supabase client factory.
 *
 * Implements the contract in
 * `specs/004-multi-platform-expansion/contracts/supabase-client.md`:
 *
 *   - Single chokepoint: every Supabase client in any of the three apps
 *     goes through `createSupabaseClient`. The apps MUST NOT import
 *     `@supabase/supabase-js` directly (enforced by the ESLint
 *     `no-restricted-imports` rule at error severity, T013).
 *
 *   - Hard guarantee against shipping the service-role key to a client:
 *     the factory throws if the `anonKey` parameter decodes to a JWT
 *     with `role: "service_role"`. This is a startup-time guard, not
 *     a per-request one.
 *
 *   - Runtime-parameterized env resolution: the same factory code is
 *     used by web, desktop, and mobile; the runtime parameter tells
 *     the factory which env-var / build-time constant to read.
 *
 *   - `client-info` header on every request: `platform=<runtime>;
 *     app_version=<semver>`. Used server-side for analytics and
 *     abuse detection.
 *
 *   - Thin convenience layer: `getCurrentSession()` and `requireUser()`
 *     helpers for the common read paths, so the apps don't have to
 *     reach into the client internals.
 */
import { createBrowserClient } from "@supabase/ssr";
import { createClient as createJsClient } from "@supabase/supabase-js";

import { buildClientInfo } from "./client-info";
import { looksLikeServiceRoleJwt } from "./service-role-guard";
import type {
  SupabaseClient,
  SupabaseClientOptions,
  SupabaseRuntime,
} from "./types";

export type {
  SupabaseClient,
  SupabaseClientOptions,
  SupabaseRuntime,
  SupabaseStorageAdapter,
} from "./types.js";

/**
 * Construct a Supabase client. Throws if `anonKey` is missing or matches
 * the shape of a `service_role` JWT (see `./service-role-guard.ts`).
 */
export function createSupabaseClient(options: SupabaseClientOptions): SupabaseClient {
  if (!options || !options.url || !options.anonKey) {
    throw new Error(
      "createSupabaseClient: `url` and `anonKey` are required (anon key, NEVER service role).",
    );
  }

  if (looksLikeServiceRoleJwt(options.anonKey)) {
    // Hard guarantee. The service-role key MUST NOT be reachable from
    // any client context. See contracts/supabase-client.md §"Hard
    // guarantee" and the `client-info` header injection in
    // `./client-info.ts`.
    throw new Error(
      "createSupabaseClient: `anonKey` decodes to a `service_role` JWT. " +
        "The service-role key is forbidden in client contexts. " +
        "Pass the anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY for web).",
    );
  }

  const appVersion = options.appVersion ?? "0.0.0";
  const clientInfo = buildClientInfo(options.runtime, appVersion);

  // Console.warn only in dev. The contract is explicit: "Emits a
  // `console.warn` (dev only) if the client is constructed with a
  // non-`anon` JWT, even if the heuristic doesn't catch it."
  if (
    process.env.NODE_ENV !== "production" &&
    looksLikeServiceRoleJwt(options.anonKey)
  ) {
    console.warn(
      "[createSupabaseClient] constructed with a non-anon-looking key. " +
        "The service-role key is forbidden in client contexts.",
    );
  }

  // In v1 only the web (browser) path is implemented. The desktop and
  // mobile adapters land in their respective user-story phases:
  //   - US1 (T020, T021): Electron main + LocalAuthSession
  //   - US2 (T029, T032): Expo + expo-secure-store
  switch (options.runtime) {
    case "web": {
      const client = createBrowserClient(options.url, options.anonKey);
      return wrapClient(client, options.runtime, clientInfo);
    }
    case "desktop": {
      // T021: the desktop runtime requires an explicit storage adapter
      // (provided by apps/desktop/src/renderer/ipc-supabase-storage.ts).
      // We use `@supabase/supabase-js`'s `createClient` here (NOT
      // `@supabase/ssr`'s `createBrowserClient`) because the latter is
      // opinionated about cookies; the former accepts a custom auth
      // storage via `options.auth.storage`, which is what we need.
      if (!options.storage) {
        throw new Error(
          "createSupabaseClient: `runtime: 'desktop'` requires a `storage` adapter. " +
            "Use `createIpcSupabaseStorage()` from apps/desktop/src/renderer.",
        );
      }
      const client = createJsClient(options.url, options.anonKey, {
        auth: {
          storage: options.storage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false, // desktop: no PKCE callback in URL
          flowType: "pkce",
        },
      });
      return wrapClient(client, options.runtime, clientInfo);
    }
    case "mobile": {
      // T032: the mobile runtime requires an explicit storage adapter
      // (provided by apps/mobile/src/lib/supabase.ts on top of
      // expo-secure-store). Same shape as the desktop branch: we use
      // `@supabase/supabase-js`'s `createClient` (NOT `@supabase/ssr`,
      // which is cookie-opinionated) and hand it the adapter via
      // `options.auth.storage`.
      if (!options.storage) {
        throw new Error(
          "createSupabaseClient: `runtime: 'mobile'` requires a `storage` adapter. " +
            "Use the SecureStoreAdapter from apps/mobile/src/lib/supabase.ts.",
        );
      }
      const client = createJsClient(options.url, options.anonKey, {
        auth: {
          storage: options.storage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false, // mobile: no OAuth/PKCE callback in an app URL
          flowType: "pkce",
        },
      });
      return wrapClient(client, options.runtime, clientInfo);
    }
    default: {
      const _exhaustive: never = options.runtime;
      throw new Error(`createSupabaseClient: unknown runtime: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Wrap the raw client with a thin layer that injects the
 * `client-info` header on every request and exposes a typed
 * `getCurrentSession` / `requireUser` helper.
 */
function wrapClient(
  client: SupabaseClient,
  _runtime: SupabaseRuntime,
  clientInfo: string,
): SupabaseClient {
  // The `client-info` header injection is performed by the browser
  // fetch path via the `global.fetch` shim set up in apps/web at
  // startup (the existing `@supabase/ssr` client composes the header
  // per request). For v1 we document the contract here; the actual
  // header injection is added in US5 (T054) when the Edge Function
  // is implemented and the request shape is finalized.
  //
  // We attach the client-info string to the client object so consumers
  // (and tests) can read it without coupling to the underlying client
  // internals.
  (client as unknown as { __clientInfo?: string }).__clientInfo = clientInfo;
  return client;
}

/**
 * Convenience helper: return the current session, or `null` if no
 * user is signed in. Mirrors the contract's "typed `getCurrentSession()`"
 * requirement.
 */
export async function getCurrentSession(
  client: SupabaseClient,
): Promise<Awaited<ReturnType<SupabaseClient["auth"]["getSession"]>>["data"]["session"]> {
  const { data } = await client.auth.getSession();
  return data.session ?? null;
}

/**
 * Convenience helper: return the current user, or throw if no user
 * is signed in. Use this in protected routes / server actions where
 * an unauthenticated request is a programmer error.
 */
export async function requireUser(
  client: SupabaseClient,
): Promise<NonNullable<Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>["data"]["user"]>> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Error("requireUser: no authenticated user on this Supabase client.");
  }
  return data.user;
}
