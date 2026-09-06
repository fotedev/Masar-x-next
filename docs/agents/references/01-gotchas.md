<!--
  Masar X — Project Gotchas (verified 2026-09-05)
  Full gotcha reference extracted from AGENTS.md (which now only indexes this).
  Each gotcha is dated, has a "Why" rationale, and an action checklist.
  Read by topic; never read this entire file unless debugging a class of issues.
-->

# Project Gotchas — full reference

> **When to read this file:** the index in `AGENTS.md` will point you here when
> you touch a relevant subsystem (OAuth, Supabase SSR, Electron build, Vercel
> env, pnpm/Node tooling, Windows env vars, GitHub Releases, theme hydration,
> git stash, AI tooling). Otherwise skip.

## Conventions used in this file

- **Numbered** to match the historical sequence in the old AGENTS.md.
- **Each entry has:** Trigger (when does it bite), Why (root cause), Fix (what to do), Symptom (how to recognise it in logs / runtime).
- **Verified dates** are noted where the gotcha was last confirmed in production or CI.

---

## 1. next-intl `useRouter` from `@/navigation` leaks into the server bundle

- **Trigger:** You call `router.push(...)` from a page component at the **top of the component body** (not inside `useEffect` or event handlers), using the `useRouter` re-exported from `@/navigation`.
- **Why:** `src/navigation.ts` re-exports `useRouter` from `next-intl/navigation` via `createNavigation(routing)`. Without `"use client"` at the top of `src/navigation.ts`, webpack 16.2.1 treats the re-exported `useRouter` as server-safe and hoists it into the server bundle, throwing `useRouter is not supported in Server Components`. Additionally `next-intl@4.9.0` + `next@16.2.1` has a webpack dynamic-import warning in `dist/esm/production/extractor/format/index.js`.
- **Fix:**
  1. Keep `"use client"` at the top of `src/navigation.ts` (commit `bd8a1d3`).
  2. In pages that call `useRouter()` at the top of the body (currently only `login/page.tsx` and `signup/page.tsx`), import directly from `next/navigation` and prepend the locale manually: `router.push(\`/${locale}/${page}\`)`. See commit `122c692`.
- **Symptom:** Build fails with `useRouter is not supported in Server Components` or the dev server throws on render of the affected page.

## 2. BOM (U+FEFF) in `@supabase/ssr@0.8.0` cookies breaks undici

- **Trigger:** Next.js 16 + `@supabase/ssr@0.8.0` server emits Set-Cookie values that occasionally start with U+FEFF (UTF-8 BOM).
- **Why:** `undici`'s `Headers.set` throws `TypeError: Cannot convert argument to a ByteString because the character at index 0 has a value of 65279`. This bubbles up as 500 on every page that calls `supabase.auth.getUser()` (the entire `/[locale]` layout profile fetch + `/api/auth/sync`).
- **Fix:** In `src/lib/supabase/server.ts`, strip U+FEFF from both `getAll()` (existing cookies) and `setAll()` (new cookies). See commits `3cd749e` and `efe0059`.
- **Symptom:** Grep Vercel logs for `ByteString` or `65279`, especially under `.next/server/chunks/6350.js` (supabase ssr chunk).

## 3. OAuth callback route MUST live under `[locale]`

- **Trigger:** With `localePrefix: "always"` in `next-intl/routing.ts`, the Google OAuth redirect lands on `/{locale}/auth/callback` (built by `AuthContext.signInWithGoogle`).
- **Why:** Route handler must live at `src/app/[locale]/auth/callback/route.ts`, NOT `src/app/auth/callback/route.ts`.
- **Fix:** Commit `59dc5f5`. Do NOT remove the `auth/` ignore-rule in `.gitignore` without first re-creating the route file under `[locale]`.
- **Symptom:** Google OAuth flow completes but the user lands on a 404.

## 4. Vercel Deployment Protection masks bugs

- **Trigger:** You smoke-test a preview URL like `masar-x-next-XXXXXX.vercel.app`.
- **Why:** That deployment URL is gated by SSO. Any request returns 302 to `/sso-api?...` BEFORE the app handler runs. The alias domain (`masarx.vercel.app`) is NOT gated.
- **Fix:** Always smoke-test the alias domain, not the deployment URL. A 302 on the deployment URL is meaningless; a 302/200 on the alias domain is the real signal.
- **Symptom:** The BOM issue from gotcha #2 was invisible on the deployment URL for the same reason — 500 only manifested on the alias.

