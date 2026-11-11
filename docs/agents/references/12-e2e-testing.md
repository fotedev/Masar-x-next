<!--
  Masar X — E2E testing reference (created 2026-11-11)
  The run contract for the web Playwright suite. AGENTS.md and the references
  index point here for any e2e / automation-testing task.
-->

# E2E testing (Playwright, web)

> **When to read this file:** any task that runs, writes, or diagnoses
> end-to-end browser tests — including agents running automation against the
> app. The suite is self-contained: no credentials, no test database, no
> app-side mock flag.

## Surface map

The ONLY automation-ready surface is the web Playwright suite: `apps/web/e2e/`
(14 specs / ~26 tests), chromium-only, fully parallel. Config:
[`apps/web/playwright.config.ts`](../../../apps/web/playwright.config.ts).
Desktop and mobile have **no** e2e harness (desktop's closest artifact is a
CI-skipped Vitest smoke test that spawns Electron; mobile has unit tests
only).

## Run it

| Context | Command |
|---|---|
| Local (default) | `pnpm test:e2e` (root alias) or `pnpm --filter web test:e2e` |
| Single spec | `pnpm --filter web test:e2e -- quiz-finish` |
| Already-running server | `E2E_BASE_URL=http://127.0.0.1:3000 pnpm --filter web test:e2e` |
| Opt-in production smoke | `E2E_BASE_URL=$URL E2E_PROD_URL=$URL pnpm --filter web test:e2e -- prod-smoke` |

- Without `E2E_BASE_URL` the config spawns `pnpm dev` on :3000 itself
  (`reuseExistingServer: true`, 180 s boot timeout). Do NOT leave a stale
  server on :3000 — see [01-gotchas.md §23](./01-gotchas.md).
- The `--no-proxy-server` launch arg is deliberate: browser-level localhost
  reachability on this dev host has failed through proxy paths before.
- CI (ci.yml `e2e` job, required check) builds the app and starts a
  production `next start` server, passing `E2E_BASE_URL` (which disables the
  local webServer). `test-results/` and `playwright-report/` upload as
  artifacts on failure (7-day retention).

## Environment the suite reads

| Variable | Meaning |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Required before any authed spec runs** — used ONLY to derive the `sb-<ref>-auth-token` cookie name, never for network auth. Resolved from the env, else parsed from `apps/web/.env.local` / `.env.development` / `.env` (cwd = `apps/web`). Gitignored → fresh worktrees must copy `apps/web/.env.local` in, or export the variable ([01-gotchas.md §22](./01-gotchas.md)). |
| `E2E_BASE_URL` | Overrides baseURL AND disables the local webServer (CI mode). |
| `E2E_PORT` | Local webServer port (default 3000). |
| `E2E_PROD_URL`, `E2E_PROD_QUIZ_ID` | Opt-in live-production smoke (`prod-smoke.spec.ts`); unset = skipped. |

## Auth architecture (read before writing an authed spec)

No real credentials exist anywhere in the repo; the suite never signs in.
Authed specs use [`apps/web/e2e/helpers/auth.ts`](../../../apps/web/e2e/helpers/auth.ts):

- `resolveSupabaseRef()` — cookie-name derivation + the missing-env error
  (names the worktree fix).
- `buildSeededSession(userId)` — fabricated 30-day Supabase session
  (`.mock-signature` JWT; client-truth only; email `e2e-user@example.com`).
- `seedAuthedSession(page, { baseURL, userId })` — registers belt-and-braces
  `/auth/v1/token` + `/auth/v1/user` + `/api/auth/sync` mocks and adds the
  `sb-<ref>-auth-token` cookie (`base64-` + base64url JSON — the
  `@supabase/ssr` cookieEncoding shape), so supabase-js `getSession()`
  resolves the user with ZERO auth network calls.

Per-spec `addInitScript` seeds (chat mode, Puter tokens) stay in the spec.
Anonymous specs instead mock `/auth/v1/user` → `{id:null}` and
`/auth/v1/token*` → `{error:"no_session"}` (duplicated per spec — small,
deliberately so).

Determinism rules: all data is `page.route()`-mocked inline JSON, ordered
LIFO — register the catch-all `**/rest/v1/**` FIRST, then specific handlers
win. There is no test database, no fixtures, no MSW, and no app-side mock
flag (a rejected `NEXT_PUBLIC_E2E_MOCK`-style idea would add a prod-code
branch the network-mock design makes unnecessary).

## Agent guidance (why automated runs succeed or fail here)

1. **Run the suite; do not drive the live app.** Probing
   `https://masarx.vercel.app` with a GUI browser "test" hits real auth, real
   data variance, and deployment protection — the failure pattern that looks
   like "automation doesn't work on Masar X". Only `prod-smoke.spec.ts`
   touches production, deliberately and opt-in.
2. **Fresh worktree first run:** copy `apps/web/.env.local` into the worktree
   BEFORE running e2e ([01-gotchas.md §22](./01-gotchas.md)).
3. **Don't minimize the test browser.** A minimized window stops
   `requestAnimationFrame` and collapses layout to zero-size, failing
   visibility assertions. Covering it with other windows is fine —
   `page.screenshot` captures the page's own compositor surface, never the
   OS desktop.
4. **Headless Edge/CDP cannot reach localhost on this machine** — the suite's
   bundled Chromium with `--no-proxy-server` is the verified path (memory:
   live-verification-env, 2026-09-17).
5. **A listening :3000 can still be a wedged server** (curl 000, no log
   entries) — kill the node PID + `rm -rf apps/web/.next` before blaming the
   suite ([01-gotchas.md §24](./01-gotchas.md)).

**Back to:** [AGENTS.md](../../../AGENTS.md)
