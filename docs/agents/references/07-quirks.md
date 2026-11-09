# Project-specific quirks

- **Bilingual by design**: every user-facing string has `ar` + `en` entries under `packages/shared/src/messages/`. Missing key → build/console warning, not a runtime crash, but DO fix before merging.
- **RTL**: `next-intl` handles `<html dir>`. Components use logical CSS (`ms-`, `me-`, `border-e-`) — never `left/right`.
- **Dark mode**: calibrated for late-night study, not just inverted. Theme switching must use the native `<script>` pattern in `apps/web/src/components/ThemeScript.tsx` (see [01-gotchas.md](./01-gotchas.md) §19).
- **Service-role key**: NEVER in `NEXT_PUBLIC_*`. NEVER pasted in chat/CLI args.
- **Hardcoded strings prohibition**: any Arabic string inside `.tsx`/`.ts` that's not in `messages/ar/*.json` is a defect — migrate on touch.
- **Supabase migrations**: since the spec-031 consolidation, migrations are timestamped and append-only from `20261031000000_baseline.sql` (a production-schema snapshot) — not sequential `NNN_name.sql`. A new migration takes a fresh `YYYYMMDDHHMMSS_name.sql` prefix matching the production migration ledger row (apply via the Supabase MCP `apply_migration`, never by hand); never edit an applied migration — fix forward — and never resurrect the old numbered chain (archived under `supabase/migrations-archive/numbered-chain-001-019/` for archaeology only).

**Back to:** [AGENTS.md](../../../AGENTS.md)
