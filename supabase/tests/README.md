# supabase/tests — RLS verification harness

`rls-verify.sql` is a readable, dependency-free SQL harness that verifies Row
Level Security for every client-accessible table in schema `public`.
Spec 004 / T055 (code part).

It is a **harness, not a migration** — it changes no schema, and everything it
runs inside transactions is rolled back.

## What it verifies

| Section | What | Behavior |
|---|---|---|
| 0 | Context + preflight | Fails if the connected role cannot `SET ROLE authenticated`. |
| 1a | All 19 tables from migrations 002..008 exist and have `relrowsecurity = true` | `RAISE EXCEPTION` naming any offender |
| 1b | Dynamic sweep: **any** base table in `public` without RLS fails | Catches future/legacy drift (e.g. `quiz_attempts` from `migrations.old/` if present) |
| 1c | `review_details` / `lectures_with_ratings` views are `security_invoker` | Owner-rights views would bypass base-table RLS |
| 2 | Policy inventory (`tablename, policyname, cmd, roles`), ordered | Documentation output |
| 3 | Positive/negative behavior tests as `authenticated` / `service_role` | See below; every block runs in `BEGIN ... ROLLBACK` |

Section 3 coverage: profiles, summaries, quizzes, enrollments, reviews,
notifications, admins, password_reset_tokens (authenticated blackout +
service_role read), audit_logs/system_logs/rate_limits (invisible to
authenticated), and a conditional `quiz_attempts` block (SKIPs loudly when the
legacy table is absent).

## Requirements

1. Migrations `001..008` applied (`supabase migrations up` or equivalent).
2. A connection role that can assume test roles — the Supabase `postgres`
   role (granted `anon`/`authenticated`/`service_role` membership on managed
   projects) or any superuser.
3. **For Section 3 only:** the seed fixtures below (two auth users + one
   course). Sections 1 and 2 run anywhere without them.

### Seed (run ONCE on the target database, SQL editor or psql)

```sql
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000',
   '00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated',
   'rls-user-a@example.com', crypt('rls-harness-only', gen_random_uuid()::text),
   now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000',
   '00000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated',
   'rls-user-b@example.com', crypt('rls-harness-only', gen_random_uuid()::text),
   now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.courses (id, title, instructor_id)
values ('00000000-0000-0000-0000-0000000000c1', 'RLS harness course',
        '00000000-0000-0000-0000-0000000000a1');
```

On a REAL Supabase project the `auth.users` insert also creates empty
`profiles` rows via the `on_auth_user_created` trigger. The migration chain
(baseline, spec 031) does NOT recreate that trigger on rebuilt clusters, so
the seed must create the two profiles itself — `ON CONFLICT DO NOTHING` keeps
it safe on real Supabase where the trigger already made them:

```sql
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'RLS harness user A'),
  ('00000000-0000-0000-0000-0000000000a2', 'RLS harness user B')
on conflict (id) do nothing;
```

For real sign-in flows use the
Supabase Auth admin API instead of direct inserts; the harness only needs the
rows to exist so RLS verdicts are exact (RLS is checked before foreign keys on
INSERT, so an unsatisfied foreign key would make a negative test
inconclusive — that is why the seed matters).

## How to run

