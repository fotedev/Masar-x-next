<!-- VERCEL BEST PRACTICES START -->
## Best practices for developing on Vercel

These defaults are optimized for AI coding agents (and humans) working on apps that deploy to Vercel.

- Treat Vercel Functions as stateless + ephemeral (no durable RAM/FS, no background daemons), use Blob or marketplace integrations for preserving state
- Edge Functions (standalone) are deprecated; prefer Vercel Functions
- Don't start new projects on Vercel KV/Postgres (both discontinued); use Marketplace Redis/Postgres instead
- Store secrets in Vercel Env Variables; not in git or `NEXT_PUBLIC_*`
- Provision Marketplace native integrations with `vercel integration add` (CI/agent-friendly)
- Sync env + project settings with `vercel env pull` / `vercel pull` when you need local/offline parity
- Use `waitUntil` for post-response work; avoid the deprecated Function `context` parameter
- Set Function regions near your primary data source; avoid cross-region DB/service roundtrips
- Tune Fluid Compute knobs (e.g., `maxDuration`, memory/CPU) for long I/O-heavy calls (LLMs, APIs)
- Use Runtime Cache for fast **regional** caching + tag invalidation (don't treat it as global KV)
- Use Cron Jobs for schedules; cron runs in UTC and triggers your production URL via HTTP GET
- Use Vercel Blob for uploads/media; Use Edge Config for small, globally-read config
- If Enable Deployment Protection is enabled, use a bypass secret to directly access them
- Add OpenTelemetry via `@vercel/otel` on Node; don't expect OTEL support on the Edge runtime
- Enable Web Analytics + Speed Insights early
- Use AI Gateway for model routing, set AI_GATEWAY_API_KEY, using a model string (e.g. 'anthropic/claude-sonnet-4.6'), Gateway is already default in AI SDK
  needed. Always curl https://ai-gateway.vercel.sh/v1/models first; never trust model IDs from memory
- For durable agent loops or untrusted code: use Workflow (pause/resume/state) + Sandbox; use Vercel MCP for secure infra access
<!-- VERCEL BEST PRACTICES END -->

<!-- AVAILABLE CLIS START -->
## Available CLIs (verified 2026-08-13)

User has these CLIs installed locally and authorized for project operations. Use them for verifiable infra operations instead of guessing dashboard URLs or asking the user to perform manual clicks.

| CLI | Common commands | Use case |
|---|---|---|
| **Vercel** (`vercel`) | `vercel deploy`, `vercel env`, `vercel logs`, `vercel integration add`, `vercel pull` | Deploys, env vars, build/runtime logs, marketplace integrations |
| **GitHub** (`gh`) | `gh pr create`, `gh issue`, `gh repo`, `gh api` | PRs, issues, repo ops, raw GitHub API |
| **Supabase** (`supabase`) | `supabase db push`, `supabase migration`, `supabase functions` | Schema migrations, edge functions, local dev |

**Safety rule:** Always ask for explicit confirmation before any state-changing CLI command (deploy, db push, secret set, branch push to protected branch). The CLIs are scriptable, but the operations they perform often are not.
<!-- AVAILABLE CLIS END -->

<!-- AVAILABLE MCPS START -->
## Available MCP servers (verified 2026-08-22)

The user has these Model Context Protocol servers wired into their OpenCode
profile at `C:\Users\FOTE\.config\opencode\opencode.jsonc`. They give an
agent direct, structured access to infra without leaving the editor.

| MCP server | Transport | Auth | Primary use case |
|---|---|---|---|
| **supabase** | local stdio (`@supabase/mcp-server-supabase@latest`) | `SUPABASE_ACCESS_TOKEN` (read-only) | Schema introspection, ad-hoc SQL, RLS/policy inspection. Locked to project ref `jcufigozkhxazjbwhjjm` via `--project-ref`. |
| **github** | local stdio (`@modelcontextprotocol/server-github`) | `GITHUB_TOKEN` | Repo/PR/issue ops through MCP instead of the `gh` CLI when the agent needs structured tool calls. |
| **vercel** | remote HTTP (`https://mcp.vercel.com`) | `Authorization: Bearer <token>` (OAuth-compatible) | Deployments, env vars, build/runtime logs, Web Analytics, project search. Same surface as the `vercel` CLI but exposed as MCP tools. |

**OpenCode config schema notes** (for agents that share this config):
- `mcp.<name>.command` is an **array** (exec + args), not a string.
- Env vars live under `mcp.<name>.environment`, **not** `env`.
- Remote servers use `mcp.<name>.url` + optional `mcp.<name>.headers`
  (no `command` / `environment` needed).
- This file is **distinct from** MiniMax Code's MCP config at
  `C:\Users\FOTE\.minimax\mcp\mcp.json` — do not conflate the two.

**Security rules — non-negotiable:**
- **Tokens are NEVER in this file or in git.** Real values live only in
  `C:\Users\FOTE\.config\opencode\opencode.jsonc` on the user's machine.
  When documenting or restating MCP config, use placeholders
  (`<YOUR_VERCEL_TOKEN>`, etc.) — never paste the actual value.
- A repo-local `.gitignore` must keep `opencode.jsonc` and
  `.minimax/mcp/mcp.json` out of any commit, even if those files live
  outside the repo tree. Do not move real tokens into project files.
- If a token needs to be rotated, update it in the canonical config
  first, then restart the agent. The agent cannot hot-reload auth
  headers mid-session.

**Overlap with the `vercel` CLI:** the Vercel MCP and the `vercel` CLI
have ~80% overlapping capability. Prefer the MCP for tool-call style
work (the agent can chain multiple calls without leaving the chat);
prefer the CLI for scripted workflows, CI, or when an MCP tool is
missing in the agent's current tool list. Both auth against the same
Vercel account.
<!-- AVAILABLE MCPS END -->

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at `specs/004-multi-platform-expansion/plan.md` (research, data model,
contracts, and quickstart live alongside it in the same directory).
<!-- SPECKIT END -->

<!-- PROJECT-SPECIFIC GOTCHAS START -->
## Project-specific gotchas (Masar X, verified 2026-08-14)

These came out of a real incident where Google OAuth sign-in returned
404 on `/en/auth/callback` and a 500 on `/en/login` for ~24h. The fixes
are committed on `main` (see git log for `3cd749e`, `efe0059`,
`122c692`, `bd8a1d3`, `59dc5f5`). **Read this section before touching
`src/lib/supabase/server.ts`, `src/navigation.ts`, or any OAuth
callback route.**

### 1. next-intl `useRouter` from `@/navigation` leaks into server bundle

- `src/navigation.ts` re-exports `useRouter` from `next-intl/navigation`
  via `createNavigation(routing)`. **It must start with `"use client";`**
  (see commit `bd8a1d3`). Without it, the re-exported `useRouter` is
  treated as server-safe by Next.js 16.2.1's webpack and hoisted into
  the server bundle, throwing `useRouter is not supported in Server
  Components`.
- `next-intl@4.9.0` + `next@16.2.1` has an additional compatibility
  issue: webpack cannot statically analyze next-intl's dynamic
  import in `dist/esm/production/extractor/format/index.js`
  (Build dependencies behind this expression are ignored), so
  even with `"use client"` in `src/navigation.ts`, pages that
  call `useRouter()` at the **top of the component body** (not
  inside `useEffect`/event handlers) still fail in production
  builds. **Fix:** in pages like `login/page.tsx` and
  `signup/page.tsx`, import `useRouter` directly from
  `next/navigation` and prepend the locale manually
  (`router.push(\`/${locale}/${page}\`)`). See commit `122c692`.
- Why profile/news etc. keep working: they call `router.push` inside
  `useEffect` or event handlers, so the server render pass never
  invokes the hook. login/signup are the only two that invoke it
  at component top level.

### 2. BOM (U+FEFF) in `@supabase/ssr@0.8.0` cookies breaks undici

- In Next.js 16 + `@supabase/ssr@0.8.0`, the supabase client emits
  Set-Cookie values that occasionally start with U+FEFF
  (the UTF-8 byte-order-mark). `undici`'s `Headers.set` throws
  `TypeError: Cannot convert argument to a ByteString because the
  character at index 0 has a value of 65279`, which bubbles up
  as a 500 on every page that calls `supabase.auth.getUser()`
  (i.e. the entire `/[locale]` layout's profile fetch AND
  `/api/auth/sync`).
- **Fix:** in `src/lib/supabase/server.ts`, strip U+FEFF from both
  `getAll()` (existing cookies) and `setAll()` (new cookies).
  See commits `3cd749e` and `efe0059`.
- Symptom to grep for in Vercel logs: `ByteString` or `65279`
  in any stack trace, especially under `.next/server/chunks/6350.js`
  (the supabase ssr chunk).

### 3. OAuth callback route MUST live under `[locale]`

- With `localePrefix: "always"` in `next-intl/routing.ts`, the
  Google OAuth redirect lands on `/{locale}/auth/callback`
  (built by `AuthContext.signInWithGoogle` as
  `\`${origin}/\${locale}/auth/callback\``). The route handler
  must live at `src/app/[locale]/auth/callback/route.ts`,
  NOT `src/app/auth/callback/route.ts`. See commit `59dc5f5`.
- The git history has a stale comment in `i18n/routing.ts`
  (line 13-14) saying navigation APIs were "moved to
  `@/navigation` to keep this file server-safe" — this was true
  once, but the directory `src/app/[locale]/auth/` was
  accidentally emptied during PR #7's auth refactor. The fix
  is the route, not the refactor. Do NOT remove the `auth/`
  ignore-rule in `.gitignore` without first re-creating the
  route file under `[locale]`.

### 4. Vercel Deployment Protection masks bugs

- The Vercel deployment URL (e.g. `masar-x-next-XXXXXX.vercel.app`)
  is gated by SSO. Any request to it returns 302 to
  `/sso-api?...` BEFORE the app handler runs. The alias domain
  (`masarx.vercel.app`) is NOT gated, so real page render errors
  show up there.
- **Always smoke-test the alias domain, not the deployment URL.**
  A 302 on the deployment URL is meaningless; a 302/200 on the
  alias domain is the real signal.
- The BOM issue above was invisible on the deployment URL for
  the same reason — the 500 only manifested on the alias.

### 5. Vercel free tier can't `vercel rollback` more than 1 deploy

- `vercel rollback <deploymentId>` requires Pro plan
  (error: `To rollback further than the previous production
  deployment, upgrade to pro. (402)`).
- **Free alternative:** `vercel promote <deploymentId>`
  (works the same way, no plan limit). Then run
  `vercel cache purge --yes` to flush edge cache.
- The "previous production" is whatever's currently aliased to
  the production domain. To find it: `vercel inspect <alias-domain>`.

### 6. `SUPABASE_SERVICE_ROLE_KEY` must be in Vercel env, not just `.env`

- `src/actions/auth.ts` reads `process.env.SUPABASE_SERVICE_ROLE_KEY`
  directly. If it's missing from Vercel production, the sync
  returns "Database not configured" with status 500.
- `vercel env ls production` does NOT list it by default search;
  always grep for `SUPABASE` after adding/removing env vars.
- Adding it via CLI: pipe the value from `.env` to
  `vercel env add SUPABASE_SERVICE_ROLE_KEY production --yes`
  (stdin). The value stays encrypted in Vercel's storage; only
  the *name* shows in `vercel env ls`.
- **Never** paste a service role key into chat/CLI args directly
  — the shell history will record it.

### 7. `vercel.json` redirect from `masar-x.vercel.app` to `masarx.vercel.app`

- There is a `301 permanent` redirect in `vercel.json` from
  `masar-x.vercel.app/(.*)` → `https://masarx.vercel.app/$1`.
- This means the `masar-x` hostname is dead — anything testing
  the OAuth flow on it will redirect and the `state` param may
  be lost. **Always use `masarx.vercel.app`** (without hyphen).
- If the user reports "the redirect URL doesn't match", check
  they're not using the hyphenated variant.

### 8. pnpm 9.x: `pnpm.neverBuiltDependencies` goes in root `package.json`, NOT `.npmrc`

`pnpm 9.x` silently ignores the `.npmrc` form
(`neverBuiltDependencies[]=pkg-name`) for workspace projects
(pnpm/pnpm#5407). Put it under the `"pnpm"` key in the root
`package.json` instead. `--ignore-scripts` is the wrong
substitute — it also skips `electron`'s postinstall and
breaks `electron-builder install-app-deps`.

### 9. `gh secret set` from Windows `.env` keeps trailing `\r\n`

`Get-Content .env | gh secret set X --body -` includes the
file's CRLF in the secret value. For URL-shaped secrets
(`NEXT_PUBLIC_SUPABASE_URL`, etc.) the resulting `\r\n`
suffix makes `new URL(...)` throw `Invalid supabaseUrl` at
prerender time, not at compile time. `gh secret list` won't
surface this. Re-set with literal-quoted
`--body "https://..."` (no newline).

### 10. Webpack aliases for direct deps must walk up to the monorepo root

With `node-linker=hoisted` (`.npmrc`), pnpm 9.x puts direct
deps at the root `node_modules/`, not at
`apps/web/node_modules/`. Any webpack alias like
`path.resolve(__dirname, "node_modules/<dep>/...")` in
`apps/web/next.config.mjs` will fail with
`Module not found: Can't resolve '<dep>'`. Use
`path.resolve(__dirname, "..", "..", "node_modules/<dep>/...")`
instead.

### 11. Pin Electron exactly in `apps/desktop/package.json`

`electron-builder install-app-deps` needs an exact version
(no `^`, no `~`). `"electron": "^32.2.0"` makes it fail
with `Cannot compute electron version from installed node
modules`. Use `"electron": "32.2.0"`.

### 12. Vercel: `cache purge` + `redeploy` for pnpm path-format mismatches

Vercel's bundled pnpm occasionally materializes the
`.pnpm/<long-format-path>/...` directory as empty even when
the install reports success — then `next build` fails with
`Cannot find module '.../.pnpm/next@16.2.1_@babel+core@.../next/dist/bin/next'`.
Local pnpm 9.15.4 does not reproduce this. Workaround:
`vercel cache purge --yes` then `vercel redeploy <url> --no-wait`.
Note: the "Vercel - Deployment has failed" check can stay
stuck on the original failed deployment ID even after a
successful `redeploy` — confirm with `vercel list --limit 1`
(`● Ready` on the latest).

## Workflows

CI and release are fully automated via GitHub Actions. Do
NOT build installers or Vercel deploys locally unless asked
— the workflows cover it.

### `ci.yml` — runs on every push to `main` and every PR

5 jobs: ESLint, next build, gitleaks-artifacts, workspaces,
ai-endpoint-grep. `pnpm install` uses
`pnpm.neverBuiltDependencies: ["better-sqlite3"]` from root
`package.json` (gotcha #8). No `--ignore-scripts` — all
other postinstalls (electron, esbuild, sharp, @swc/core)
still run.

### `release.yml` — tag-triggered, builds the Windows desktop installer

Trigger: push a tag matching `v*` (e.g. `v0.5.7`). Workflow
file: `.github/workflows/release.yml`. Steps:
1. `pnpm install --frozen-lockfile` (uses
   `pnpm.neverBuiltDependencies` to skip better-sqlite3)
2. `pnpm --filter desktop exec electron-builder install-app-deps`
   (fetches `electron-v128` prebuild for Electron 32.3.3)
3. `pnpm --filter web build` (NEXT_PUBLIC_* come from
   repo secrets)
4. `pnpm --filter desktop run build:all` (produces both
   NSIS `Setup` and `Portable` `*.exe` in `apps/desktop/out/`)
5. `softprops/action-gh-release@v2` publishes them to a
   GitHub Release named after the tag.

To release: bump the version in `package.json` +
`apps/desktop/package.json`, commit, then:
```bash
git tag v0.5.7         # tag moves with the new commit
git push origin main --follow-tags
```
Or for a re-tag on an existing commit: `git tag -d v0.5.7
&& git push origin --delete v0.5.7 && git tag v0.5.7 &&
git push origin v0.5.7`.

Vercel deploys on every push to `main` automatically — no
manual deploy needed.

<!-- PROJECT-SPECIFIC GOTCHAS END -->
