# Project-specific quirks

- **Bilingual by design**: every user-facing string has `ar` + `en` entries under `packages/shared/src/messages/`. Missing key → build/console warning, not a runtime crash, but DO fix before merging.
- **RTL**: `next-intl` handles `<html dir>`. Components use logical CSS (`ms-`, `me-`, `border-e-`) — never `left/right`.
- **Dark mode**: calibrated for late-night study, not just inverted. Theme switching must use the native `<script>` pattern in `apps/web/src/components/ThemeScript.tsx` (see [01-gotchas.md](./01-gotchas.md) §19).
- **Service-role key**: NEVER in `NEXT_PUBLIC_*`. NEVER pasted in chat/CLI args.
- **Hardcoded strings prohibition**: any Arabic string inside `.tsx`/`.ts` that's not in `messages/ar/*.json` is a defect — migrate on touch.
- **Supabase migrations**: migrations use sequential `NNN_name.sql` prefixes (`001_` …). A new migration takes the next number in sequence — do not introduce timestamps, and do not reorder existing files.

**Back to:** [AGENTS.md §7](../../../../AGENTS.md)
