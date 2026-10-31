# Spec 031 — verification evidence (2026-10-31)

Target: prove that `supabase/migrations/20261031000000_baseline.sql` rebuilds
the production schema exactly. All evidence below was produced on 2026-10-31
by the executing session; the generator + harness scripts live in
`tools/` (committed alongside this file).

## Environment

- Production: Supabase `jcufigozkhxazjbwhjjm` (Masar-x), PostgreSQL **17.6**,
  eu-central-1. Schema inventory: 49 public tables + 8 storage tables, 6
  views, 54 functions, 35 triggers, 187 policies, 1 enum, 0 sequences,
  extensions `pg_net, pg_stat_statements, pgcrypto, supabase_vault, uuid-ossp`.
- Rebuild target: portable PostgreSQL **17.6.1** (theseus-rs binaries,
  sha256-verified `110fe646…`) on 127.0.0.1:55432, fresh `initdb`.
- Platform prelude emulation (local-only, NOT part of the baseline):
  `tools/prelude.sql` — roles (`anon`, `authenticated`, `service_role`,
  `authenticator`, `supabase_storage_admin`, `dashboard_user`), `auth` schema
  (`users` table + `auth.uid()`/`auth.role()`/`auth.jwt()`).
- Harness seed (local-only): `tools/seed_harness.sql` — mirrors
  `supabase/tests/README.md` (two auth users a1/a2, course c1) plus explicit
  `profiles` rows (the rebuilt DB intentionally has no
  `on_auth_user_created` trigger because `auth` is platform-owned).

## Result 1 — clean apply

`psql -v ON_ERROR_STOP=1` of prelude → baseline → buckets on the fresh
cluster: **exit 0**, zero errors. Post-apply counts on the rebuild:

| object | prod | rebuild |
|---|---|---|
| public tables | 49 | 49 |
| storage tables | 8 | 8 |
| RLS policies (public+storage) | 187 | 187 |
| functions (public+storage) | 54 | 54 (+39 pgcrypto after extension install) |
| triggers | 35 | 35 |
| storage buckets | 5 | 5 (`Videos, course-materials, payment-proofs, quiz-images, summaries-pdfs`) |

## Result 2 — semantic diff prod ↔ rebuild = 0

The **same introspection queries** (`tools/q_*.sql`, deterministic ordering)
were run against prod (Management API) and the rebuild, and diffed:

| section | raw diff | after normalization |
|---|---|---|
| types | trailing-newline marker | **0 content lines** |
| tables | 61 (constraint order inside CREATE TABLE + trailing comma placement) | **0 content lines** |
| fks / functions / deferred / indexes / views / triggers / policies | trailing-newline marker only | **0 content lines each** |
| grants | 5 lines | **4 content lines, all documented below** |

Normalization applied: trailing-newline unification and, for `tables`,
stripping the trailing comma per line (which constraint line is "last" is a
catalog-ordering artifact; the constraint SET and definitions are identical).

The 4 remaining grant lines are the owner-model artifact, expected and
accepted: production grants `TO postgres` on `public`/`storage` schemas and
`storage.buckets`/`storage.objects` because prod's objects are owned by
platform roles (`supabase_storage_admin` etc.), while the rebuild's owner is
`postgres` itself (owner grants are implicit and excluded by the query).
No privilege available to client roles differs.

## Result 3 — behavioral harness `supabase/tests/rls-verify.sql`

Run against the rebuild with `psql -v ON_ERROR_STOP=1`: **exit 0 —
RLS VERIFY COMPLETE**, 29 PASS notices, 0 SKIP, 0 FAIL. Section 1a (19
expected tables + RLS), 1b (no un-RLS'd public table), 1c
(`security_invoker` views), and all Section 3 behavioral blocks
(profiles, summaries, quizzes, enrollments incl. self-apply/re-apply,
reviews, notifications, admins, password_reset_tokens blackout,
audit/system/rate_limits deny-all, quiz_attempts owner-scoped read) pass.

### Harness corrections made in this spec (file: supabase/tests/rls-verify.sql + tests/README.md)

The rebuilt DB faithfully reproduces production; every failure above exposed a
**stale harness expectation**, not a schema defect. Fixes:

1. Seed fixes (README + local copy): `courses` needs `instructor_id`
   (NOT NULL, FK → profiles) — seed now supplies user A; `crypt(...,
   gen_random_uuid()::text)` explicit cast.
2. `3.2b/3.2c summaries` + `3.3b/3.3c quizzes`: expectations updated from
   "admin-managed writes" to the live crowdsourced posture —
   `summaries_insert_authenticated` / "Users can insert own quizzes" allow
   own-row INSERT (`auth.uid() = user_id`), cross-user INSERT is the rejected
   negative case. Negative-test inserts now satisfy all NOT NULL columns so
   the RLS verdict is the only possible rejection (NOT NULL fires before RLS).
3. `3.6 notifications`: `notifications_insert_own` exists on the live schema —
   own-row INSERT is allowed, cross-user INSERT rejected (was asserted as
   "no insert policy exists").
4. `3.9 rate_limits`: authenticated holds no table grant on prod, so the
   deny-all posture manifests as `insufficient_privilege` — the block now
   treats that denial (or zero rows) as PASS. (This block was not runnable
   against production as written.)
5. `3.10 quiz_attempts`: `USING '…'::uuid` explicit cast (plpgsql param
   typing on vanilla psql).

## Documented divergences (platform-owned)

- `auth` / `realtime` / `supabase_functions` / `vault` schemas are NOT in the
  baseline (platform-managed; GoTrue and friends). The baseline references
  `auth.uid()` / `auth.users` — provided natively by Supabase, emulated by the
  local prelude.
- Extensions `pg_net` and `supabase_vault` are Supabase-only; their CREATE
  EXTENSION is attempted and tolerated to fail outside Supabase.
  `pg_stat_statements` needs shared_preload_libraries (same tolerance).
- Default ACLs are documented as comments in the baseline (platform-managed).
- Grant options (WITH GRANT OPTION) are not reproduced.
- `supabase_migrations` ledger rows are not part of the baseline.

## Operator-access notes (for reproduction)

- Prod introspection ran through the Supabase Management API
  `POST /v1/projects/{ref}/database/query` with the machine-local access
  token provisioned in the `supabase-masarx` MCP entry (value never printed;
  `supabase projects list` verified to show Masar-x first, per credential
  rules).
- `supabase db dump --linked` could NOT be used: Docker Desktop is not
  installed on this machine (the CLI's pg_dump runs via docker) and the
  project has no downloadable logical backups (`backups: []`, PITR off) —
  hence the catalogs-introspection generator, which is verified equivalent
  by Results 1–3.
