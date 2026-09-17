# Feature Specification: MVP Launch Ops Hardening

**Feature Branch**: main (atomic commits)
**Created**: 2026-09-17
**Status**: approved (owner-approved plan; this file records it)
**Input**: `docs/MVP_REPORT.md` pass 2 — findings G3.1, G3.2, G3.5, G2.1, G3.4, G3.6, G1.4, G1.5, G7.1
**Scope note**: spec number derived from disk (`specs/` held 001–008 at landing; 008 is a parallel-session draft awaiting owner approval). Companion spec: [010_e2e-study-flow-smoke](../010_e2e-study-flow-smoke/spec.md).

## Context & Problem Statement

The MVP readiness report (pass 2) found the web app launch-ready on features but unproven on operations:

1. **The live database's RLS state is unverified** (G3.1). Migrations declare 19 RLS-enables / 41 policies, but nothing proves the production DB matches — a single dashboard edit could leave a table exposed on a public-facing product.
2. **One-off tooling lives in the worktree** (G3.2): `.openclaw-rls-open.mjs` applied the `subject_lectures` public-read change straight to prod; it embeds a project ref and reads `.env`.
3. **Production env/flags are unverified** (G3.5, G2.1): `SUPABASE_SERVICE_ROLE_KEY` (known gotcha §6), `ai_chat_disabled`, `NEXT_PUBLIC_SITE_URL`, Cloudinary vars — a single misconfiguration silently breaks core flows that pass locally.
4. **Admin role revocation propagation is untested** (G3.4): `isAdmin` derives from `app_metadata.role` in the JWT; nothing proves a demoted admin loses access at token refresh.
5. **Dependabot is unmanaged** (G3.6): no `.github/dependabot.yml`; 193 open alerts (63 electron) on a public repo and no mechanism shrinking them.
6. **Two routes violate I3/URL hygiene** (G1.4, G1.5): `/[locale]/add` is a redirect stub with hardcoded Arabic; a route folder literally named `الرئيسية` breaks the `ar`/`en` prefix scheme.
7. **Sentry example route shipped to prod** (G7.1): `api/sentry-example-api` is generated scaffolding; DSN wiring unverified.

MVP Lock (I12) classification: items 1–5, 7 are deployment readiness; item 6 is a small functional/i18n fix. All in scope.

## Architecture & Design

### 1. Read-only RLS audit tool (G3.1) — `scripts/audit-rls.mjs`

- Standalone Node script; `pg` is already a dependency (`apps/web/package.json` `pg@^8.18.0`, resolvable from the root — verified 2026-09-17). If root resolution ever fails, declare `pg` as a root devDependency; no other new deps.
- Reuses the `.env`/`.env.local` loader pattern from `scripts/seed-mvp-launch.mjs`; connects via `DATABASE_URL` (pooler host overridable via `SEED_DB_HOST`, same convention).
- **Read-only SQL only**: `pg_class.relrowsecurity` + `pg_tables` for every `public.*` table; full `pg_policies` dump (policy name, cmd, roles, qual).
- Assertions: (a) every `public.*` table has RLS enabled → else **exit 1**; (b) warn (not fail) on any policy granting `anon` write (INSERT/UPDATE/DELETE); (c) print the `subject_lectures` SELECT policy and verify it grants read to `anon, authenticated` (matches migration `007`).
- Output: human-readable report written to `docs/audits/rls-audit-<YYYY-MM-DD>.md` (table state, policies, failures) and a concise stdout summary. The script never writes to the DB.

### 2. Retire `.openclaw-rls-open.mjs` (G3.2)

- Gated on the audit passing and its output matching migration `007`'s policy text. Move to `.trash/.openclaw-rls-open.mjs` (I9; owner pre-approved 2026-09-17). File is untracked, so no git operation.

### 3. Env sweep + AI prod smoke runbook (G3.5, G2.1) — `checklists/env-sweep.md`