## 5. Vercel free tier can't `vercel rollback` more than 1 deploy

- **Trigger:** You want to revert to a deploy older than the immediately previous one.
- **Why:** `vercel rollback <deploymentId>` requires Pro plan (error: `To rollback further than the previous production deployment, upgrade to pro. (402)`).
- **Fix:** Use `vercel promote <deploymentId>` instead (works the same, no plan limit). Then `vercel cache purge --yes` to flush edge cache.
- **To find "previous production":** `vercel inspect <alias-domain>`.

## 6. `SUPABASE_SERVICE_ROLE_KEY` must be in Vercel env, not just `.env`

- **Trigger:** `/api/auth/sync` returns "Database not configured" with status 500.
- **Why:** `src/actions/auth.ts` reads `process.env.SUPABASE_SERVICE_ROLE_KEY` directly. If it's missing from Vercel production, the sync fails.
- **Fix:** Add via CLI (pipe from `.env`):
  ```
  vercel env add SUPABASE_SERVICE_ROLE_KEY production --yes  < .env
  ```
  Vercel encrypts the value; only the name shows in `vercel env ls`. `vercel env ls production` does NOT list it by default search; always grep for `SUPABASE` after changes.
- **Symptom:** Auth sync returns 500; admin operations fail silently.
- **Security:** Never paste a service role key into chat/CLI args — the shell history will record it.

## 7. `vercel.json` redirect from `masar-x.vercel.app` to `masarx.vercel.app`

- **Trigger:** User reports OAuth `state` param lost / redirect URL mismatch.
- **Why:** `vercel.json` has a `301 permanent` redirect from `masar-x.vercel.app/(.*)` → `https://masarx.vercel.app/$1`. The `masar-x` hostname is dead.
- **Fix:** Always use `masarx.vercel.app` (without hyphen) for testing the OAuth flow.

## 8. pnpm 9.x: `pnpm.neverBuiltDependencies` goes in root `package.json`, NOT `.npmrc`

