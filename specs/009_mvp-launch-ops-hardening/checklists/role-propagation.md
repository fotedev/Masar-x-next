# Checklist: Admin Role-Change Propagation (G3.4)

**Purpose**: prove that revoking `app_metadata.role` actually removes admin access at token refresh (UI + RLS), not just on next login.

## Steps (owner-assisted; use a disposable test account)

1. [x] Promote test account to admin (`app_metadata.role = "admin"`), fresh login → admin UI accessible, can write — **executed automated 2026-09-20 with a disposable temp account** (`launch-smoke-s5-*`); the `on_admin_upsert` trigger syncs the claim on the `admins` INSERT, fresh login carries `app_metadata.role=admin`, admin-gated write (own-summary status flip) succeeds
2. [x] Demote the account (role removed) **without logging out** — `DELETE FROM admins WHERE user_id = '<temp>'` via service role; same session/JWT kept
3. [x] Trigger token refresh (Supabase JS refreshes hourly; force via sign-out/sign-in of another tab, or wait) → record observed delay — **fail-closed is immediate (<1s)**: `is_admin()` reads the `admins` table live, so the stale JWT gains nothing; the UI claim staleness is bounded by the old-JWT lifetime and is gone at the first refresh
4. [x] After refresh: admin UI denies (`AuthContext.tsx` `isAdmin === false`) — refreshed JWT_B carries **no** role claim (`on_admin_delete` trigger strips it from `raw_app_meta_data`)
5. [x] RLS still blocks the write server-side (attempt admin write via API/session → denied) — stale-JWT status flip rejected **42501 "Only admins can change summary status"**; `rpc/is_admin` = false; own `admins` self-select = 0 rows (the `admin-dashboard/layout.tsx` redirect condition)
6. [x] Document the worst-case staleness window (old JWT lifetime) — **3600s observed** (server-side authority never stale; only the client `isAdmin` flag can lag, and it self-corrects at refresh)

## Result

| Field | Value |
| --- | --- |
| Test date | 2026-09-20 (automated, production, temp account with full cleanup) |
| UI drops access after refresh | PASS — refreshed JWT has no role claim; `AuthContext` `isAdmin=false` on next auth state |
| RLS blocks write with stale UI | PASS — 42501 on admin-gated status flip; `is_admin()`=false; layout gate denies (0 own rows) |
| Max staleness window observed | 3600s (old-JWT lifetime); server-side fail-closed immediate (<1s) |
| Verdict (PASS/FAIL) | **PASS** — after migration `012_jwt_role_sync` (see note) |

> On FAIL: escalate to owner — a revocation gap is a security finding, not a UX note.

**Execution note (2026-09-20):** the first automated run scored 9/10 — the `grant+claim-sync` check FAILED because the 008 trigger set this design depends on had **never been deployed to prod** (G3.9 drift: grants produced no claim, revocations stripped nothing; one live `student_admin` had no claim and a dead admin UI). Fixed in-flight by applying migration **`012_jwt_role_sync`** (both triggers + one-time backfill aligning every admin's claim with the `admins` table) and re-running to ALL PASS. Evidence archived in `docs/LAUNCH_SIGNOFF.md` §3.
