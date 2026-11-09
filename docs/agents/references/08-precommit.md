# Pre-commit / pre-merge checklist

Before opening a PR:

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes (security-guard rules fail the build — see `ai-endpoint-grep` in `ci.yml`)
- [ ] `pnpm test` passes
- [ ] No hardcoded Arabic strings added (grep `apps/web/src --include='*.tsx' --include='*.ts'` for non-comment lines containing Arabic chars)
- [ ] No new deps without updating root `pnpm-lock.yaml` via `pnpm install`
- [ ] If the task hits a §10 trigger: a spec exists in a numbered `specs/` dir (separators vary, e.g. `038-subject-anchoring`) and was approved by the user **before** code changes
- [ ] If you touched `supabase/`: new migration is timestamped `YYYYMMDDHHMMSS_name.sql` in `supabase/migrations/` (legacy sequential `NNN_` chain archived at `supabase/migrations-archive/numbered-chain-001-019/`)
- [ ] If you touched `ThemeScript.tsx`: re-read [01-gotchas.md](./01-gotchas.md) §19 before any change

**Back to:** [AGENTS.md](../../../AGENTS.md)
