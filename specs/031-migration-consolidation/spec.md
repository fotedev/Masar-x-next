# Spec 031 — Migration consolidation: rebuildable chain + truthful Database types

Status: **Approved** (plan approved by owner 2026-10-31; portable-PostgreSQL
pivot chosen by owner the same day when Docker Desktop proved absent).
Audit lineage: bug-audit-2026-10-24 findings **H10/H11** (migration chain
cannot rebuild prod; shared `Database` type describes an unbuildable schema).

## 1. Context & problem statement

The active migration chain (`001`–`019`, duplicate `014`) cannot rebuild the
production database from scratch:

- hard breaks at 010–013 (missing `is_admin()`, `summaries.status`,
  DROP POLICY on absent tables, `quizzes.user_id`, `admins.role`,
  `platform_settings` column-name mismatch — full table in
  `supabase/migrations-archive/README.md`);
- ~30 production-required tables have no DDL anywhere in the chain
  (`appeals`, `news`, `analytics`, `assistant_messages`, `link_logs`,
  `system_access_codes`, `quiz_attempts`, `quiz_answers`, nine `trw_*`
  tables, `user_progress`, academic options tables, …);
- the production ledger contains rows with no repo file
  (`admin_analytics_views_count_page_view`);
- prod was actually built from an older lineage preserved only locally as
  `supabase/migrations.old/` (never committed).

Consequences: no fresh environment can be built (local dev, new Supabase
project, CI branch DBs), disaster recovery is impossible from the repo, and
the hand-maintained `Database` type (752 lines, 15 tables) described an
unbuildable schema — 6 of its tables had no chain DDL while the chain created
11 tables the type did not know.

## 2. Approach — freeze & baseline

Chosen over chain-repair (the chain cannot be patched into prod parity, and
prod is the source of truth per invariant I2):

1. **Freeze**: `git mv` the numbered chain to
   `supabase/migrations-archive/numbered-chain-001-019/` (history preserved).
2. **Baseline**: generate a full schema snapshot of production from its
   catalogs — `pg_get_functiondef`, `pg_get_triggerdef`, `pg_get_constraintdef`,
   `pg_get_indexdef`, `pg_get_viewdef`, `pg_policies`, ACL catalogs — ordered
   by dependency (schemas → extensions → types → tables → FKs → functions →
   deferred defaults → indexes → views → triggers → policies → grants) as
   `20261031000000_baseline.sql`, plus `20261031000001_storage_buckets.sql`
   for the bucket rows (data, not schema).
   - `supabase db dump` was unusable here (Docker Desktop absent, no
     downloadable backups); the introspection generator is verified
     equivalent by the evidence in `verification.md`.
   - Generator scripts are committed in `tools/` for reproducibility.
3. **Verify (hard gate)**: apply the baseline to a fresh portable PostgreSQL
   17.6.1; run the same introspection on both sides (must be identical) and
   run `supabase/tests/rls-verify.sql` to green.
4. **Zero production writes**: the whole track performed read-only SELECTs
   against prod. Nothing was applied, altered, or dropped on production.

## 3. Components

| Component | Responsibility |
|---|---|
| `supabase/migrations/20261031000000_baseline.sql` | Full prod schema snapshot (public + storage), self-contained (creates its schemas, tolerates Supabase-only extensions) |
| `supabase/migrations/20261031000001_storage_buckets.sql` | Bucket rows, idempotent |
| `supabase/migrations/README.md` | Baseline doctrine: append-only, timestamp-prefixed files matching the prod ledger version, never edit applied migrations |
| `supabase/migrations-archive/` | Retired chain + why (archaeology only) |
| `supabase/config.toml` | Local-stack fields (`project_id`, db major_version 17) alongside the existing function toggles |
| `packages/shared/src/types/database.ts` | Replaced with generated types from the production schema (deferred intent since the file was hand-maintained) |
| `supabase/tests/rls-verify.sql` + `tests/README.md` | Harness aligned with the live prod schema semantics (see verification.md §Result 3) |
| `specs/031-migration-consolidation/tools/` | The exact generator + prelude + seed scripts (provenance/reproducibility) |

## 4. Behavior preservation & regression strategy

- Production is untouched — zero writes (verification.md §Operator notes).
- The baseline is proven prod-exact by Results 1–3 in `verification.md`
  (clean apply, 0-content-line semantic diff on all 10 sections, harness
  exit 0).
- Client code is untouched except the `Database` type; type-level gates
  (tsc per app, web vitest) prove no consumer regressions.
- Documented, accepted divergences (platform-owned) are listed in the
  baseline header and verification.md: `auth`/`realtime`/`vault` schemas,
  Supabase-only extensions, default ACLs, grant options.

## 5. Test specification

1. Fresh-apply gate: `ON_ERROR_STOP=1` apply of prelude+baseline+buckets on a
   clean PG 17.6 → exit 0, object counts equal prod (verification.md §1).
2. Semantic parity: same introspection both sides, normalized diff = 0
   content lines (§2; the only residue is the 4 documented owner-model grant
   lines).
3. Behavioral parity: `rls-verify.sql` exit 0 against the rebuild (§3).
4. Type gates: `tsc` green for web/desktop/mobile; web `vitest` green.

## 6. Atomic execution plan

| Commit | Content | Gates |
|---|---|---|
| C1 | spec.md + plan.md + tools/ + verification.md | n/a (docs) |
| C2 | baseline + buckets + archive move + config.toml + migrations/README.md | apply-on-fresh + semantic diff + rls-verify (already executed; evidence committed) |
| C3 | Database types regeneration + `types:generate` script | tsc web/desktop/mobile, vitest web |
| C4 | rls-verify harness alignment (rls-verify.sql, tests/README.md) | rls-verify exit 0 against rebuild |
