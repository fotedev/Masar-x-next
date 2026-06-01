# Masar-X Deep Architectural & Structural Audit Report
 
This document contains an exhaustive list of all discovered structural bugs, layout anomalies, security weaknesses, and performance bottlenecks in the Masar-X codebase (`Aboalayoun/Masar-x-next`, commit `afdcbeb`).
 
Stack verified on disk: **Next.js 16.2.1 (App Router) + React 19.2.4 + next-intl 4 + Supabase SSR + Drizzle ORM (pg Pool) + Tailwind 3 + Puter.js**. Package manager: **pnpm 9.15.9**.
 
Every finding below was reproduced against the actual source. Where a command was run, the exact result is quoted. Findings are ordered by severity.
 
---
 
## Technical Audit Findings
 
### Issue #1: Invalid `pnpm-workspace.yaml` Blocks Every pnpm Command (install/build/lint/typecheck)
* **Location:** `pnpm-workspace.yaml`
* **Severity:** Critical
 
#### <source_grounding>
```yaml
allowBuilds:
  '@parcel/watcher': false
  '@sentry/cli': false
  '@swc/core': false
  esbuild: false
  sharp: false
  unrs-resolver: false
```
Reproduction (pnpm 9.15.9):
```
$ pnpm --version
 ERROR  packages field missing or empty
```
Renaming the file away makes the exact same command succeed (`9.15.9`). Adding `packages:\n  - .` also fixes it.
#### </source_grounding>
 
#### <architectural_reasoning>
When a `pnpm-workspace.yaml` file is present, pnpm treats the directory as a workspace root and **requires a non-empty `packages:` field**. This file has no `packages:` key at all. As a result *every* pnpm invocation — `install`, `build`, `lint`, `typecheck` — aborts before doing anything. Additionally, `allowBuilds` is **not a valid pnpm key**; the correct keys for controlling post-install build scripts are `onlyBuiltDependencies` / `neverBuiltDependencies` (pnpm 9) or the `pnpm.onlyBuiltDependencies` block. This means CI and any fresh `git clone && pnpm install` are completely broken on pnpm 9.x. The repo only installs today because a contributor happens to run a pnpm version (or cached store) that tolerates the malformed file.
#### </architectural_reasoning>
 
#### <granular_execution_steps>
1. Open the file `pnpm-workspace.yaml`.
2. Delete the entire key `allowBuilds:` and all 6 indented lines under it.
3. Replace the whole file content with the block in `<production_ready_code>`.
4. Save the file.
5. Run `pnpm install` from the repo root and confirm it completes with exit code 0.
#### </granular_execution_steps>
 
#### <production_ready_code>
```yaml
# This project is a single package, NOT a monorepo.
# `onlyBuiltDependencies` is the valid pnpm 9 key for controlling post-install
# build scripts (replaces the invalid `allowBuilds` key).
packages:
  - .
 
onlyBuiltDependencies:
  - sharp
```
> If the project is genuinely NOT a workspace, the cleanest fix is to **delete `pnpm-workspace.yaml` entirely** and move the build-script allow-list into `package.json` under a top-level `"pnpm": { "onlyBuiltDependencies": ["sharp"] }` block.
#### </production_ready_code>
 
---
 
### Issue #2: `pnpm lint` Fails CI — `--max-warnings=0` With 64 Warnings
* **Location:** `package.json` (`scripts.lint`), `eslint.config.mjs`
* **Severity:** Critical
 
