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
## Available MCP servers (verified 2026-08-24)

The user has these Model Context Protocol servers wired into their OpenCode
profile at `C:\Users\FOTE\.config\opencode\opencode.jsonc`. They give an
agent direct, structured access to infra without leaving the editor.

| MCP server | Transport | Auth | Primary use case |
|---|---|---|---|
| **supabase** | local stdio (`@supabase/mcp-server-supabase@latest`) | `SUPABASE_ACCESS_TOKEN` (read-only) | Schema introspection, ad-hoc SQL, RLS/policy inspection. Locked to project ref `jcufigozkhxazjbwhjjm` via `--project-ref`. |
| **github** | local stdio (`@modelcontextprotocol/server-github`) | `GITHUB_TOKEN` | Repo/PR/issue ops through MCP instead of the `gh` CLI when the agent needs structured tool calls. |
| **vercel** | remote HTTP (`https://mcp.vercel.com`) | `Authorization: Bearer <token>` (OAuth-compatible) | Deployments, env vars, build/runtime logs, Web Analytics, project search. Same surface as the `vercel` CLI but exposed as MCP tools. |
| **cloudflare-api** | remote HTTP (`https://mcp.cloudflare.com/mcp`) | `Authorization: Bearer <token>` (OAuth-compatible) | **Code Mode MCP** — exposes the entire Cloudflare API (~2,500 endpoints: DNS, Workers, R2, Zero Trust, KV, D1) via just two tools: `search()` and `execute()`. The model writes JavaScript against a typed OpenAPI spec; cost is ~1,000 tokens regardless of API size. |
| **cloudflare-docs** | remote HTTP (`https://docs.mcp.cloudflare.com/mcp`) | `Authorization: Bearer <token>` (OAuth-compatible) | Token-efficient search of Cloudflare's official documentation. Pairs with `cloudflare-api`: API server says WHAT to call, docs server says HOW. |
| **cloudflare-browser** | remote HTTP (`https://browser.mcp.cloudflare.com/mcp`) | `Authorization: Bearer <token>` (OAuth-compatible) | Cloudflare Browser Rendering — fetch web pages, convert to markdown, take screenshots. Requires the Browser Rendering product enabled on the account. |

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
- **For the 3 Cloudflare MCPs, the same User API Token is shared
  across `cloudflare-api`, `cloudflare-docs`, and `cloudflare-browser`.**
  Rotating the Cloudflare token means updating all 3 entries in one
  sweep — use a single grep-and-replace (e.g. on the old token value)
  before restarting the agent.

**Cloudflare MCPs — Code Mode pattern (important):**
- `cloudflare-api` does NOT expose individual API endpoints as tools.
  It exposes exactly two: `search()` (find the right endpoint +
  schema) and `execute()` (run JavaScript against the typed OpenAPI
  spec in an isolated Worker sandbox). This is by design — a native
  tool-per-endpoint MCP would cost >1M tokens to load.
- When using `cloudflare-api`, write the `execute()` call as a small
  script: search → read the returned schema → call the function →
  return the result. Don't try to enumerate endpoints one by one.
- `cloudflare-docs` is a complementary read-only knowledge source
  (prose + examples), not a code execution surface. Prefer it for
  "how do I configure X" questions, then drop down to
  `cloudflare-api` for the actual call.

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

### 13. The `cloudflare-api` / `cloudflare-docs` / `cloudflare-browser` MCPs documented in `<available_mcps>` are NOT loaded in this MiniMax Code session

The MCP servers listed in the `<available_mcps>` section of this file are configured in the **OpenCode profile** at `C:\Users\FOTE\.config\opencode\opencode.jsonc` — a separate config from MiniMax Code's. The **MiniMax Code runtime** loads its own MCPs from `C:\Users\FOTE\.minimax\mcp\mcp.json`, which (verified 2026-08-24) only includes: `opencode`, `matrix`, `playwright`, `cu`, `trash`. **Cloudflare is not there.**

**Diagnostic:** at the start of any session, run `mavis mcp list`. If it returns `{"servers": []}`, no MCPs are available regardless of what this file claims. `mavis mcp get <name>` will 404.

