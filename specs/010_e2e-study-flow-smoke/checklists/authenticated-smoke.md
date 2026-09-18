# Checklist: Authenticated Smoke (G1.1 gate — owner-assisted, not CI)

**Purpose**: prove the full authenticated content pipeline in production before real content entry. Deliberately not automated (no credentials in CI, owner decision 2026-09-17).

## Steps (production site, admin account)

1. [ ] Log in as admin (staff role) — login + session persist across reload
2. [ ] Open admin dashboard — overview/analytics renders with real numbers
3. [x] Upload one summary file (`add-file` form → Cloudinary preset) — **upload plumbing proven 2026-09-17 via the exact client contract** (curl unsigned-preset POST to cloud `de3emq8l3` / preset `masarx-uploads`: upload 200 → fetch-back 200 → destroy `ok`; probe asset cleaned up). Vars provisioned in Vercel prod+preview + local `.env.local`. Browser-flow confirmation via this checklist pending owner session
4. [ ] Open the summary in a logged-out (incognito) browser — publicly visible
5. [ ] Delete/adjust the test item if it was throwaway (or keep as seed content)

## Result

| Field | Value |
| --- | --- |
| Test date | 2026-09-17 (upload plumbing via curl); browser flow pending owner |
| Admin login OK | _pending owner_ |
| Upload OK | ✅ plumbing (curl proof); browser flow pending |
| Public visibility OK | ✅ fetch-back 200 (curl); browser flow pending |
| Verdict (PASS/FAIL) | **PARTIAL PASS — infrastructure proven; browser flow owner-assisted** |
