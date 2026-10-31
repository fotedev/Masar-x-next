# Spec 031 — execution plan (atomic commits)

Branch: `feat/031-migration-consolidation` (worktree-isolated, off origin/main
`18ee229`). Prod policy: ZERO writes — read-only introspection only.

## Phase A — evidence collection (done 2026-10-31, before spec freeze)

- A1 Step-0 checks: CLI auth verified via the machine-local `supabase-masarx`
  MCP token (`supabase projects list` shows Masar-x); prod facts
  (`waitlist`/`quiz_attempts`/`quiz_answers` exist; `platform_settings` =
  `key,value,updated_at`; 5 buckets).
- A2 Generator built (`tools/q_*.sql` + `extract.cjs`) — DDL from prod
  catalogs via the Management API query endpoint (read-only), sections:
  types, tables, fks, functions, deferred-defaults, indexes, views,
  triggers, policies, grants, default-ACL documentation.
- A3 Verification loop on portable PG 17.6.1 (sha256-verified):
  prelude (roles + auth emulation) → baseline → buckets; three generator
  fixes found by the loop (view reloptions before `AS`,
  schemas-before-extensions so pgcrypto installs, COMMIT terminator) and
  two harness-gap discoveries (auth.users columns needed by views).

## Phase B — commits

- B1 **C1 `docs(spec): 031 migration consolidation — spec, tools, verification evidence`**
  specs/031-migration-consolidation/{spec.md,plan.md,verification.md,tools/}
- B2 **C2 `feat(db): baseline migration chain — prod schema snapshot + buckets`**
  supabase/migrations/{20261031000000_baseline.sql,20261031000001_storage_buckets.sql,README.md},
  supabase/migrations-archive/**, supabase/config.toml
- B3 **C3 `refactor(shared): generate Database types from production schema`**
  packages/shared/src/types/database.ts, root package.json (`types:generate`)
- B4 **C4 `test(rls): align harness with live prod schema semantics`**
  supabase/tests/rls-verify.sql, supabase/tests/README.md

## Phase C — gates & closeout

- C1 pnpm install in the worktree; tsc: web, desktop, mobile; vitest: web.
- C2 PR with the verification summary; update-branch; squash merge (no
  --admin); delete claim + worktree; memory update.

## Cross-cutting concerns

- **Never edit the baseline after merge** — fix forward (migrations/README.md).
- Future migrations: timestamp-prefixed file names matching the ledger
  version written by the `supabase-masarx` MCP.
- `Database` type is generated, not hand-edited; regeneration path documented
  in the file header and migrations/README.md.
- Out of scope: `migrations.old/` (local-only, untouched); the audit backlog
  tracks (AI hardening, quiz authoring, error boundaries).
