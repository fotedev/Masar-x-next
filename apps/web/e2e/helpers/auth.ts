import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

/**
 * Shared seeded-session helpers for authed e2e specs.
 *
 * Extracted 2026-11-11 from verbatim duplicates that had drifted across
 * ai-chat-send / ai-chat-history / quiz-finish / trw-redeem specs.
 *
 * The web runtime builds its client through @supabase/ssr's
 * createBrowserClient, which persists the session in a COOKIE (not
 * localStorage): name `sb-<ref>-auth-token`, value `base64-` + base64url
 * JSON (createStorageFromOptions cookieEncoding: "base64url"). Seeding that
 * exact shape lets supabase-js v2's getSession() resolve the user with zero
 * /auth/v1 calls — no real credentials, no app-side test branches.
 */

export const E2E_USER_EMAIL = "e2e-user@example.com";

/**
 * Derive the Supabase project ref (the hostname's first label) used in the
 * session-cookie name. Reads NEXT_PUBLIC_SUPABASE_URL from the env, else
 * parses the gitignored env files next to the web app (Playwright runs with
 * cwd = apps/web). The URL value is never used for network auth — the cookie
 * name is the only consumer.
 */
export function resolveSupabaseRef(): string {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url) {
    for (const file of [".env.local", ".env.development", ".env"]) {
      try {
        const raw = readFileSync(path.resolve(process.cwd(), file), "utf8");
        url = raw.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
        if (url) break;
      } catch {
        // file missing — try the next candidate
      }
    }
  }
  if (!url) {
    throw new Error(
      "e2e/helpers/auth: NEXT_PUBLIC_SUPABASE_URL not found (env or apps/web/.env.local) — cannot derive the supabase-js session-cookie name. Fix: export NEXT_PUBLIC_SUPABASE_URL, or copy apps/web/.env.local into this checkout (gitignored env files do not come with fresh worktrees). See docs/agents/references/12-e2e-testing.md.",
    );
  }
  return new URL(url).hostname.split(".")[0];
}

/** Fabricate a 30-day, client-truth-only Supabase session for `userId`. */
export function buildSeededSession(userId: string) {
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresIn = 60 * 60 * 24 * 30;
  const expiresAt = nowSec + expiresIn;
  const b64url = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const accessToken = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({
    sub: userId,
    exp: expiresAt,
    aud: "authenticated",
    role: "authenticated",
  })}.mock-signature`;
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: expiresIn,
    expires_at: expiresAt,
    refresh_token: "mock-refresh-token",
    user: {
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      email: E2E_USER_EMAIL,
      phone: "",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { full_name: "E2E User" },
      identities: [],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  };
}

/**
 * Seed the authed session for `userId`: register belt-and-braces route mocks
 * (far-future expiry means gotrue should never refresh, but if it does, don't
 * let a fake refresh token 400 against the real project and silently sign the
 * user out mid-test) and add the `sb-<ref>-auth-token` cookie. Call before
 * page.goto; per-spec addInitScript seeds stay in the spec.
 */
export async function seedAuthedSession(
  page: Page,
  options: { baseURL?: string; userId: string },
) {
  const storageKey = `sb-${resolveSupabaseRef()}-auth-token`;
  const session = buildSeededSession(options.userId);
  await page.route("**/auth/v1/token?*", (route) => route.fulfill({ json: session }));
  await page.route("**/auth/v1/user", (route) => route.fulfill({ json: session.user }));
  await page.route("**/api/auth/sync", (route) => route.fulfill({ json: { ok: true } }));
  await page.context().addCookies([
    {
      name: storageKey,
      value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
      domain: new URL(options.baseURL ?? "http://localhost:3000").hostname,
      path: "/",
    },
  ]);
}