### psql (authoritative, CI-friendly)

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls-verify.sql
```

`ON_ERROR_STOP=1` is **required**: any failed assertion aborts the run and
psql exits non-zero, which is exactly what CI should key on.

### Supabase Dashboard

Project -> SQL Editor -> paste the whole file -> Run. Each statement runs in
order; the first `RAISE EXCEPTION` stops the run and shows the failing
message. (Use psql for exit codes.)

### CI

CI runs this against a **disposable Supabase branch database** — never
production. Apply migrations, apply the seed, run the harness with psql, and
let the non-zero exit code fail the pipeline. TODO(LIVE-JWT) markers in the
file denote the spots where a real signed JWT / admin fixture is required;
the branch DB seed supplies those fixtures.

## What PASS looks like

`NOTICE` lines per section, then completion:

```text
NOTICE:  PREFLIGHT PASS: postgres can assume authenticated and service_role
NOTICE:  SECTION 1a PASS: all 19 expected tables exist with RLS enabled
NOTICE:  SECTION 1b PASS: no base table in schema public lacks RLS
NOTICE:  SECTION 1c PASS: user-data views use security_invoker
NOTICE:  3.1 profiles PASS: cross-user insert rejected as expected
NOTICE:  3.8a password_reset_tokens PASS: invisible to authenticated
...
NOTICE:  3.10 quiz_attempts SKIP: not present (not part of migrations 001..008)
NOTICE:  RLS VERIFY COMPLETE: Sections 1-2 asserted, Section 3 behavioral blocks passed (or explicitly SKIPped).
```

Exit code 0.

## What FAIL looks like

A hard stop with the offending table named, for example:

```text
ERROR:  RLS VERIFY FAILED: tables without row level security: news appeals
```

`RLS VERIFY INCONCLUSIVE: ...` messages mean the verdict could not be made
because seed fixtures are missing — apply the seed and re-run (Sections 1-2
assertions are never inconclusive).

## Conventions used by the harness

* Every Section 3 block: `BEGIN; SET LOCAL ROLE <role>; set_config('request.jwt.claims', ...)` —
  Supabase `auth.uid()` / `auth.role()` read exactly that setting — followed
  by assertions, then `ROLLBACK;`.
* Positive test = the query executes without a permission error.
* Negative test = a write that must be rejected; if it succeeds, RLS is
  broken and the harness raises with the table named.
* `profiles` are public-read **by design** (migration 002: "Public profiles
  are viewable by everyone"); only profile writes are user-scoped. Same for
  summaries/quizzes/videos/files reads (public read, admin-managed writes).
---

# rpc-verify.sql — RPC behavior harness (spec 040)

Companion to `rls-verify.sql`: that file covers WHO may touch WHAT (policies);
`rpc-verify.sql` covers WHAT the server-authoritative functions DO.

| Section | Function(s) | What it pins |
|---|---|---|
| 1 | `norm_subject_name(v text)` | spec 038 normalizer vectors (the JS twin in sync-reconcile must stay in lockstep) |
| 2 | `check_rate_limit(...)` | fixed-window math, exact `max_requests` boundary, no-increment-when-blocked, stale-window purge, per-endpoint independence |
| 3 | `finish_quiz_attempt` + `guard_quiz_attempt_grading` trigger | auth/ownership/unknown-id refusals (42501), client-side tampering blocked, authoritative re-grade overwrites dirty client score, answers payload ordered, time fallback, idempotent `already_finished` retry |
| 4 | `trw_redeem_access_code` | auth guard (structured error, not exception), unknown/expired/inactive rejection, duplicate rejection, membership upsert (revoke reset), redemption ledger, used_count + atomic auto-deactivation at exhaustion, audit row, NULL-duration permanent membership |

Every mutating scenario runs inside `BEGIN ... ROLLBACK` — nothing survives a
run. 53 assertions total; a violation raises `RPC-VERIFY FAILED: ...` and
aborts under `-v ON_ERROR_STOP=1`.

## Running it

The harness needs a PostgreSQL 17 built from this repo's migration chain
(`supabase/migrations/README.md`). On vanilla PG the chain requires the
`auth`-schema prelude first:

```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 \
  -c "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create role authenticator nologin noinherit; create role supabase_storage_admin nologin bypassrls; create role dashboard_user nologin;"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/prelude.sql
for f in supabase/migrations/*.sql; do psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"; done
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rpc-verify.sql
```

`prelude.sql` (spec 040) recreates the lost spec 031 `tools/prelude.sql`: the
`auth` schema (`users` table + `auth.uid()`/`auth.role()`/`auth.jwt()` driven
by `request.jwt.claims`). It is idempotent and guarded — a no-op on a real
Supabase project. The harness impersonates users via `request.jwt.claims`
(`SET LOCAL`-style per scenario), not via role switching: the RPCs are
SECURITY DEFINER, so claim-setting is the caller context.

Verified end-to-end 2026-11-08 on a disposable portable PostgreSQL 17.6.1
(theseus-rs binaries) rebuilt from the full migration chain.
