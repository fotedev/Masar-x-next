# Checklist: Authenticated Smoke (G1.1 gate — owner-assisted, not CI)

**Purpose**: prove the full authenticated content pipeline in production before real content entry. Deliberately not automated (no credentials in CI, owner decision 2026-09-17).

## Steps (production site, admin account)

1. [ ] Log in as admin (staff role) — login + session persist across reload
2. [ ] Open admin dashboard — overview/analytics renders with real numbers
3. [ ] Upload one summary file (`add-file` form → Cloudinary preset) — succeeds, appears in listing
4. [ ] Open the summary in a logged-out (incognito) browser — publicly visible
5. [ ] Delete/adjust the test item if it was throwaway (or keep as seed content)

## Result

| Field | Value |
| --- | --- |
| Test date | _pending_ |
| Admin login OK | _pending_ |
| Upload OK | _pending_ |
| Public visibility OK | _pending_ |
| Verdict (PASS/FAIL) | _pending_ |

> On PASS → G1.1's code-path half is proven; remaining G1.1 work is purely operational (populate launch cohorts, optionally `pnpm seed:launch --dry-run` reconcile first).