- `vercel env ls production --project <project>` (always pass `--project`; local link is stale) diffed against `.env.example`'s required table; result recorded in the checklist.
- Prod AI smoke: one logged-in chat round-trip + one rate-limit rejection (11th rapid request → 429) on the deployed site; `ai_chat_disabled` value confirmed. Owner-assisted (needs a browser session).

### 4. Role propagation runbook (G3.4) — `checklists/role-propagation.md`

- Demote a test admin in Supabase → confirm the next token refresh drops `app_metadata.role` → admin UI denies → RLS blocks the write. Owner-assisted; result recorded.

### 5. Dependabot config (G3.6) — `.github/dependabot.yml`

- `version: 2`; two updates entries: `npm` at `/` (recursive across the pnpm workspace manifests) and `github-actions` at `/`; weekly; `reviewers: [fotedev]`; grouped minor/patch to keep PR count sane; `open-pull-requests-limit: 10`.

### 6. Route hygiene (G1.4, G1.5) — `apps/web/src/app/[locale]/add/`, `الرئيسية/`

- **`/add`** (fix, don't retire — owner pre-approved): redirect via the i18n-aware router (`@/navigation`, preserving locale) instead of the raw next/navigation router; loader string moves to `messages/{ar,en}` (reuse an existing `common.loading` key if present — no new keys).
- **`الرئيسية`**: grep src + sitemap for references. If referenced → convert to a redirect page to `/[locale]/home` (pattern: `[locale]/admin/page.tsx` → `admin-dashboard`); if unreferenced → move to `.trash/apps/web/src/app/[locale]/...` (I9; owner pre-approved either disposition).

### 7. Sentry cleanup (G7.1) — `apps/web/src/app/api/sentry-example-api/`

- Check DSN presence (`.env.local` + `vercel env ls`); if configured, fire one test error and confirm arrival; if not configured, record that Sentry is dormant. Either way, retire `sentry-example-api/` → `.trash/apps/web/src/app/api/sentry-example-api/` (I9; owner pre-approved) and `git add` the deletion.

## Behavior Preservation & Regression Strategy

- No user-facing feature changes. The only behavior deltas are redirects: `/add` now targets the locale-prefixed path (same destination, correct URL), and `الرئيسية` either redirects to `/home` or disappears (only if nothing references it — verified by grep first).
- The audit script and env sweep are strictly read-only against production.
- Retirement moves preserve full file content under `.trash/` with mirrored paths.

## Test Specification

- `node scripts/audit-rls.mjs` exits 0 on the current prod DB and produces the audit doc; a negative test is not required (the assertion logic is four SQL reads + boolean checks) but the script must fail loudly if `DATABASE_URL` is missing.
- `pnpm typecheck && pnpm lint` unchanged (ratchet 52 warnings).
- `bash .github/scripts/check-doc-links.sh` passes (docs added this spec must not break it).
- i18n gates: `check-translations.sh` + `verify_i18n.mjs` — no NEW hardcoded-Arabic hits (the `/add` fix must remove its existing hit, net negative).
- dependabot.yml is validated by GitHub on push (config errors surface as workflow alerts, not CI failures).

## Atomic Execution Plan

1. `docs: add MVP readiness report (pass 2)` — the report itself (landed with this spec).
2. `docs(specs): land 009 MVP-launch ops hardening + 010 e2e study-flow smoke specs`
3. `feat(scripts): add read-only RLS audit tool` — `scripts/audit-rls.mjs` + executed `docs/audits/rls-audit-2026-09-17.md` (G3.1)
4. `chore(repo): retire one-off RLS script to .trash/` (G3.2, gated on 3)
5. `docs(specs): record 009 runbook results — env sweep, AI smoke, role propagation` (G3.5, G2.1, G3.4)
6. `chore(ci): add dependabot config (npm + github-actions, weekly)` (G3.6)
7. `fix(web): localize /add redirect and retire الرئيسية route` (G1.4, G1.5)
8. `chore(web): retire sentry-example-api route` (G7.1)
9. `docs(mvp-report): pass 3 — flip resolved states, changelog`