- **Trigger:** You add a package that needs to skip its postinstall (currently `better-sqlite3`).
- **Why:** `pnpm 9.x` silently ignores the `.npmrc` form (`neverBuiltDependencies[]=pkg-name`) for workspace projects (pnpm/pnpm#5407). `--ignore-scripts` is the wrong substitute — it also skips `electron`'s postinstall and breaks `electron-builder install-app-deps`.
- **Fix:** Put it under the `"pnpm"` key in the root `package.json`:
  ```json
  "pnpm": { "neverBuiltDependencies": ["better-sqlite3"] }
  ```

## 9. `gh secret set` from Windows `.env` keeps trailing `\r\n`

- **Trigger:** `Get-Content .env | gh secret set X --body -` on Windows.
- **Why:** The file's CRLF is included in the secret value. For URL-shaped secrets (`NEXT_PUBLIC_SUPABASE_URL` etc.) the resulting `\r\n` suffix makes `new URL(...)` throw `Invalid supabaseUrl` at **prerender** time, not compile time. `gh secret list` won't surface this.
- **Fix:** Re-set with literal-quoted `--body "https://..."` (no newline).

## 10. Webpack aliases for direct deps must walk up to the monorepo root

- **Trigger:** A webpack alias in `apps/web/next.config.mjs` uses `path.resolve(__dirname, "node_modules/<dep>/...")`.
- **Why:** With `node-linker=hoisted` (`.npmrc`), pnpm 9.x puts direct deps at the root `node_modules/`, not at `apps/web/node_modules/`. The alias fails with `Module not found: Can't resolve '<dep>'`.
- **Fix:** `path.resolve(__dirname, "..", "..", "node_modules/<dep>/...")`.

## 11. Pin Electron exactly in `apps/desktop/package.json`

- **Trigger:** `pnpm --filter desktop exec electron-builder install-app-deps` fails with `Cannot compute electron version from installed node modules`.
- **Why:** `electron-builder install-app-deps` needs an exact version (no `^`, no `~`).
- **Fix:** Use `"electron": "32.2.0"` (exact) in `apps/desktop/package.json`.

## 12. Vercel: `cache purge` + `redeploy` for pnpm path-format mismatches

- **Trigger:** `next build` fails on Vercel with `Cannot find module '.../.pnpm/next@16.2.1_@babel+core@.../next/dist/bin/next'` — but local `pnpm install` works fine.
- **Why:** Vercel's bundled pnpm occasionally materializes `.pnpm/<long-format-path>/...` as empty even when install reports success.
- **Fix:** `vercel cache purge --yes && vercel redeploy <url> --no-wait`. The "Vercel - Deployment has failed" check can stay stuck on the original failed deployment ID even after a successful `redeploy` — confirm with `vercel list --limit 1` (`● Ready` on the latest).

## 13. Cloudflare MCPs documented in AGENTS.md are NOT loaded in MiniMax Code sessions

- **Trigger:** You try to use `cloudflare-api` / `cloudflare-docs` / `cloudflare-browser` MCPs.
- **Why:** Those are configured in the OpenCode profile (`C:\Users\FOTE\.config\opencode\opencode.jsonc`) — a separate config from MiniMax Code's MCP config at `C:\Users\FOTE\.minimax\mcp\mcp.json` (verified 2026-08-24: only `opencode`, `matrix`, `playwright`, `cu`, `trash` are loaded).
- **Fix:** Run `mavis mcp list` at session start. If it returns `{"servers": []}`, no MCPs are available regardless of what AGENTS.md claims. Fall back to direct HTTP calls or the corresponding CLI (`wrangler` for Cloudflare, `vercel` for Vercel, `gh` for GitHub, `supabase` for Supabase). Confirm tool availability with `Get-Command <tool>` before relying on it.

## 14. Windows env var propagation: `setx` and `[Environment]::SetEnvironmentVariable(..., "User")` do NOT update running processes

- **Trigger:** You `setx VAR value` (or use the GUI dialog) and immediately try to use `$env:VAR` in the same shell.
- **Why:** Registry writes take effect on **future** processes only. The current process still holds the old value.
- **Fix (Hermes `bash` tool):** each `bash` invocation is a new process, so re-read from registry in every script:
  ```powershell
  $env:VAR = [Environment]::GetEnvironmentVariable("VAR", "User")
  ```
  For interactive PowerShell, also requires reopening the window or running the read-once line above.
- **Symptom:** `wrangler` / HTTP call returns 401/403 even though `wrangler whoami` worked in a previous shell. The token IS in the registry but not in the current process.

## 15. Windows `EditEnvironmentVariables` GUI dialog silently creates empty values

- **Trigger:** You paste a long token (e.g. 50-char `cfat_xxx`) into the legacy env-var dialog and hit OK.
- **Why:** If Ctrl+V silently failed, the dialog accepts the empty value and writes it to the registry as an empty string (not null, not absent). Pressing OK does not validate.
- **Fix:** Use a file-based handoff:
  1. Paste token into a plain `.txt` file (e.g. `C:\Users\FOTE\Downloads\cf-token.txt`).
  2. Run a PowerShell script that reads the file, strips CRLF/BOM/whitespace, sets via `[Environment]::SetEnvironmentVariable(..., "User")`, then **re-reads and asserts non-empty** before declaring success.
- **Symptom:** `Get-ItemProperty HKCU:\Environment -Name VAR` returns the var (exists), but `(Get-ItemProperty ...).VAR` is `""`. Auth fails with "invalid token" downstream.

## 16. GitHub Releases on a private repo are private — no public download, no anonymous auto-update

- **Trigger:** `provider: github` in `electron-builder.yml` uploads `.exe`, `latest.yml`, `*.blockmap` to a private GitHub Release.
- **Why:** Release assets on a private repo are private. `https://github.com/<owner>/<repo>/releases/download/v.../Setup.exe` returns 404 for anonymous users. `electron-updater`'s `checkForUpdates()` cannot read the feed (no token, no access). The marketing website can't link to a direct download.
- **Fix:** Split into two repos:
  - Source code: `fotedev/Masar-x-next` (private)
  - Release artifacts: `fotedev/masarx-releases` (public)
  See `AGENTS.md → Release distribution` for the full architecture.
- **Symptom:** Desktop shows "Update check failed" or website's "Download" link 404s, even though the release workflow published successfully. Check `gh repo view <repo> --json isPrivate` — if `true`, the release is private.

## 17. `electron-builder` default `artifactName` includes the version

- **Trigger:** You hardcode `/releases/latest/download/<bare-name>` in the website.
- **Why:** `electron-builder` defaults `artifactName` to `"${productName}-${version}-${arch}.${ext}"`. GitHub's `/releases/latest/download/<name>` endpoint is **literal** — no fuzzy matching, no strip-the-version. `.../Masar-X-Setup-x64.exe` 404s because the actual file is `Masar-X-Setup-0.5.8-x64.exe`.
- **Fix (two layered defenses in this project):**
  1. `electron-builder.yml` strips `${version}` from `artifactName` (top-level, `nsis`, `portable`). From v0.5.9+, file names are stable across versions.
  2. The website's `getLatestReleaseUrls()` in `apps/web/src/lib/github-releases.ts` queries the GitHub Releases API directly, falls back to parsing `latest.yml`. Caching: `next: { revalidate: 3600 }`.
- **Diagnostic:** `gh api repos/fotedev/masarx-releases/releases/latest --jq '.assets[].name'` — if names contain `-0.5.8-` but your URL doesn't, that's the gotcha.

## 18. `pnpm/action-setup@v4` cannot find `packageManager` when source is checked out into a subdirectory

- **Trigger:** A workflow checks out source into a non-root path (e.g. `source-code/`) and the build fails at `Setup pnpm` with `Error: No pnpm version is specified.`
- **Why:** `pnpm/action-setup@v4` looks for `packageManager` in the workflow runner's CWD (default: repo root). If source is in a subdir, the root `package.json` is not visible. The same pitfall affects `actions/setup-node@v4` with `cache: 'pnpm'` — cache key is derived from a hash of `pnpm-lock.yaml`, but if the lockfile is in a subdir, the lookup silently no-ops.
- **Fix:** Pin both versions explicitly in any such workflow:
  ```yaml
  - uses: pnpm/action-setup@v4
    with:
      version: 9.15.4          # read from root package.json BEFORE merging
  - uses: actions/setup-node@v4
    with:
      node-version: 24
      cache: 'pnpm'
      cache-dependency-path: source-code/pnpm-lock.yaml
  ```

## 19. `ThemeScript.tsx` must use native `<script>` + `suppressHydrationWarning`

- **Trigger:** You "modernize" `apps/web/src/components/ThemeScript.tsx` to use Next.js `<Script strategy="beforeInteractive">` from `next/script`.
- **Why:** W3C CSP `nonce-hiding` empties the `nonce` attribute of inline scripts in the DOM after the browser executes them (`https://www.w3.org/TR/CSP3/#security-nonces`). `next/script`'s hydration logic does NOT suppress this browser-level attribute change → React throws a hydration mismatch:
  ```
  + nonce="<real>"    (client / RSC payload)
  - nonce=""          (server / SSR HTML)
  ```
- **Fix:** Keep native `<script>` + `suppressHydrationWarning` + `nonce={nonce}` + `dangerouslySetInnerHTML`. The previous attempt at the `next/script` fix landed in `1d951d5..611a022` and was reverted in `d20247f` after the same hydration warning in dev.
- **Symptom:** Dev server prints `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties` with the diff showing `+ nonce="<hex>"` on client and `- nonce=""` on server under `src\components\ThemeScript.tsx`.

## 20. Never `git stash drop` / `git restore` / `git reset --hard` / `git checkout -- <file>` on uncommitted user changes without explicit consent

- **Trigger:** The working tree is dirty (uncommitted modifications or staged changes) and an automated cleanup step wants a clean state.
- **Why:** Discarding uncommitted edits is **CATASTROPHIC and DESTRUCTIVE**. The cost of recovery is the user re-deriving the change from scratch and re-applying it. This happened on 2026-09-04: the `ThemeScript.tsx` fix was stashed before a merge and the stash was dropped without confirmation, forcing the user to redo the same fix after the merge.
- **Banned without explicit, interactive user consent in the current turn:**
  - `git stash drop <stash>`
  - `git stash clear`
  - `git restore <file>` / `git restore --staged <file>` when there are uncommitted changes
  - `git reset --hard <ref>` when there are uncommitted changes
  - `git checkout -- <file>` / `git checkout <ref> -- <path>` when working tree is dirty
  - `git clean -fd` / `git clean -fdx` (any form)
- **Required pattern when the working tree is dirty and the task demands a clean state:** STOP, surface the dirty state, ask. User decides between (a) commit, (b) stash *keep*, (c) abandon, or (d) explicitly authorize the discard. Default is (a) or (b).
- **Why this is in `references/01-gotchas.md` and not just agent memory:** a new agent loads the repo's gotcha reference on first read; the rule is seen before the first `git stash drop` becomes a consideration.

---

## 21. `pnpm-workspace.yaml` `allowBuilds` is pnpm v11+ only — using it on pnpm 9 silently breaks installs

- **Trigger:** You add a dependency (`pnpm --filter web add <pkg>`), the lockfile updates correctly, but `node_modules/<pkg>/package.json` is never created. `pnpm` exits 0. The new dep fails `TS2307: Cannot find module '<pkg>'` despite being in the lockfile.
- **Why:** The project pins `pnpm@9.15.4` (root `package.json#packageManager`). pnpm 9 uses the legacy `onlyBuiltDependencies` ARRAY syntax in `pnpm-workspace.yaml`. The newer `allowBuilds` MAP syntax is pnpm v11+ only. When `allowBuilds` is present in a pnpm 9 workspace config, pnpm parses it silently, treats every entry as `false` (or fails to evaluate the map), and effectively disables postinstall approval for **every** native module in the workspace. On a workspace with `1916+` transitive packages (incl. `electron`, `better-sqlite3`, `sharp`, `@swc/core`, `@parcel/watcher`, `esbuild`, `unrs-resolver`), pnpm then hangs in postinstall resolution for 10+ minutes at ~1.5 GB constant RAM. The output appears to "complete" (exit 0) because the lockfile write succeeded, but the disk tree is half-written.
- **Fix:** Use `onlyBuiltDependencies: [...]` (array) in `pnpm-workspace.yaml` for `pnpm 9`. Current content (verified 2026-09-05):
  ```yaml
  onlyBuiltDependencies:
    - sharp
    - "@parcel/watcher"
    - "@swc/core"
    - esbuild
    - unrs-resolver
    - electron
    - better-sqlite3
  ```
- **When upgrading to pnpm v11+:** swap back to the `allowBuilds:` map. Verify the swap with `pnpm install --frozen-lockfile` (no add/remove) before merging — confirm that `electron`'s postinstall binary download completes and that `node_modules/electron/dist/electron.exe` exists.
- **Symptom / how to diagnose:**
  1. A fresh `pnpm add <pkg>` finishes with exit 0 in seconds but `ls node_modules/<pkg>` returns `No such file or directory`.
  2. `pnpm-lock.yaml` *does* contain the dep (`grep -A 2 '^      <pkg>:' pnpm-lock.yaml` shows `version: <x.y.z>`).
  3. The corresponding `tsc` build fails with `TS2307: Cannot find module '<pkg>'`.
  4. During the install, the `node.exe` process holds a constant ~1.5 GB RAM for 10+ minutes with no disk I/O on `node_modules/` (mtime frozen).
- **Why this was hard to spot:** the prior AGENTS.md described this config as "pnpm v11 syntax" and recommended keeping it — but the actual `packageManager` was never updated to v11. The disconnect survived multiple rounds because `pnpm install --frozen-lockfile` (which the CI uses) doesn't re-evaluate the workspace config the same way, so the breakage only shows up on additive installs (`pnpm add`).

---

## What's been retired (kept for archaeology only)

The following patterns were once issues but are now either fixed or no longer relevant. Listed here so you don't try to "re-fix" them:

- ~~`gemini-chat` Edge Function reference in `src/lib/ai-assistant.ts`~~ — replaced by Puter.js client-side; dead-link grep can be ignored if encountered.
- ~~`releases.yml` workflow~~ — renamed to `releases.yml.disabled` in commit `ab17ec0` (2026-08-25). Do NOT rename back unless rolling back the public-runner migration. See `AGENTS.md → Public Runner pipeline` for the active alternative.
