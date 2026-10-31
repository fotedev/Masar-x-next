# supabase/migrations-archive — retired migration chains

## numbered-chain-001-019/ (retired 2026-10-31, spec 031)

The numbered chain (`001`–`019`, including a duplicated `014` prefix) was the
repo's migration history from 2026-09 onward — but it could never rebuild the
production database from scratch. Production was actually built from an older
lineage (preserved locally as `supabase/migrations.old/`, never committed), so
the numbered chain referenced objects that did not exist at its own point in
the chain. Confirmed hard breaks on a fresh database:

- `010`: missing `public.is_admin()`, `summaries.status`,
  DROP POLICY on absent `system_access_codes`, `quizzes.user_id`
- `011`: DROP POLICY on absent `public.analytics` and `public.link_logs`
  (the latter has no CREATE TABLE anywhere in the repo)
- `012`: `admins.role` column (prod-only shape)
- `013`: `platform_settings` column-name mismatch (`key/value` vs the chain's
  `setting_key/setting_value`)
- `011`/`015`/`016`/`017`: runtime-read absent tables (`appeals`, `news`,
  `analytics`, `assistant_messages`)
- ~30 production-required tables had no DDL in the chain at all
  (`appeals`, `news`, `analytics`, `assistant_messages`, `link_logs`,
  `system_access_codes`, `quiz_attempts`, `quiz_answers`, the nine `trw_*`
  tables, `user_progress`, academic options tables, …)

These files are kept for archaeology and audit cross-referencing only. They
are **not** applied by anything. The rebuildable chain starts at
`supabase/migrations/20261031000000_baseline.sql`.