**Fallback when a documented MCP is missing:** use direct HTTP calls (with the user's API token) or the corresponding CLI (`wrangler` for Cloudflare, `vercel` for Vercel, `gh` for GitHub, `supabase` for Supabase). Confirm tool availability with `Get-Command <tool>` before relying on it.

### 14. Windows env var propagation: `setx` and `[Environment]::SetEnvironmentVariable(..., "User")` write to the registry, but do NOT update currently running processes

Each fresh shell (PowerShell, bash, etc.) starts with a copy of the registry-sourced env vars. Setting via the registry does not affect the current process — only **future** processes that re-read the registry will see the new value.

**For MiniMax Code's `bash` tool:** each `bash` invocation is a **new process**, so any env var set in one `bash` call is NOT visible in the next. Re-read from the registry inside every script that needs the var:

```powershell
$env:VAR = [Environment]::GetEnvironmentVariable("VAR", "User")
```

**For the user's interactive PowerShell:** also requires either reopening the window OR running the read-once line above. `setx VAR value` alone will not update the current `$env:VAR` — the next command still sees the old value.

**Diagnostic signal:** wrangler/HTTP call returns 401/403 even though `wrangler whoami` worked in a previous shell. The token IS in the registry but not in the current process.

### 15. Windows `EditEnvironmentVariables` GUI dialog (`rundll32.exe sysdm.cpl,EditEnvironmentVariables`) silently creates variables with empty values when paste buffer doesn't populate

When pasting long tokens (e.g. a 50-char `cfat_xxx` API token) into the legacy env-var dialog, the dialog may accept the empty value if Ctrl+V silently failed, and the registry entry will exist with an **empty string** (not null, not absent). Pressing `OK` does not validate that the value is non-empty.

**Symptom to grep for:** `Get-ItemProperty HKCU:\Environment -Name VAR` returns the var (so it exists), but `(Get-ItemProperty ...).VAR` is `""`. Auth fails with "invalid token" downstream.

**Workaround (proven 2026-08-24):** use a file-based handoff:
1. Paste the token into a plain `.txt` file (e.g. `C:\Users\FOTE\Downloads\cf-token.txt`).
2. Run a PowerShell script that reads the file, strips CRLF/BOM/whitespace, sets the var via `[Environment]::SetEnvironmentVariable(..., "User")`, then **re-reads and asserts the value is non-empty** before declaring success.

This is strictly more reliable than any UI-driven flow on Windows for long alphanumeric tokens.

### 16. GitHub Releases on a private repo are private — no public download, no anonymous auto-update

`provider: github` in `electron-builder.yml` uploads `.exe`, `latest.yml`, and `*.blockmap` to the GitHub Release **attached to the same repo as the source code**. If the source repo is private (e.g. `fotedev/Masar-x-next` is private), the release assets are also private:
- `https://github.com/<owner>/<repo>/releases/download/v.../Setup.exe` returns 404 for anonymous users.
- `electron-updater`'s `checkForUpdates()` cannot read the feed (no token, no access).
- The marketing website can't link to a direct download.

**Fix in this project:** split into two repos — the source code stays in `fotedev/Masar-x-next` (private); the release artifacts go to `fotedev/masarx-releases` (public). See "Release distribution" below.

**Diagnostic signal:** the desktop app shows "Update check failed" or the website's "Download" link returns 404, even though the `release.yml` workflow published successfully. Check `gh repo view <repo> --json isPrivate` — if `true`, the release is private.

### 17. `electron-builder` default `artifactName` includes the version — `/releases/latest/download/<name>` is literal, so a bare name 404s

`electron-builder` defaults `artifactName` to `"${productName}-${version}-${arch}.${ext}"`, so the actual assets on GitHub Releases are e.g. `Masar-X-Setup-0.5.8-x64.exe` and `Masar-X-Portable-0.5.8-x64.exe`.

GitHub's `/releases/latest/download/<name>` endpoint is **literal** — it does NOT do fuzzy matching or strip the version. A request for `.../Masar-X-Setup-x64.exe` 404s because the actual file is `Masar-X-Setup-0.5.8-x64.exe`. The version-pinned URL `.../download/v0.5.8/Masar-X-Setup-0.5.8-x64.exe` works (as copied from the GitHub releases page), but bare `/releases/latest/download/<bare-name>` does not.

**Two layered defenses in this project:**

1. **`electron-builder.yml` strips `${version}` from `artifactName`** (top-level, `nsis`, and `portable` blocks, all set to `"${productName}-${arch}.${ext}"` / `"${productName}-Setup-${arch}.${ext}"` / `"${productName}-Portable-${arch}.${ext}"`). From the next release (v0.5.9+) the file names are stable across versions, so `/releases/latest/download/Masar-X-Setup-x64.exe` always resolves.
2. **The website's `getLatestReleaseUrls()` in `apps/web/src/lib/github-releases.ts` queries the GitHub Releases API** (`/repos/fotedev/masarx-releases/releases/latest`) and uses each asset's `browser_download_url` directly. Falls back to parsing `latest.yml` if the API is rate-limited. This is what makes the v0.5.8 download page work TODAY, even though v0.5.8's files still have the version suffix (the new artifactName config only takes effect from v0.5.9 onward).

Caching: `next: { revalidate: 3600 }` on the fetch. Vercel's edge cache absorbs the 60/h unauthenticated API quota.

**Why both layers?** The API call handles today's v0.5.8 (which still has versioned names). The artifactName change makes future releases' URLs stable AND cacheable. Either alone would work; together they cover every release ever made.

**Diagnostic signal:** the user reports that "Download" buttons on the website 404, but the same URL works when copy-pasted from the GitHub releases page. Confirm by running:
```powershell
gh api repos/fotedev/masarx-releases/releases/latest --jq '.assets[].name'
```
If the names contain `-0.5.8-` (or any version) but your hardcoded URL says otherwise, that's the gotcha.

### 18. `pnpm/action-setup@v4` cannot find `packageManager` when source is checked out into a subdirectory

`pnpm/action-setup@v4` looks for the `packageManager` field in the workflow runner's CWD. By default this is the repo root. The Masar X release pipeline checks out private source into `source-code/` (because the workflow itself lives in the separate public releases repo), so the root `package.json` (with `"packageManager": "pnpm@9.15.4"`) is not visible to the action — the build fails at the `Setup pnpm` step with `No pnpm version is specified`.

The same pitfall affects `actions/setup-node@v4` with `cache: 'pnpm'`: the pnpm cache key is derived from a hash of `pnpm-lock.yaml`, but if the lockfile is in a subdirectory, the cache lookup silently no-ops.

**Fix:** in any workflow that checks the source out into a non-root path, pin both versions explicitly:
```yaml
- uses: pnpm/action-setup@v4
  with:
    version: 9.15.4          # read from the root package.json BEFORE merging
- uses: actions/setup-node@v4
  with:
    node-version: 24
    cache: 'pnpm'
    cache-dependency-path: source-code/pnpm-lock.yaml   # point at the real lockfile
```

**Diagnostic signal:** the `Setup pnpm` step fails with `Error: No pnpm version is specified.` even though the source repo's root `package.json` has the right `packageManager` field. Confirms that the workflow's CWD is not the source's root.

## Release distribution

The project ships desktop installers and mobile builds from a **separate public releases repo** so the main source repo can stay private while still enabling anonymous auto-updates and direct downloads from the website.

| Repo | Visibility | Contents |
|---|---|---|
| `fotedev/Masar-x-next` | **Private** | All source code, GitHub Actions workflows, secrets (`GH_RELEASES_TOKEN`, `NEXT_PUBLIC_*`, etc.) |
| `fotedev/masarx-releases` | **Public** | NSIS `.exe`, portable `.exe`, mobile `.apk` (when ready), `latest.yml`, `*.blockmap` |

**Why this works:**
- `electron-builder`'s `provider: github` accepts a `repo` that differs from the source repo — override in the `publish:` block.
- `electron-updater` reads the latest release from the public repo — no GitHub auth needed for end users.
- The website can link directly to `https://github.com/fotedev/masarx-releases/releases/latest`.

**How the upload happens:** the `release.yml` workflow in the **private** source repo clones, builds, then pushes the artifacts to the **public** releases repo using a Personal Access Token (`GH_RELEASES_TOKEN`) stored as a secret in the private repo. The PAT needs `repo` scope on the **public** releases repo (Fine-grained token scoped to that one repo is preferred for least-privilege).

**Adding a new platform:** the public releases repo can host additional artifacts (e.g. `.apk` for Android, `.dmg` for macOS, `.AppImage` for Linux) under the same release tag. `electron-updater` is platform-aware and ignores foreign-platform assets; mobile builds have their own update mechanism. Use tag prefixes like `desktop-v1.0.0` and `mobile-v1.0.0` if release cadences diverge — `electron-updater` uses `channel` and tag semver, so a single `v*` tag can still work as long as artifact paths don't collide.

## Public Runner pipeline (since v0.5.8)

The build itself has been moved out of the private source repo into a public-runner workflow in `fotedev/masarx-releases`. The private source repo still owns the **trigger decision** (which version gets released) but the **build minutes** are now unlimited (public GitHub Actions repos get free unlimited minutes vs. the 3,000 min/month Pro quota on the private source).

### Architecture

| Repo | Workflow | Purpose | Minutes |
|---|---|---|---|
| `fotedev/Masar-x-next` (private) | `.github/workflows/release.yml.disabled` | **Dormant** — kept for history; rename back if rollback needed | 0 |
| `fotedev/masarx-releases` (public) | `.github/workflows/build-release.yml` | **Active** — `workflow_dispatch` only; checks out private source via read-only PAT, builds, publishes release | unlimited (free) |

### How to release a new version

```powershell
# 1. Bump the version in the private source repo
Set-Location C:\programming\WEB_Development\projects\masarx_next
# Edit apps/desktop/package.json: "version": "0.5.9"
# Edit root package.json: "version": "0.5.9"
# Commit + push
git add apps/desktop/package.json package.json
git -c user.email='fotedev@users.noreply.github.com' -c user.name='fotedev' commit -m 'chore: bump version to 0.5.9'
git push origin main

# 2. Trigger the public-runner workflow (NO tag push needed!)
gh workflow run build-release.yml --repo fotedev/masarx-releases -f version_tag=v0.5.9
# Output: https://github.com/fotedev/masarx-releases/actions/runs/<id>

# 3. Watch the run (~7-8 min)
gh run watch <run-id> --repo fotedev/masarx-releases
```

Note: **no `git tag` is required**. The public-runner workflow takes the source-side tag as a `workflow_dispatch` input and checks out that ref from the private source. This means a botched run never pollutes the git history of the source repo with a tag you'd then have to delete.

### Required secrets on `fotedev/masarx-releases`

| Secret | Purpose | Where to set |
|---|---|---|
| `SOURCE_REPO_READ_TOKEN` | Fine-grained PAT, Contents: Read-only, scoped to `fotedev/Masar-x-next` only | https://github.com/fotedev/masarx-releases/settings/secrets/actions |
| `NEXT_PUBLIC_SUPABASE_URL` | Inlined into the web bundle at build time | same |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same | same |
| `NEXT_PUBLIC_SITE_URL` | same | same |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | optional, falls back to `ci-placeholder` | same |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | optional, falls back to `ci-placeholder` | same |

The old `GH_RELEASES_TOKEN` is no longer needed in the **private** source repo (since the build no longer runs there). The new public-runner workflow uses the **built-in `GITHUB_TOKEN`** of `masarx-releases` to publish — no PAT needed for the publish step itself.

### Security model

| Defense | Why |
|---|---|
| Fine-grained PAT scoped to one repo, read-only | A leaked token can only read Masar-x-next, not write anywhere |
| `if: github.repository == 'fotedev/masarx-releases'` on the job | Fork PRs cannot run the workflow even with approval |
| Actions settings: "Require approval for all external contributors" | Defense in depth — outside contributors' PRs require manual approval before their workflows can run |
| `::add-mask::` on the first secret-touching step | Prevents accidental secret leak in logs |
| Final `Clean up source checkout` step | Removes private source from runner disk so re-runs or follow-up steps cannot echo it |
| `$RUNNER_TEMP` for the mirror-tag scratch clone | Auto-cleaned by the runner; no manual delete needed |

### What it does

1. `workflow_dispatch` with `version_tag` (e.g. `v0.5.9`)
2. Mask the read token
3. `actions/checkout@v4` private source into `source-code/` (depth 1)
4. Setup pnpm 9.15.4 + Node 24 (see gotcha #18)
5. `pnpm install --frozen-lockfile` in `source-code/`
6. `pnpm --filter desktop exec electron-builder install-app-deps` (fetches better-sqlite3's Electron 32 ABI prebuild)
7. `pnpm --filter web build` (builds the Next.js standalone bundle that the desktop app ships as an `extraResource`)
8. **Mirror the release tag** to `masarx-releases` (clones this repo, writes a `versions/v0.5.9.txt` marker commit, force-pushes the `v0.5.9` tag). This is required because GitHub's releases API only creates a release against a tag that already exists in the same repo.
9. `pnpm --filter desktop run build:all` (electron-builder builds NSIS + Portable and publishes to `masarx-releases` using the built-in `GITHUB_TOKEN`)
10. List build artifacts
11. `Remove-Item -Recurse -Force source-code` to scrub the runner

### Why the tag-mirror step

GitHub's releases API requires "valid tag in same repo" — a 422 if you try to create a release against a tag that lives in a different repo. By pushing a marker commit + tag to `masarx-releases` first, we give electron-builder a valid tag to attach the release to. The marker commit has no real content (just `versions/v0.5.9.txt` with the run id and date); the actual release artifacts are the `.exe` and `latest.yml` files that electron-builder uploads as release assets.

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

### `release.yml.disabled` — **DORMANT**, kept for history

> ⚠️ This workflow was renamed from `release.yml` to
> `release.yml.disabled` in commit `ab17ec0` (2026-08-25). GitHub
> Actions only auto-runs files ending in `.yml` / `.yaml`, so the
> file is now dormant. It still contains the **previous** build
> pipeline (the private-runner one that used `GH_RELEASES_TOKEN` to
> push to `masarx-releases`).

**Do not rename back to `release.yml` unless rolling back the public-runner migration.** The new pipeline (see "Public Runner pipeline" above) is the supported way to release a new version. If the public runner is unavailable, the rollback procedure is:
1. Rename `release.yml.disabled` → `release.yml`
2. Ensure `GH_RELEASES_TOKEN` is still a valid secret on the private repo
3. Push a tag: `git tag vX.Y.Z && git push origin vX.Y.Z`

Trigger (when active): push a tag matching `v*` (e.g. `v0.5.7`). Steps:
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