#### <source_grounding>
```json
"lint": "eslint . --max-warnings=0",
```
```js
// eslint.config.mjs
"@typescript-eslint/no-explicit-any": "warn",
"@typescript-eslint/no-unused-vars": "warn",
"react-hooks/exhaustive-deps": "warn",
"no-console": "warn",
```
Reproduction (after fixing Issue #1):
```
✖ 64 problems (0 errors, 64 warnings)
ESLint found too many warnings (maximum: 0).
 ELIFECYCLE  Command failed with exit code 1.
```
#### </architectural_reasoning>
Every meaningful rule is configured as `"warn"`, but the lint script enforces `--max-warnings=0`, so **a single warning fails the command**. There are 64 of them: ~30 `no-console` (in `src/lib/ai-assistant.ts`, `src/lib/puter.ts`, `src/i18n/request.ts`, etc.), multiple `no-explicit-any`, several `no-unused-vars`, and two `react-hooks/exhaustive-deps`. The result is that the project's own lint gate is red on `main`. This is self-contradictory configuration: either the rules should be `"error"` (and the code fixed) or `--max-warnings` should be lifted. Today it just guarantees CI failure.
#### </architectural_reasoning>
 
#### <granular_execution_steps>
1. Decide the policy: treat warnings as blocking (recommended) and fix the code, OR relax the gate.
2. To unblock immediately while still surfacing issues, open `package.json`.
3. Locate the line `"lint": "eslint . --max-warnings=0",`.
4. Replace it with the line in `<production_ready_code>`.
5. Separately, fix the underlying warnings (see Issues #8, #14, #21) so the count trends to zero, then re-tighten `--max-warnings=0`.
6. Run `pnpm lint` and confirm exit code 0.
#### </granular_execution_steps>
 
#### <production_ready_code>
```json
"lint": "eslint . --max-warnings=25",
"lint:strict": "eslint . --max-warnings=0"
```
> Use `lint` locally and `lint:strict` in CI after the backlog of 64 warnings is burned down. Do not silence rules globally; fix the call sites.
#### </production_ready_code>
 
---
 
### Issue #3: Duplicate Request Interceptor — Dead `proxy.ts` Shadows the Real `src/middleware.ts` Security Layer
* **Location:** `proxy.ts` (repo root) vs `src/middleware.ts`
* **Severity:** Critical
 
#### <source_grounding>
Two near-identical request interceptors exist with **divergent matchers and divergent security behavior**.
 
`src/middleware.ts` (in `src/`, so it is the active file; sets CSP + nonce + security headers):
```ts
export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
```
`proxy.ts` (repo root, NOT in `src/`; no CSP, no nonce, only `console.debug`):
```ts
export async function proxy(request: NextRequest) { ... }
export const config = {
  matcher: [ "/((?!monitoring|_next/static|_next/image|favicon.ico|manifest.json|robots.txt|sitemap.xml|llms.txt|googlec58e80c40bab6a9f.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)" ],
};
```
#### </source_grounding>
 
#### <architectural_reasoning>
Next.js 16 **renamed the `middleware` convention to `proxy`** (see `nextjs.org/docs/messages/middleware-to-proxy`); `middleware.ts` is deprecated but still functional during the transition. Because this project uses a `src/` directory, Next resolves the interceptor from `src/` — so **`src/middleware.ts` is active and the root `proxy.ts` is dead code**. That is dangerous for three reasons:
1. **False sense of correctness.** `proxy.ts` looks authoritative (it owns the "new" filename) but never runs, so edits to it are silently ignored.
2. **Security divergence.** The dead `proxy.ts` does *not* emit the CSP/nonce or `X-Frame-Options` headers. If anyone "migrates" by deleting `src/middleware.ts` (per the Next 16 deprecation) the app instantly loses its entire CSP/nonce layer and TRW/admin route protection regressions appear.
3. **Drift.** The two files already disagree on the matcher (e.g. `proxy.ts` excludes `manifest.json`, `monitoring`, image extensions; `middleware.ts` excludes only `api`/`_next`/`_vercel`/dotted paths), so behavior depends entirely on which file Next picks.
#### </architectural_reasoning>
 
#### <granular_execution_steps>
1. Choose `src/middleware.ts` as the single source of truth (it has the CSP/nonce logic).
2. Delete the file `proxy.ts` at the repo root.
3. Verify no import references it: run `grep -rn "proxy" --include=*.ts src` and confirm nothing imports `../proxy`.
4. Confirm the matcher in `src/middleware.ts` excludes static assets and the PWA manifest so they are not rewritten; if `manifest.json`/`robots.txt` must bypass the interceptor, add them to the negative lookahead.
5. Run `pnpm build` and confirm there is no "found both middleware and proxy" warning.
#### </granular_execution_steps>
 
#### <production_ready_code>
```ts
// src/middleware.ts — keep ONLY this file. Delete root proxy.ts.
// Broaden the matcher so static + PWA assets bypass the interceptor:
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.json|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
```
> When you later adopt the Next 16 `proxy` convention, *rename* `src/middleware.ts` → `src/proxy.ts` and `export default function proxy(...)`. Never keep both.
#### </production_ready_code>
 
---
 
### Issue #4: Database Schema & RLS Are Not in Version Control — Empty Migrations + Triple-Nested `supabase/` Directory
* **Location:** `supabase/schema_dump.sql`, `supabase/supabase/supabase/migrations/*.sql`, `supabase/.../.temp/`
* **Severity:** Critical
 
#### <source_grounding>
```
$ wc -l supabase/schema_dump.sql
0 supabase/schema_dump.sql
 
$ cat supabase/supabase/supabase/migrations/20260112055817_create_profiles_table.sql   # 0 bytes
$ cat supabase/supabase/migrations/20260112053338_fix_summaries_subject_index.sql        # 0 bytes
 
$ find supabase -type d -name migrations
supabase/supabase/supabase/migrations
supabase/supabase/migrations
```
The Supabase CLI working tree was committed nested **four levels deep**: `supabase/supabase/supabase/supabase/.temp/...`.
#### </source_grounding>
 
#### <architectural_reasoning>
The Supabase CLI expects migrations at **`supabase/migrations/`** relative to the project root. Here the migrations live at `supabase/supabase/supabase/migrations/` (and a second copy one level up), so `supabase db push` / `supabase migration up` will find **nothing** at the canonical path. Worse, both migration files and `schema_dump.sql` are **0 bytes** — the entire schema, including **all Row Level Security policies**, exists only in the live Supabase project and is *not reproducible from source*. This is the root cause that makes Issues #5 and #7 unverifiable from the repo: there is no committed RLS to confirm whether `system_access_codes`, `profiles`, or `admins` are safely scoped. A new environment cannot be stood up, and a destructive change to the live DB cannot be rolled back from VCS.
#### </architectural_reasoning>
 
#### <granular_execution_steps>
1. From a trusted machine with DB access, regenerate the schema: `supabase db dump --schema public --file supabase/schema_dump.sql` (and a second dump including policies/roles).
2. Move the real migration files from `supabase/supabase/supabase/migrations/` to `supabase/migrations/`.
3. Delete the nested directories `supabase/supabase/` entirely.
4. Populate the two empty migration files with their real DDL (or squash into a single baseline migration via `supabase db diff`).
5. Commit `supabase/migrations/*.sql` and `supabase/schema_dump.sql` with real content.
6. Verify the gitignore actually matches the canonical path (see Issue #10).
#### </granular_execution_steps>
 
#### <production_ready_code>
```bash
# Canonical layout the Supabase CLI expects:
supabase/
  config.toml
  migrations/
    20260112053338_fix_summaries_subject_index.sql   # real DDL, not 0 bytes
    20260112055817_create_profiles_table.sql          # real DDL incl. RLS
  schema_dump.sql                                      # full public schema dump
 
# Regenerate from the live project:
supabase db dump --linked --schema public > supabase/schema_dump.sql
```
#### </production_ready_code>
 
---
 
### Issue #5: `getAdminDb()` (Service-Role pg Pool, RLS-Bypassing) Runs on EVERY Authenticated Page Load
* **Location:** `src/app/[locale]/layout.tsx` (`getProfile`), `src/lib/admin-db/db.ts`
* **Severity:** High
 
#### <source_grounding>
```ts
// src/app/[locale]/layout.tsx
const getProfile = cache(async (userId: string) => {
  const adminDb = getAdminDb();
  const [profile] = await adminDb.select().from(profiles)
    .where(eq(profiles.id, userId)).limit(1);
  return profile || null;
});
// ...
if (user) { profile = await getProfile(user.id); ... }
```
```ts
// src/lib/admin-db/db.ts
pool = new Pool({ host, port, user, password, database,
  ssl: { rejectUnauthorized: false },
  max: 3, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
```
#### </source_grounding>
 
#### <architectural_reasoning>
The locale layout wraps **every page**, so each authenticated request opens/uses a **direct Postgres connection via a privileged service pool that bypasses RLS** just to read the user's own profile. Two problems:
1. **Connection exhaustion.** On serverless (Vercel) each lambda instance keeps its own pool of `max: 3`. Under modest concurrency the number of live Postgres connections = `3 × active_instances`, which quickly exceeds Supabase's pooler limits, producing `remaining connection slots are reserved` / timeout errors. A raw `pg.Pool` is an anti-pattern in serverless; the Supabase client over PgBouncer (transaction mode) or a single shared connection is required.
2. **RLS bypass by default.** Reading profiles through the admin pool means RLS never applies. The only thing scoping the query to the current user is the application-level `eq(profiles.id, userId)`. A future query that forgets that predicate leaks every profile. The user's own profile should be read through the **RLS-enforced anon client** (`createClient()` from `src/lib/supabase/server.ts`), reserving `getAdminDb()` for genuine admin/cron paths.
3. `ssl: { rejectUnauthorized: false }` disables certificate validation, exposing the DB connection to MITM.
#### </architectural_reasoning>
 
#### <granular_execution_steps>
1. Open `src/app/[locale]/layout.tsx`.
2. Remove the `getAdminDb()`-based `getProfile` and the imports `getAdminDb`, `profiles`, `eq`.
3. Read the profile through the RLS-scoped Supabase server client instead (code below).
4. In `src/lib/admin-db/db.ts`, set `max: 1` for serverless and enable real TLS verification with the Supabase CA, or route admin reads through PgBouncer transaction mode.
5. Audit all `getAdminDb()` call sites (`grep -rn getAdminDb src`) and confirm each is an admin-only or server-action path, never per-request page rendering.
#### </granular_execution_steps>
 
#### <production_ready_code>
```ts
// src/app/[locale]/layout.tsx — read the caller's OWN profile via RLS, not the admin pool.
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
 
const getProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return data ?? null;
});
```
#### </production_ready_code>
 
---
 
### Issue #6: Two Supabase Browser Singletons → "Multiple GoTrueClient Instances" Auth Race
* **Location:** `src/lib/supabase.ts` and `src/lib/supabase/client.ts`
* **Severity:** High
 
#### <source_grounding>
```ts
// src/lib/supabase.ts  (eager singleton, imported by AuthContext)
export const supabase = createBrowserClient(supabaseUrl!, supabaseAnonKey!);
```
```ts
// src/lib/supabase/client.ts  (factory, imported elsewhere)
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```
#### </source_grounding>
 
#### <architectural_reasoning>
Two independent `createBrowserClient` factories run in the same browser tab. `@supabase/ssr` shares auth state through a single `GoTrueClient` keyed on storage; instantiating more than one logs **"Multiple GoTrueClient instances detected in the same browser context"** and causes token-refresh races, where one client overwrites the session another just refreshed. Symptoms are intermittent forced logouts and stale sessions. There must be exactly one browser client (memoized module singleton) and every consumer must import it.
#### </architectural_reasoning>
 
#### <granular_execution_steps>
1. Pick `src/lib/supabase/client.ts` as canonical; memoize the instance so repeated `createClient()` calls return the same object.
2. Re-export the singleton from `src/lib/supabase.ts` so existing `import { supabase } from "@/lib/supabase"` keeps working.
3. Run `grep -rn "createBrowserClient" src` and confirm it now appears in exactly one file.
4. Verify the console no longer prints the "Multiple GoTrueClient instances" warning after login.
#### </granular_execution_steps>
 
#### <production_ready_code>
```ts
// src/lib/supabase/client.ts — single memoized browser client
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
 
let browserClient: SupabaseClient | undefined;
 
export function createClient(): SupabaseClient {
  if (browserClient) return browserClient;
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return browserClient;
}
 
// src/lib/supabase.ts — re-export, do NOT create a second client
export { createClient } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/client";
export const supabase = createClient();
```
#### </production_ready_code>
 
---
 
### Issue #7: "Matrix" Secret-Access Gate Enforced Client-Side Against an Anon-Readable/Writable Table
* **Location:** `src/components/Header.tsx` (`verifyAccessKey`), `src/components/header/SecretAccessGate.tsx`
* **Severity:** High
 
#### <source_grounding>
```ts
// src/components/Header.tsx
const { data, error } = await supabase
  .from("system_access_codes")
  .select("*")
  .eq("access_key", accessKey.trim())
  .gt("expires_at", now)
  .single();
 
if (data && !error) {
  if (data.used_count >= data.max_uses) { /* client-side check */ }
  await supabase.from("system_access_codes")
    .update({ used_count: data.used_count + 1 })
    .eq("id", data.id);
  enterMatrix();
}
```
#### </source_grounding>
 
#### <architectural_reasoning>
The entire gate runs in the browser with the **anon key**:
1. **Key enumeration / disclosure.** `select("*")` on `system_access_codes` means if RLS permits anon `SELECT` (cannot be verified — see Issue #4), an attacker can drop the `.eq(...)` filter in the console and read **every access key, expiry, and usage counter**. Even with a filter, the table is reachable from the client.
2. **Bypassable usage limits.** The `used_count >= max_uses` check and the increment are done client-side; an attacker simply skips the `UPDATE` (or replays the read) to use a code unlimited times. `enterMatrix()` is gated by client state, not the server.
3. **No server authority.** There is no Edge Function / server action that atomically validates-and-decrements under RLS, so the "secret access" is cosmetic.
#### </architectural_reasoning>
 
#### <granular_execution_steps>
1. Create a Supabase RPC (`SECURITY DEFINER`) `redeem_access_code(p_key text)` that atomically checks expiry + `used_count < max_uses`, increments `used_count`, and returns a boolean — all server-side.
2. Add RLS to `system_access_codes` denying all direct `SELECT`/`UPDATE` to `anon`/`authenticated`; only the RPC may touch it.
3. In `Header.tsx`, replace the `.from("system_access_codes")` select+update with a single `supabase.rpc("redeem_access_code", { p_key })` call.
4. Gate `enterMatrix()` on the RPC's boolean result only.
5. Verify in the browser console that `supabase.from("system_access_codes").select("*")` returns `0` rows / permission denied.
#### </granular_execution_steps>
 
#### <production_ready_code>
```sql
-- migration: server-authoritative redemption
create or replace function public.redeem_access_code(p_key text)
returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  update system_access_codes
     set used_count = used_count + 1
   where access_key = p_key
     and expires_at > now()
     and used_count < max_uses
  returning true into ok;
  return coalesce(ok, false);
end; $$;
 
revoke all on table public.system_access_codes from anon, authenticated;
grant execute on function public.redeem_access_code(text) to authenticated;
```
```ts
// Header.tsx
const { data: granted } = await supabase.rpc("redeem_access_code", { p_key: accessKey.trim() });
if (granted) { setAttempts(0); setLockoutUntil(null); enterMatrix(); }
else { /* increment attempts / lockout */ }
```
#### </production_ready_code>
 
---
 
### Issue #8: Global Error & `console.warn` Suppression With Permanent, Un-Cleaned Listeners
* **Location:** `src/lib/puter.ts` (~lines 230–272)
* **Severity:** High
 
#### <source_grounding>
```ts
// monkeypatch — never restored
console.warn = function (...args) { /* swallow matching warnings for 15s */ };
 
window.addEventListener('error', (event) => {
  if (errorPatterns.some((p) => p.test(event.message.toLowerCase()))) event.preventDefault();
}, true);
 
window.addEventListener('unhandledrejection', (event) => {
  if (errorPatterns.some((p) => p.test(String(event.reason || '').toLowerCase()))) event.preventDefault();
}, true);
```
#### </source_grounding>
 
#### <architectural_reasoning>
This installs **process-wide** capturing listeners on `error` and `unhandledrejection` and overwrites `console.warn`, with **no removal path**. Consequences:
1. **Monitoring blindness.** `event.preventDefault()` on matching global errors hides real failures from Sentry/analytics and from the React error overlay. The pattern list is broad enough to swallow unrelated errors.
2. **Listener accumulation / leak.** If the initializer runs more than once (HMR, repeated import, client navigation re-eval) listeners stack up; each `addEventListener(..., true)` is never removed.
3. **Global `console.warn` mutation** affects the whole app and any third-party library, and is itself flagged by `no-console` (contributing to Issue #2).
This is a structural smell: silencing transport noise from Puter should be scoped to the Puter call site, not the global window.
#### </architectural_reasoning>
 
#### <granular_execution_steps>
1. Open `src/lib/puter.ts`.
2. Wrap the initializer in an idempotency guard so it installs at most once (`if ((window as any).__puterGuard) return; (window as any).__puterGuard = true;`).
3. Return a cleanup function that calls `window.removeEventListener('error', handler, true)`, `removeEventListener('unhandledrejection', handler, true)`, and restores `console.warn = originalConsoleWarn`.
4. Narrow `errorPatterns` to only Puter/WebSocket transport strings so unrelated errors are never swallowed.
5. Do not `preventDefault()` — instead just stop *logging* the noisy ones; let monitoring still receive them.
#### </granular_execution_steps>
 
#### <production_ready_code>
```ts
let installed = false;
export function installPuterNoiseFilter(): () => void {
  if (typeof window === "undefined" || installed) return () => {};
  installed = true;
  const onError = (e: ErrorEvent) => {
    if (PUTER_TRANSPORT_PATTERNS.some((p) => p.test(e.message.toLowerCase()))) {
      e.stopImmediatePropagation(); // hush console, but DO NOT preventDefault monitoring
    }
  };
  window.addEventListener("error", onError, true);
  return () => {
    window.removeEventListener("error", onError, true);
    installed = false;
  };
}
```
#### </production_ready_code>
 
---
 
### Issue #9: Theme Initialized With `strategy="afterInteractive"` → Flash of Wrong Theme (FOUC) + Double Source of Truth
* **Location:** `src/components/ThemeScript.tsx`, `src/contexts/ThemeContext.tsx`
* **Severity:** High
 
#### <source_grounding>
```tsx
// ThemeScript.tsx — runs AFTER hydration
<Script id="theme-initializer" strategy="afterInteractive" nonce={nonce}
  dangerouslySetInnerHTML={{ __html: `(function(){ ... document.documentElement.classList.toggle('dark', theme === 'dark'); ... })();` }} />
```
```tsx
// ThemeContext.tsx — a SECOND theme manager in React state
const [theme, setTheme] = useState<Theme>("light");
useEffect(() => { const saved = localStorage.getItem("theme") ... }, []);
```
#### </source_grounding>
 
#### <architectural_reasoning>
A theme bootstrap script must run **before first paint** to avoid a flash. `strategy="afterInteractive"` defers the script until after hydration, so the page paints with the default (light) theme and then snaps to dark — a visible **Flash Of Incorrect Theme** and a layout/color shift. On top of that, theme is managed in **two places**: the inline script *and* `ThemeContext` (which initializes `useState("light")` then reconciles in `useEffect`). They can disagree on first render, and `ThemeContext`'s `useState("light")` guarantees the React tree renders light-first regardless of the script. The correct pattern is a single **blocking** inline script in `<head>` (raw `<script>` with nonce, no `next/script`), with `ThemeContext` reading the already-applied class instead of re-deciding.
#### </architectural_reasoning>
 
#### <granular_execution_steps>
1. In `ThemeScript.tsx`, change the `theme-initializer` from `next/script` with `strategy="afterInteractive"` to a raw `<script nonce={nonce} dangerouslySetInnerHTML=...>` so it executes synchronously in `<head>` before paint. (Keep the JSON-LD as `next/script`.)
2. In `ThemeContext.tsx`, initialize state by reading the class the script already set: `useState<Theme>(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light")`.
3. Remove the redundant "decide theme" logic from `ThemeContext`'s first `useEffect`; keep only persistence + toggling.
4. Confirm there is no dark→light flash on hard refresh in dark mode.
#### </granular_execution_steps>
 
#### <production_ready_code>
```tsx
// ThemeScript.tsx — blocking, pre-paint theme application
<script
  nonce={nonce}
  dangerouslySetInnerHTML={{ __html:
    `(function(){try{var t=localStorage.getItem('theme');` +
    `if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';` +
    `document.documentElement.classList.toggle('dark',t==='dark');` +
    `document.documentElement.style.colorScheme=t;}catch(e){}})();` }}
/>
```
```tsx
// ThemeContext.tsx
const [theme, setTheme] = useState<Theme>(() =>
  typeof document !== "undefined" &&
  document.documentElement.classList.contains("dark") ? "dark" : "light");
```
#### </production_ready_code>
 
---
 
### Issue #10: Committed Supabase CLI `.temp/` Leaks Project Ref & Pooler Connection String
* **Location:** `supabase/supabase/supabase/supabase/.temp/project-ref`, `.../.temp/pooler-url`
* **Severity:** High
 
#### <source_grounding>
```
$ cat supabase/.../.temp/project-ref
jcufigozkhxazjbwhjjm
$ cat supabase/.../.temp/pooler-url
postgresql://postgres.jcufigozkhxazjbwhjjm@aws-1-eu-central-1.pooler.supabase.com:5432/postgres
```
`.gitignore` *does* contain `supabase/.temp/` (line 67) — but the files were committed at `supabase/supabase/supabase/supabase/.temp/`, which that rule does not match.
#### </source_grounding>
 
#### <architectural_reasoning>
The Supabase CLI's internal `.temp` working files were committed because the **directory-nesting bug (Issue #4)** pushed them below the depth the `.gitignore` rule targets. These expose the project ref, the pooler host/region, and the DB username (`postgres.<ref>`). While the password is absent and the project ref also appears in `next.config.mjs`, publishing the exact pooler URI and username narrows an attacker's brute-force surface and confirms infra topology. CLI scratch files must never be tracked.
#### </architectural_reasoning>
 
#### <granular_execution_steps>
1. Run `git rm -r --cached supabase/supabase` to untrack the entire nested tree.
2. Delete the directories on disk after extracting any real migration DDL (see Issue #4).
3. Replace the `.gitignore` `supabase` rules with depth-agnostic globs (below).
4. Run `git status` and confirm no `.temp` file is staged.
5. Rotate the database password as a precaution since the topology is now public.
#### </granular_execution_steps>
 
#### <production_ready_code>
```gitignore
# .gitignore — match Supabase CLI scratch at ANY depth
**/.temp/
**/.branches/
supabase/.temp/
```
#### </production_ready_code>
 
---
 
### Issue #11: In-Memory Rate Limiter Is Ineffective on Serverless AND Double-Counts Requests
* **Location:** `src/lib/rate-limit.ts`, `src/app/api/ai/chat/route.ts`
* **Severity:** High
 
#### <source_grounding>
```ts
// rate-limit.ts
const rateLimitStore = new Map<string, RateLimitEntry>();   // per-instance, volatile
// ...checkRateLimit(): "Allow request and increment counter"
entry.count += 1;                                           // increment #1
```
```ts
// route.ts
const rateLimitResult = checkAIChatRateLimit(user.id);      // already increments
if (!rateLimitResult.allowed) { ...429... }
// ...
recordAIChatRequest(user.id);                               // increment #2
```
#### </source_grounding>
 
#### <architectural_reasoning>
1. **Ineffective limiter.** The store is a module-level `Map`. On Vercel each lambda instance has its own memory and cold starts wipe it, so the "10 req/min" limit is per-instance and trivially bypassed by hitting multiple instances. The code's own comment admits "In production, this should use Redis/Vercel KV."
2. **Double counting.** `checkAIChatRateLimit` (→ `checkRateLimit`) *already increments* `entry.count` on the allow path, and then the route separately calls `recordAIChatRequest` which increments again. Each successful request consumes **two** tokens, so the real limit is ~5 req/min, not 10 — an off-by-2x correctness bug.
#### </architectural_reasoning>
 
#### <granular_execution_steps>
1. Decide on a shared store (Vercel KV / Upstash Redis) for real enforcement; keep the Map only as a dev fallback.
2. Make `checkRateLimit` a **pure read** (no increment) and have exactly one explicit `recordAIChatRequest` mutate state — or merge both into a single atomic `consume()` call.
3. In `route.ts`, call the limiter once (`const r = await consumeAIChatToken(user.id)`); remove the separate `recordAIChatRequest`.
4. Add a test asserting the 11th request within 60s returns 429.
#### </granular_execution_steps>
 
#### <production_ready_code>
```ts
// rate-limit.ts — single atomic op, no double counting
export function consumeAIChatToken(userId: string): RateLimitResult {
  const cfg = AI_CHAT_RATE_LIMIT, key = cfg.keyPrefix + userId, now = Date.now();
  const e = rateLimitStore.get(key);
  if (!e || now - e.windowStart >= cfg.windowMs) {
    rateLimitStore.set(key, { count: 1, windowStart: now, userId });
    return { allowed: true, remaining: cfg.maxRequests - 1, resetTime: now + cfg.windowMs };
  }
  if (e.count >= cfg.maxRequests) {
    const retryAfter = Math.ceil((e.windowStart + cfg.windowMs - now) / 1000);
    return { allowed: false, remaining: 0, resetTime: e.windowStart + cfg.windowMs, retryAfter };
  }
  e.count += 1;
  return { allowed: true, remaining: cfg.maxRequests - e.count, resetTime: e.windowStart + cfg.windowMs };
}
```
```ts
// route.ts
const rl = consumeAIChatToken(user.id);
if (!rl.allowed) return NextResponse.json({ error: "Too Many Requests", retryAfter: rl.retryAfter },
  { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
// (delete the old recordAIChatRequest call)
```
#### </production_ready_code>
 
---
 
### Issue #12: Dead / Duplicate Home Routes Pollute the Route Tree & SEO
* **Location:** `src/app/[locale]/home_ar/`, `src/app/[locale]/home-ar-temp/`, `src/app/[locale]/%D8%A7%D9%84%D8%B1%D8%A6%D9%8A%D8%B3%D9%8A%D8%A9/`, `src/app/[locale]/test-route/`, `src/app/home/`
* **Severity:** Medium
 
#### <source_grounding>
Three byte-identical pages plus a test page, all alongside the real `src/app/[locale]/page.tsx`:
```tsx
// home_ar/page.tsx == home-ar-temp/page.tsx == %D8%A7%D9%84%D8%B1%D8%A6%D9%8A%D8%B3%D9%8A%D8%A9/page.tsx
import HomeClient from "@/components/HomeClient";
export default function ArabicHomePage() { return <HomeClient />; }
```
```tsx
// test-route/page.tsx
export default function TestPage() { return <div>Test Route Works</div>; }
```
#### </source_grounding>
 
#### <architectural_reasoning>
These render the same `HomeClient` (or debug markup) at four extra URLs per locale (`/ar/home_ar`, `/ar/home-ar-temp`, `/ar/الرئيسية`, `/ar/test-route`, …). Effects:
- **Duplicate content / SEO dilution.** Multiple crawlable URLs serve the same home page with no `canonical`, splitting ranking signals.
- **The URL-encoded Arabic segment** (`%D8%A7%D9%84%D8%B1%D8%A6%D9%8A%D8%B3%D9%8A%D8%A9` = "الرئيسية") is a literal directory name; it produces a brittle, double-encoded path and conflicts with next-intl's locale-prefix routing model.
- **`test-route` ships a debug page to production.** Dead routes also enlarge the build and the static-params surface.
#### </architectural_reasoning>
 
#### <granular_execution_steps>
1. Delete the directories `src/app/[locale]/home_ar/`, `src/app/[locale]/home-ar-temp/`, `src/app/[locale]/test-route/`, and `src/app/[locale]/%D8%A7%D9%84%D8%B1%D8%A6%D9%8A%D8%B3%D9%8A%D8%A9/`.
2. Keep only `src/app/[locale]/page.tsx` as the canonical home page.
3. If `/الرئيسية` must remain a public alias, implement it as a `redirects()` entry in `next.config.mjs` pointing at `/`, not as a duplicate page.
4. Confirm `src/app/home/page.tsx` (a redirect to `/`) is still desired; if the `/home → /` redirect already exists in `next.config.mjs` (it does), delete this page too to avoid two redirect mechanisms.
5. Run `pnpm build` and confirm the removed routes no longer appear in the route manifest.
#### </granular_execution_steps>
 
#### <production_ready_code>
```js
// next.config.mjs — alias via redirect instead of duplicate pages
async redirects() {
  return [
    { source: "/home", destination: "/", permanent: true },
    { source: "/admin", destination: "/admin-dashboard", permanent: true },
    { source: "/:locale/الرئيسية", destination: "/:locale", permanent: true },
  ];
}
```
#### </production_ready_code>
 
---
 
### Issue #13: Root `app/layout.tsx` `generateMetadata` Reads a `params.locale` That Does Not Exist at That Level
* **Location:** `src/app/layout.tsx`
* **Severity:** Medium
 
#### <source_grounding>
```tsx
// src/app/layout.tsx  (ROOT layout — sits ABOVE the [locale] segment)
export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;     // params has NO `locale` here
  const locale = rawLocale as Locale;             // -> undefined
  const t = await getTranslations({ locale, namespace: "metadata" });
  ...
}
```
#### </source_grounding>
 
#### <architectural_reasoning>
In the App Router, a layout only receives the dynamic params **at or below its own position**. `src/app/layout.tsx` is the *root* layout and sits *above* the `[locale]` segment, so its `params` object does **not** contain `locale`. `rawLocale` is therefore `undefined`, and `getTranslations({ locale: undefined })` falls back to next-intl's implicit request locale by luck rather than design — and will silently mis-title pages if that fallback ever changes. The metadata generation should either live in `src/app/[locale]/layout.tsx` (where `locale` is a real param) or resolve the locale via `getLocale()` like the rest of this file already does for `dir`.
#### </architectural_reasoning>
 
#### <granular_execution_steps>
1. Open `src/app/layout.tsx`.
2. In `generateMetadata`, stop destructuring `params`; resolve the locale with `getLocale()` (already imported in this file).
3. Pass that resolved locale to `getTranslations`.
4. Alternatively, move `generateMetadata` into `src/app/[locale]/layout.tsx` where `params.locale` is valid, and delete it from the root.
5. Build and confirm `<title>`/`<meta description>` render the correct language for `/ar` and `/en`.
#### </granular_execution_steps>
 
#### <production_ready_code>
```tsx
// src/app/layout.tsx
import { getLocale, getTranslations } from "next-intl/server";
 
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();                 // real request locale
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    title: { default: t("title"), template: `%s | ${t("siteName")}` },
    description: t("description"),
    keywords: t("keywords"),
    openGraph: { title: t("title"), description: t("description"), siteName: t("siteName") },
    twitter: { title: t("title"), description: t("description") },
  };
}
```
#### </production_ready_code>
 
---
 
### Issue #14: Vite Leftovers After Next.js Migration (Dead Deps, Configs, and Tailwind `content`)
* **Location:** `package.json`, `tailwind.config.js`, `tsconfig.json`, `src/vite-env.d.ts`, `src/instrumentation-client.ts`
* **Severity:** Medium
 
#### <source_grounding>
```json
// package.json devDependencies (all unused in a Next app):
"@vitejs/plugin-react": "^4.3.1", "vite": "^5.4.2",
"vite-plugin-compression": "^0.5.1", "vite-plugin-pwa": "^1.2.0",
```
```js
// tailwind.config.js — scans a file that does not exist
content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
```
```jsonc
// tsconfig.json — Vite-era flags
"useDefineForClassFields": true, "allowImportingTsExtensions": true, "moduleResolution": "bundler",
```
`src/vite-env.d.ts` is present; root `index.html` does **not** exist.
#### </source_grounding>
 
#### <architectural_reasoning>
The project was migrated from Vite to Next.js but the Vite toolchain was never removed. `vite`, `@vitejs/plugin-react`, `vite-plugin-pwa`, and `vite-plugin-compression` are dead weight that bloat `pnpm install`, slow CI, and confuse contributors about the build system (the real build is `next build --webpack`). `tailwind.config.js` lists `./index.html` in `content`, but no such file exists, so the glob is a no-op (and a misleading signal). The `tsconfig.json` carries Vite/bundler-era options (`allowImportingTsExtensions`, `useDefineForClassFields`) that are not what `next dev`/`next build` rely on. None of this breaks the build today, but it is structural debt that invites mistakes.
#### </architectural_reasoning>
 
#### <granular_execution_steps>
1. Remove `vite`, `@vitejs/plugin-react`, `vite-plugin-compression`, `vite-plugin-pwa` from `devDependencies` in `package.json`; run `pnpm install`.
2. Delete `src/vite-env.d.ts`.
3. In `tailwind.config.js`, drop `'./index.html'` from `content`; keep only `'./src/**/*.{js,ts,jsx,tsx}'` (add `'./public/**/*.html'` only if you actually template HTML).
4. Align `tsconfig.json` with Next defaults (remove `allowImportingTsExtensions`; ensure `"jsx": "preserve"`, `"moduleResolution": "bundler"` is fine, but let Next manage it).
5. Run `pnpm typecheck` + `pnpm build` to confirm nothing depended on the removed pieces.
#### </granular_execution_steps>
 
#### <production_ready_code>
```js
// tailwind.config.js
content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
```
```json
// package.json devDependencies — delete these lines:
// "@vitejs/plugin-react", "vite", "vite-plugin-compression", "vite-plugin-pwa"
```
#### </production_ready_code>
 
---
 
### Issue #15: Two ESLint Config Systems Coexist (`.eslintrc.json` + `eslint.config.mjs`)
* **Location:** `.eslintrc.json`, `eslint.config.mjs`
* **Severity:** Medium
 
#### <source_grounding>
Both files exist and define overlapping rules. The flat config also accesses shared presets through optional chaining:
```js
...(reactHooksPlugin.configs?.recommended?.rules ?? {}),
...(tseslint.configs?.recommended?.rules ?? {}),
```
#### </source_grounding>
 
#### <architectural_reasoning>
ESLint 9 (used here) defaults to **flat config** (`eslint.config.mjs`); the legacy `.eslintrc.json` is ignored unless `ESLINT_USE_FLAT_CONFIG=false`. Keeping both means contributors edit the wrong file and see no effect. Separately, `tseslint.configs.recommended` is an **array** of config objects in `typescript-eslint` v8 — accessing `.rules` on it yields `undefined`, so `?? {}` silently spreads **nothing**, meaning the TypeScript "recommended" rule set may not actually be applied. The lint surface is therefore both duplicated and weaker than it appears.
#### </architectural_reasoning>
 
#### <granular_execution_steps>
1. Delete `.eslintrc.json` (flat config is authoritative under ESLint 9).
2. In `eslint.config.mjs`, spread the recommended presets correctly using `tseslint.config(...)` or by spreading the array, not `.configs.recommended.rules`.
3. Run `pnpm lint` and confirm the rule count/behavior matches expectations.
#### </granular_execution_steps>
 
#### <production_ready_code>
```js
// eslint.config.mjs
import tseslint from "typescript-eslint";
export default tseslint.config(
  { ignores: [".next/**","dist/**","build/**","out/**","node_modules/**","supabase/**","sandbox/**"] },
  ...tseslint.configs.recommended,          // correctly spreads the recommended ARRAY
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "no-console": "warn",
    },
  },
);
```
#### </production_ready_code>
 
---
 
### Issue #16: MCP Route Uses a Single Module-Level Transport, Connects at Import, and Sets `Access-Control-Allow-Origin: *`
* **Location:** `src/app/api/mcp/route.ts`
* **Severity:** Medium
 
#### <source_grounding>
```ts
const server = new McpServer({ name: "masarx-mcp-server", version: "1.0.0" });
const transport = new WebStandardStreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
});
server.connect(transport).catch(console.error);   // runs at module load
// ...
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS", ... } });
}
```
#### </source_grounding>
 
#### <architectural_reasoning>
1. **Shared mutable transport.** A single `transport`/`server` is created at module scope and `server.connect()` is fired during import. In a serverless/concurrent environment a single streamable transport cannot safely multiplex independent client sessions; concurrent requests share session state and can interleave responses.
2. **Open CORS with no auth.** `Access-Control-Allow-Origin: *` lets any website call the MCP endpoint from a browser, and there is no authentication on `GET`/`POST`. The sample `get_project_info` tool is harmless, but the pattern invites exposing real tools to the open internet.
3. **Import-time side effect.** `server.connect(...).catch(console.error)` swallows connection failures and runs even for unrelated route loads.
#### </architectural_reasoning>
 
#### <granular_execution_steps>
1. Instantiate the `McpServer` and transport **per request** (inside `POST`/`GET`), not at module scope, or use the SDK's session-aware transport map keyed by `MCP-Session-ID`.
2. Restrict CORS to known origins (an allow-list), not `*`.
3. Add an auth check (API key or Supabase session) before handling MCP requests if any non-public tool is ever registered.
4. Remove the import-time `server.connect(...)` and connect within the handler with proper error propagation.
#### </granular_execution_steps>
 
#### <production_ready_code>
```ts
const ALLOWED_ORIGINS = new Set([process.env.NEXT_PUBLIC_SITE_URL ?? "https://masarx.vercel.app"]);
function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "null";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, MCP-Protocol-Version, MCP-Session-ID",
  };
}
export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}
```
#### </production_ready_code>
 
---
 
### Issue #17: Dead Sentry Scaffolding + Always-Throwing `sentry-example-api` Route in Production
* **Location:** `src/app/api/sentry-example-api/route.ts`, `src/instrumentation-client.ts`, `.npmrc`
* **Severity:** Medium
 
#### <source_grounding>
```ts
// src/app/api/sentry-example-api/route.ts — publicly reachable, unauthenticated
export async function GET() { throw new Error("Sentry Server-Side API Test Error"); }
```
```ts
// src/instrumentation-client.ts — empty stub
export const onRouterTransitionStart = () => {};
```
```
# .npmrc
public-hoist-pattern[]=*sentry*
```
No `@sentry/*` package exists in `package.json` dependencies.
#### </source_grounding>
 
#### <architectural_reasoning>
The repo is wired *as if* Sentry is installed — a hoist pattern in `.npmrc`, an instrumentation client stub, and an example error route — but **no Sentry SDK is a dependency**. So error monitoring is non-functional, and the `sentry-example-api` route is a live, unauthenticated endpoint that intentionally throws a 500 on every `GET`, generating noise/log spam and a trivial way to exercise the error path in production. Either finish wiring Sentry or remove the scaffolding.
#### </architectural_reasoning>
 
#### <granular_execution_steps>
1. Decide: adopt Sentry or not.
2. If not adopting: delete `src/app/api/sentry-example-api/`, delete `src/instrumentation-client.ts` (and the `*sentry*` hoist line in `.npmrc`).
3. If adopting: add `@sentry/nextjs` to dependencies, run `npx @sentry/wizard@latest -i nextjs`, and keep the example route behind `process.env.NODE_ENV !== "production"`.
4. Run `pnpm build` to confirm nothing references the removed files.
#### </granular_execution_steps>
 
#### <production_ready_code>
```ts
// If keeping the example route, gate it so it cannot run in prod:
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }
  throw new Error("Sentry Server-Side API Test Error");
}
```
#### </production_ready_code>
 
---
 
### Issue #18: Hard `window.location.href` Navigation Bypasses next-intl Router (Full Reload + Hardcoded Locale)
* **Location:** `src/components/SubjectsGrid.tsx:155` (and similar `window.location` uses)
* **Severity:** Medium
 
#### <source_grounding>
```tsx
onClick={() => (window.location.href = `/${locale}/ai-assistant`)}
```
#### </source_grounding>
 
#### <architectural_reasoning>
Assigning `window.location.href` triggers a **full document reload**, discarding the SPA state, the React Query cache, and the in-memory auth/session context — then re-running the entire root layout, providers, and the per-request `getAdminDb()` profile fetch (Issue #5). It also manually concatenates the locale prefix instead of using the locale-aware `Link`/`useRouter` from `src/i18n/routing.ts`, so it will desync if the locale-prefix strategy changes. The project already exports `Link` and `useRouter` from next-intl's `createNavigation(routing)` — those must be used for internal navigation.
#### </architectural_reasoning>
 
#### <granular_execution_steps>
1. Import the locale-aware router: `import { useRouter } from "@/i18n/routing";` (or the `Link` component).
2. Replace `window.location.href = ...` with `router.push("/ai-assistant")` — next-intl injects the current locale automatically; do **not** hand-prefix `/${locale}`.
3. Repeat for other internal `window.location.href`/`window.open` self-navigations (keep `window.open` only for external/file URLs).
4. Confirm navigation no longer triggers a full page reload (network tab shows a client transition, not a document request).
#### </granular_execution_steps>
 
#### <production_ready_code>
```tsx
import { useRouter } from "@/i18n/routing";
// ...
const router = useRouter();
<button onClick={() => router.push("/ai-assistant")}>...</button>
```
#### </production_ready_code>
 
---
 
### Issue #19: Profile Sync Invalidates the Entire Layout Cache on Every Sign-In + Missing-Dependency Hook
* **Location:** `src/actions/auth.ts` (`revalidatePath('/', 'layout')`), `src/contexts/AuthContext.tsx`
* **Severity:** Medium
 
#### <source_grounding>
```ts
// src/actions/auth.ts
revalidatePath('/', 'layout');   // busts the ROOT layout cache for the whole app
```
```
// pnpm lint
src/contexts/AuthContext.tsx
  164:6  warning  React Hook useEffect has a missing dependency: 'triggerSync' ...
```
#### </source_grounding>
 
#### <architectural_reasoning>
`revalidatePath('/', 'layout')` with the `'layout'` mode invalidates the cache for **every route under the root layout** — i.e. the entire site — and it runs on each `SIGNED_IN` (the client forces a sync on login, plus periodic syncs). This is a sledgehammer that defeats Next's caching site-wide on a routine auth event; it should target only the routes whose data actually changed (e.g. `/[locale]/profile`). Separately, the `useEffect` in `AuthContext` depends on `triggerSync` but omits it from the dependency array (lint warning #21 of the 64). `triggerSync` is `useCallback`-memoized with `[]`, so it is stable today, but the lint suppression masks a real foot-gun if its deps ever change.
#### </architectural_reasoning>
 
#### <granular_execution_steps>
1. In `src/actions/auth.ts`, replace `revalidatePath('/', 'layout')` with a targeted `revalidatePath('/[locale]/profile', 'page')` (or `revalidateTag('profile')` after tagging the profile fetch).
2. In `AuthContext.tsx`, add `triggerSync` to the `useEffect` dependency array (it is already memoized, so this is safe and silences the warning).
3. Run `pnpm lint` and confirm the `exhaustive-deps` warning for `AuthContext` is gone.
#### </granular_execution_steps>
 
#### <production_ready_code>
```ts
// src/actions/auth.ts
import { revalidateTag } from "next/cache";
// after a successful profile write:
revalidateTag("profile");        // only data tagged "profile" is refreshed
```
```tsx
// AuthContext.tsx — close the effect dependency
}, [triggerSync]);
```
#### </production_ready_code>
 
---
 
### Issue #20: Root Layout Re-Derives Locale/`dir` From Headers & Cookies Independently of the `[locale]` Segment
* **Location:** `src/app/layout.tsx` (`localeFromRequest`)
* **Severity:** Medium
 
#### <source_grounding>
```tsx
const headerLocale = headersList.get("x-next-intl-locale");
const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
const localeFromRequest = async (): Promise<Locale> => {
  try { return normalizeLocale(await getLocale())
      ?? normalizeLocale(headerLocale) ?? normalizeLocale(cookieLocale) ?? "ar"; }
  catch { return normalizeLocale(headerLocale) ?? normalizeLocale(cookieLocale) ?? "ar"; }
};
const dir = locale === "ar" ? "rtl" : "ltr";
return (<html lang={locale} dir={dir} ...>);
```
#### </source_grounding>
 
#### <architectural_reasoning>
The `<html lang dir>` attributes are decided in the **root** layout from a *cocktail* of `getLocale()`, the `x-next-intl-locale` header, the `NEXT_LOCALE` cookie, and a hardcoded `"ar"` fallback — while the actual page locale is the `[locale]` URL segment resolved one level deeper. If the cookie/header disagrees with the URL segment (e.g. a user with `NEXT_LOCALE=en` visits `/ar/...`), the document can render `dir="ltr"` for Arabic content (or vice-versa), causing an **RTL/LTR layout breakdown** and a hydration mismatch between the server-chosen `dir` and what the `[locale]` tree expects. The directionality source of truth must be the URL segment, propagated to the root via the established next-intl request pipeline.
#### </architectural_reasoning>
 
#### <granular_execution_steps>
1. Prefer `getLocale()` (which next-intl resolves from the active request/segment) as the single source; drop the header/cookie fallbacks that can contradict the URL.
2. If the root layout cannot see the segment locale reliably, set `dir`/`lang` in `src/app/[locale]/layout.tsx` on a wrapping element, or pass the resolved locale up via the next-intl request config.
3. Add a regression check: load `/ar/...` with `NEXT_LOCALE=en` cookie and confirm `<html dir="rtl">`.
#### </granular_execution_steps>
 
#### <production_ready_code>
```tsx
// src/app/layout.tsx — trust next-intl's resolved locale only
import { getLocale } from "next-intl/server";
const locale = ((await getLocale()) === "en" ? "en" : "ar") as Locale;
const dir = locale === "ar" ? "rtl" : "ltr";
return <html lang={locale} dir={dir} suppressHydrationWarning className="html-overflow-clip"> ... </html>;
```
#### </production_ready_code>
 
---
 
### Issue #21: `vercel.json` Security Headers Duplicate & Diverge From Middleware (Stale `X-XSS-Protection`, No CSP)
* **Location:** `vercel.json`, `next.config.mjs` (`headers()`), `src/middleware.ts`
* **Severity:** Low
 
#### <source_grounding>
```json
// vercel.json
{ "key": "X-XSS-Protection", "value": "1; mode=block" },
{ "key": "X-Frame-Options", "value": "DENY" },
```
`next.config.mjs` sets `X-Frame-Options: SAMEORIGIN`; `src/middleware.ts` sets `X-Frame-Options: DENY`. CSP is only in middleware.
#### </source_grounding>
 
#### <architectural_reasoning>
Security headers are now defined in **three** places — `vercel.json`, `next.config.mjs#headers()`, and `src/middleware.ts` — and they disagree. `next.config.mjs` sets `X-Frame-Options: SAMEORIGIN` while both `vercel.json` and middleware set `DENY`; the effective value depends on header precedence and is non-obvious. `vercel.json` also ships the **deprecated `X-XSS-Protection`** header (modern browsers ignore it; it can even introduce vulnerabilities in legacy ones) and contains **no CSP**, so the CSP exists only in middleware (the file that, per Issue #3, must remain the active interceptor). Three competing sources make the security posture fragile and hard to reason about.
#### </architectural_reasoning>
 
#### <granular_execution_steps>
1. Choose **one** owner for security headers. Recommended: keep dynamic, nonce-based CSP in `src/middleware.ts`; keep only static, cache-related headers in `vercel.json`.
2. Remove the duplicated security headers (`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) from `vercel.json` and delete `X-XSS-Protection` entirely.
3. Align `X-Frame-Options` to a single value (`DENY`) — remove the `SAMEORIGIN` copy from `next.config.mjs#headers()` or make it match.
4. Verify final response headers in the browser network tab show exactly one value per header.
#### </granular_execution_steps>
 
#### <production_ready_code>
```json
// vercel.json — keep ONLY caching here; security headers live in middleware
{
  "headers": [
    { "source": "/assets/(.*)", "headers": [
      { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
    ]}
  ],
  "redirects": [
    { "source": "/(.*)", "has": [{ "type": "host", "value": "masar-x.vercel.app" }],
      "destination": "https://masarx.vercel.app/$1", "permanent": true }
  ]
}
```
#### </production_ready_code>
 
---
 
### Issue #22: `images.unoptimized` Disabled Outside Production + Wildcard `img-src https:` Weakens CSP
* **Location:** `next.config.mjs`, `src/middleware.ts` (CSP `img-src`)
* **Severity:** Low
 
#### <source_grounding>
```js
// next.config.mjs
images: { unoptimized: process.env.NODE_ENV !== "production", ... }
```
```ts
// middleware.ts CSP
"img-src 'self' data: blob: https:",
```
#### </source_grounding>
 
#### <architectural_reasoning>
1. **Image optimization off for previews.** `unoptimized: NODE_ENV !== "production"` disables Next's image optimizer in *all* non-production environments, including **Vercel Preview deployments** (where `NODE_ENV === "production"` is actually true, but local/preview builds via other env values are not). Reviewers therefore evaluate un-optimized images and miss layout-shift/perf regressions that only the optimizer would expose. Gate on an explicit flag instead of `NODE_ENV`.
2. **CSP `img-src https:` is a wildcard** allowing images from *any* HTTPS origin, which undermines the purpose of the otherwise carefully scoped CSP (Cloudinary/Supabase are already allow-listed in `connect-src`). It permits arbitrary tracking pixels / exfil-via-image. Scope `img-src` to the same hosts as `next.config.mjs#images.remotePatterns`.
#### </architectural_reasoning>
 
#### <granular_execution_steps>
1. Replace `unoptimized: process.env.NODE_ENV !== "production"` with an explicit opt-out: `unoptimized: process.env.DISABLE_IMAGE_OPT === "true"` (default optimized everywhere).
2. In `middleware.ts`, replace `img-src ... https:` with an explicit host list mirroring `remotePatterns` (Cloudinary, the Supabase project host, Google, framerusercontent).
3. Verify images still load on all surfaces and that the CSP no longer contains a bare `https:` in `img-src`.
#### </granular_execution_steps>
 
#### <production_ready_code>
```ts
// middleware.ts
"img-src 'self' data: blob: https://res.cloudinary.com https://jcufigozkhxazjbwhjjm.supabase.co https://lh3.googleusercontent.com https://framerusercontent.com",
```
```js
// next.config.mjs
images: { unoptimized: process.env.DISABLE_IMAGE_OPT === "true", remotePatterns: [ /* unchanged */ ] },
```
#### </production_ready_code>
 
---
 
### Issue #23: Middleware Cookie Merging Uses `headers.get("set-cookie")` (Drops Multiple Auth Cookies)
* **Location:** `src/middleware.ts` (and the dead `proxy.ts`)
* **Severity:** Low
 
#### <source_grounding>
```ts
const sessionSetCookie = sessionResponse.headers.get("set-cookie");
if (sessionSetCookie) finalResponse.headers.append("set-cookie", sessionSetCookie);
const intlSetCookie = intlResponse?.headers.get("set-cookie");
if (intlSetCookie) finalResponse.headers.append("set-cookie", intlSetCookie);
```
#### </source_grounding>
 
#### <architectural_reasoning>
`Headers.get("set-cookie")` returns the cookies **combined into a single comma-joined string** rather than the individual `Set-Cookie` entries. Supabase frequently sets *multiple* cookies (e.g. chunked `sb-<ref>-auth-token.0`, `.1`), and cookie values can legitimately contain commas (dates in `Expires`). Re-`append`-ing the joined string can corrupt or drop cookies, producing intermittent "logged out after refresh" bugs. The correct API is `response.cookies.getAll()` (Next's typed cookie store) or `headers.getSetCookie()` to preserve each cookie separately. The recommended pattern is to thread a single `NextResponse` through both the intl and Supabase steps so cookies are written once, not merged after the fact.
#### </architectural_reasoning>
 
#### <granular_execution_steps>
1. Refactor the middleware so `updateSession` and `intlMiddleware` operate on/return one shared `NextResponse`, eliminating the manual merge.
2. If a merge is unavoidable, iterate `sessionResponse.cookies.getAll()` and call `finalResponse.cookies.set(...)` per cookie instead of `headers.get("set-cookie")`.
3. Test login → hard refresh across both `/ar` and `/en`, confirming the session persists and chunked `sb-*-auth-token.*` cookies are all present.
#### </granular_execution_steps>
 
#### <production_ready_code>
```ts
// Preserve each cookie individually
for (const c of sessionResponse.cookies.getAll()) {
  finalResponse.cookies.set(c.name, c.value, c);
}
if (intlResponse) {
  for (const c of intlResponse.cookies.getAll()) finalResponse.cookies.set(c.name, c.value, c);
}
```
#### </production_ready_code>
 
---
 
### Issue #24: Per-Request Profile State Setter Lives in Both Server Layout and Client Header (`window.profileUpdate` Event Bus)
* **Location:** `src/components/Header.tsx` (`profileUpdate` custom event), `src/contexts/AuthContext.tsx`
* **Severity:** Low
 
#### <source_grounding>
```ts
// Header.tsx
window.addEventListener("profileUpdate", handleProfileUpdate);
// ...
return () => window.removeEventListener("profileUpdate", handleProfileUpdate);
```
Profile is sourced three ways: SSR layout prop → `AuthContext` state → a global `window` `"profileUpdate"` CustomEvent.
#### </source_grounding>
 
#### <architectural_reasoning>
Profile data flows through **three uncoordinated channels**: the server layout passes `initialProfile`, `AuthContext` keeps it in React state, and `Header.tsx` listens to a hand-rolled `window` CustomEvent (`"profileUpdate"`) to patch its own copy. Using the global `window` object as an event bus to sync React state is fragile (no typing, easy to leak listeners, races with the context's own updates) and produces a UI where the avatar/name can disagree between Header and the rest of the tree after an edit. Profile should have a single owner — the React Query cache or `AuthContext` — and components should subscribe to that, not to `window` events.
#### </architectural_reasoning>
 
#### <granular_execution_steps>
1. Move profile into a single React Query key (e.g. `["profile", userId]`) or expose `setProfile`/`refreshProfile` from `AuthContext`.
2. After a profile edit, call `queryClient.invalidateQueries(["profile", userId])` (or `refreshProfile()`) instead of `window.dispatchEvent(new CustomEvent("profileUpdate"))`.
3. Delete the `window.addEventListener("profileUpdate", ...)` block from `Header.tsx`.
4. Confirm avatar/name update everywhere simultaneously after an edit.
#### </granular_execution_steps>
 
#### <production_ready_code>
```tsx
// Consume the single source of truth instead of a window event
const { profile } = useAuth();          // or: useQuery(["profile", userId], fetchProfile)
// after edit:
queryClient.invalidateQueries({ queryKey: ["profile", userId] });
```
#### </production_ready_code>
 
---
 
## Appendix A — Reproduction Environment
- Repo: `Aboalayoun/Masar-x-next` @ `afdcbeb`
- Node: v22.12.0 · pnpm: 9.15.9
- `pnpm typecheck`: **passes** (exit 0)
- `pnpm lint`: **fails** — 64 warnings, `--max-warnings=0` (exit 1)
- `pnpm install`: **fails** until `pnpm-workspace.yaml` is fixed (Issue #1)
 
## Appendix B — Severity Summary
| # | Title | Severity |
|---|-------|----------|
| 1 | Invalid `pnpm-workspace.yaml` blocks all pnpm commands | Critical |
| 2 | `pnpm lint` fails CI (`--max-warnings=0` vs 64 warnings) | Critical |
| 3 | Dead `proxy.ts` shadows real `src/middleware.ts` security | Critical |
| 4 | Empty migrations + triple-nested `supabase/` (no schema/RLS in VCS) | Critical |
| 5 | `getAdminDb()` service pool on every page load (RLS bypass + conn exhaustion) | High |
| 6 | Two Supabase browser singletons → Multiple GoTrueClient | High |
| 7 | Client-side secret-access gate on anon-readable table | High |
| 8 | Global error/console suppression w/o cleanup | High |
| 9 | Theme script `afterInteractive` → FOUC + double source of truth | High |
| 10 | Committed Supabase `.temp/` leaks project ref + pooler URL | High |
| 11 | In-memory rate limiter (ineffective) + double counting | High |
| 12 | Dead/duplicate home routes (`home_ar`, `test-route`, encoded Arabic) | Medium |
| 13 | Root layout `generateMetadata` reads non-existent `params.locale` | Medium |
| 14 | Vite leftovers (deps/config/tailwind `content`) | Medium |
| 15 | Dual ESLint configs + mis-spread recommended rules | Medium |
| 16 | MCP route shared transport + open CORS + import-time connect | Medium |
| 17 | Dead Sentry scaffolding + always-throwing example route | Medium |
| 18 | `window.location.href` hard navigation bypasses i18n router | Medium |
| 19 | `revalidatePath('/', 'layout')` busts whole cache + missing hook dep | Medium |
| 20 | Root layout derives `dir` from headers/cookies (RTL/LTR mismatch) | Medium |
| 21 | `vercel.json` header duplication/divergence (stale `X-XSS-Protection`) | Low |
| 22 | `images.unoptimized` off for non-prod + wildcard `img-src https:` | Low |
| 23 | Middleware `headers.get("set-cookie")` drops multiple auth cookies | Low |
| 24 | `window.profileUpdate` event bus as profile state sync | Low |