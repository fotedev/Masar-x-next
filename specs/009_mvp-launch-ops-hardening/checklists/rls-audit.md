# Checklist: RLS Audit (G3.1)

**Run**: `node scripts/audit-rls.mjs` from repo root (needs `DATABASE_URL` in `.env`/`.env.local`; read-only).

## Preconditions

- [ ] `DATABASE_URL` resolves and the script reports the connected user (must be `postgres`, not anon)
- [ ] Script exits 0

## Assertions (from the generated `docs/audits/rls-audit-<date>.md`)

- [ ] Every `public.*` table has `relrowsecurity = true`
- [ ] No policy grants `anon` write (INSERT/UPDATE/DELETE) — warnings list is empty or explained
- [ ] `subject_lectures` SELECT policy grants read to `anon, authenticated` and matches `supabase/migrations/007_subject_lectures.sql` ("Anyone can view subject lectures")
- [ ] Policy inventory diffed against migrations 002–007 — no policy in prod that migrations don't declare (and vice versa)

## Result

| Field | Value |
| --- | --- |
| Run date | _pending_ |
| Tables with RLS enabled | _pending_ |
| Public tables total | _pending_ |
| anon-write warnings | _pending_ |
| subject_lectures read policy OK | _pending_ |
| Drift vs migrations | _pending_ |
| Audit doc | `docs/audits/rls-audit-____-__-__.md` |
| Verdict (PASS/FAIL) | _pending_ |

> On PASS → proceed to task 3.1 (retire `.openclaw-rls-open.mjs`). On FAIL → stop, report drift to owner before any other task.
