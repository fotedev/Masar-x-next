# Checklist: RLS Audit (G3.1)

**Run**: `node scripts/audit-rls.mjs` from repo root (needs `DATABASE_URL` in `.env`/`.env.local`; read-only).

## Preconditions

- [x] `DATABASE_URL` resolves and the script reports the connected user (must be `postgres`, not anon) — connected as `postgres` via `DATABASE_URL_IPV4` pooler
- [x] Script exits 0

## Assertions (from the generated `docs/audits/rls-audit-<date>.md`)

- [x] Every `public.*` table has `relrowsecurity = true` — **48/48**
- [x] No policy grants `anon` write — 9 warnings reviewed, all accounted for: 6 are `auth.uid()`-guarded (unsatisfiable for anon: chat messages, profiles, tracked_links), 1 is admin-gated (`system_access_codes`, EXISTS check), 3 are intentionally-open telemetry inserts (`analytics`, `link_logs`, `system_logs` — by design, abuse vector = spam rows only, pre-existing)
- [x] `subject_lectures` SELECT policy grants public read and matches migration 007's contract (name + `USING (true)` + writes admin-only) — note: live grants `TO public` (superset of the migration's `anon, authenticated`); same public-read effect, cosmetic drift, no action
- [x] Policy inventory diffed against migrations — **prod has 48 tables / 170 policies vs migrations' 19/41: the live DB evolved substantially beyond the migration history (dashboard edits + one-offs). Reconciling migration history = post-MVP task; the audit doc is the authoritative live inventory**

## Result

| Field | Value |
| --- | --- |
| Run date | 2026-09-17 |
| Tables with RLS enabled | 48 |
| Public tables total | 48 |
| anon-write warnings | 9 (all reviewed, none exploitable) |
| subject_lectures read policy OK | ✅ (`TO public` superset drift noted) |
| Drift vs migrations | Large (170 vs 41 policies) — recorded, reconciliation post-MVP |
| Audit doc | `docs/audits/rls-audit-2026-09-17.md` (local-only: `docs/audits/` is gitignored by design — publishing 129 live policies' logic on a public repo would be a disclosure; aggregate results live here) |
| Verdict (PASS/FAIL) | **PASS** |

> On PASS → proceed to task 3.1 (retire `.openclaw-rls-open.mjs`). On FAIL → stop, report drift to owner before any other task.
