# F17 — Admin analytics RPC authorization (completed)

Date: 2026-09-25

## Production functions guarded

- `public.get_admin_analytics_summary()`
- `public.get_content_analytics_internal()`

## Guard pattern

Both functions:

- remain `SECURITY DEFINER`
- call `public.is_admin()` before reading analytics data
- raise `unauthorized` for non-admin callers
- use `SET search_path = ''`
- qualify referenced tables and functions
- revoke execution from `PUBLIC` and `anon`
- grant execution to `authenticated`

`get_admin_analytics_summary()` preserves its existing six-key JSON contract for admins.

`get_content_analytics_internal()` was converted from `sql` to `plpgsql` so it can raise an explicit exception. It preserves its existing six-column TABLE contract for admins.

## Production verification

- Preflight for `get_admin_analytics_summary()` ran in a transaction and rolled back:
  - authenticated non-admin received `unauthorized`
  - real admin received the prior six-key JSON shape
- Production apply completed.
- Preflight for `get_content_analytics_internal()` renamed the old function to a transaction-local baseline, compared every admin row, and rolled back.
- Production apply completed.
- Live HTTP tests confirmed:
  - authenticated non-admin: `unauthorized`
  - real admin: `200` with unchanged contract
  - `anon`: no execute permission
- The admin UI maps database `unauthorized` errors to the existing bilingual `errors.unauthorized` message instead of crashing or showing a generic load failure.

## Migrations

- `supabase/migrations/015_admin_analytics_authorization.sql`
- `supabase/migrations/016_content_analytics_authorization.sql`
