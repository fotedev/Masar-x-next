# Spec 013 — Tasks

## A. Database migration (`supabase/migrations/013_semester_management.sql`)
- [x] A1. Widen `profiles.semester` CHECK to 1..3 (dynamic constraint lookup/drop)
- [x] A2. Add `semester_manually_set`, `semester_updated_at`
- [x] A3. Backfill `platform_settings['default_semester']` from `active_semester`
- [x] A4. Extend `handle_new_user()` (preserve FIX body; semester default + manual flag)
- [x] A5. `admin_migrate_student_semesters` RPC (atomic UPDATE, manual-flag skip, admins exclusion, default upsert, count return) + grants
- [x] A6. Verify against live Supabase (pre-checks) then apply; post-verify columns/privileges/function
- [x] A7. Seed: add `default_semester` row to `supabase/seed.sql`

## B. Shared (`packages/shared`)
- [x] B1. `database.ts` profiles Row/Insert/Update += `semester_manually_set`, `semester_updated_at`
- [x] B2. `ProfileSchema` += the two fields
- [x] B3. i18n ar/en: `onboarding.academic.term3`, `header.semesterLabel`, `adminDashboard.pageManagementTab` admin-control keys, `addSubjectModal.semester3`

## C. Effective semester resolution (web)
- [x] C1. `useEffectiveSemester.ts` (profile → guest localStorage → default; event + storage listeners)
- [x] C2. `PlatformSettingsContext` + `usePlatformSettings` → `default_semester` key/rename, drop `setActiveSemester`, local `defaultSemesterChanged` event listener

## D. Student switcher
- [x] D1. `useUserAcademic.setUserSemester` (one-statement update + manual flag + cache/invalidations)
- [x] D2. `setUserAcademic` sets `semester_manually_set` (onboarding false / profile-edit true)
- [x] D3. `StudentSemesterSwitcher` component (guest + user paths, optimistic + revert, i18n)
- [x] D4. Mount in `Header` (desktop) and `header/MobileNav` drawer

## E. Admin control
- [x] E1. `SemesterAdminControl` (selector + two-step confirm + RPC + count toast + force checkbox)
- [x] E2. `PageManagementTab` uses `defaultSemester` + new control; retire `SemesterSwitcher` to `.trash/`

## F. Consumer cleanup
- [x] F1. `useSubjects` → effective semester (keep correct `.or()` chains, coerced numbers)
- [x] F2. `SubjectsGrid` + `HomeClient` — remove duplicate semester filters
- [x] F3. `useAdminFilters`, `useAddSubjectForm` → `defaultSemester`
- [x] F4. Onboarding page + subject form: summer option

## G. Gates
- [x] G1. `tsc`, eslint ratchet (≤52), web vitest, `pnpm build`
- [x] G1b. Playwright e2e 2026-09-23: 5 passed / 0 failed (home + subjects shell, ar+en — the semester-filtered surfaces); 3 skipped by design (prod-smoke opt-in, subject-detail needs public seed data)
- [x] G2. Server-side verification 2026-09-23 (read-only SQL on prod): RPC partition = 4 passive→migrate, 1 manual→protected, 3 admins→excluded; live `handle_new_user` prosrc confirmed inheriting `default_semester`. Remaining owner smoke: profile save + one real admin migrate click.

## H. Owner amendment — profile-only placement (2026-09-22)
- [x] H1. Remove switcher from Header.tsx + header/MobileNav.tsx; retire component to .trash/
- [x] H2. Profile academic form = single student entry (summer option live in 3a20ff2); setUserAcademic stamps semester_updated_at on manual path
- [x] H3. Remove dead setUserSemester; resolution layer (useEffectiveSemester) unchanged
