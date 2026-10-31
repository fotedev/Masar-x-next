# supabase/migrations — baseline doctrine

## The chain is APPEND-ONLY from the baseline

`20261031000000_baseline.sql` is a full schema snapshot of the production
database (project `jcufigozkhxazjbwhjjm`) generated on **2026-10-31** from the
production catalogs (not hand-written, not pg_dump — see its header and
`specs/031-migration-consolidation/tools/` for the exact generator scripts).
`20261031000001_storage_buckets.sql` adds the storage-bucket rows that a
schema dump cannot carry.

A fresh environment (local dev, a new Supabase project, CI) is built as:

1. apply every file in this directory, in lexical order (the Supabase
   migration runner / `supabase db reset` does exactly this);
2. done — the result is byte-for-byte the production schema (verified:
   see `specs/031-migration-consolidation/verification.md`).

## Rules

1. **Never edit an applied migration.** The baseline describes production;
   changing it makes the chain lie. Fix forward with a new migration.
2. **New migrations are timestamp-prefixed**, and the file name must start
   with the exact version recorded in the production migration ledger, e.g.
   `20261105090000_add_x.sql` when the ledger row is
   `20261105090000 add_x` (the `supabase-masarx` MCP `apply_migration` writes
   that row — always apply production changes through it, never by hand).
3. **Do not reintroduce the old numbered chain.** It is archived under
   `supabase/migrations-archive/numbered-chain-001-019/` for archaeology only:
   it could not rebuild production (hard breaks at 010–013, ~30 production
   tables had no DDL in it at all).

## Rebuilding and verifying

With any PostgreSQL 17 instance (local, docker, portable):

```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 \
  -c "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261031000000_baseline.sql
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261031000001_storage_buckets.sql
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls-verify.sql
```

On a real Supabase project the two `create role` lines are unnecessary (the
platform provides the roles). The exact harness used for verification,
including the auth-schema prelude and seed fixtures, lives in
`specs/031-migration-consolidation/tools/`.

## Regenerating types

The `Database` type in `packages/shared/src/types/database.ts` is generated
from the production schema (`supabase gen types typescript --linked`, or the
Supabase MCP `generate_typescript_types`). Do not hand-edit it.
