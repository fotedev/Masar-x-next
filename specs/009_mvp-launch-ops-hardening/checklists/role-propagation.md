# Checklist: Admin Role-Change Propagation (G3.4)

**Purpose**: prove that revoking `app_metadata.role` actually removes admin access at token refresh (UI + RLS), not just on next login.

## Steps (owner-assisted; use a disposable test account)

1. [ ] Promote test account to admin (`app_metadata.role = "admin"`), fresh login → admin UI accessible, can write
2. [ ] Demote the account (role removed) **without logging out**
3. [ ] Trigger token refresh (Supabase JS refreshes hourly; force via sign-out/sign-in of another tab, or wait) → record observed delay
4. [ ] After refresh: admin UI denies (`AuthContext.tsx` `isAdmin === false`)
5. [ ] RLS still blocks the write server-side (attempt admin write via API/session → denied)
6. [ ] Document the worst-case staleness window (old JWT lifetime)

## Result

| Field | Value |
| --- | --- |
| Test date | _pending_ |
| UI drops access after refresh | _pending_ |
| RLS blocks write with stale UI | _pending_ |
| Max staleness window observed | _pending_ |
| Verdict (PASS/FAIL) | _pending_ |

> On FAIL: escalate to owner — a revocation gap is a security finding, not a UX note.
