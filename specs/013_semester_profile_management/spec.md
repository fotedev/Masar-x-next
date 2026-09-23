# Spec 013 — Lightweight semester management (profile-driven display filtering)

**Status:** APPROVED 2026-09-22 (owner drove plan-mode after explicitly rejecting a heavier state-machine design; 5 owner-supplied edge cases folded in)
**Input:** Owner direction: organization/UX only — no security gates, no term lifecycle tables, student profile semester is the single controller.
**MVP-lock:** compliant (I12 lifted) — additive, KISS, no new tables.

## 1. Context & problem statement

Today "the active semester" is one global row `platform_settings['active_semester']` (`PlatformSettingsContext.tsx`, realtime-broadcast to every client). `useSubjects.ts` resolves the browsing semester as `Number(activeSemester) || Number(academic.semester) || 1` — **the global value wins over the student's own profile semester**, so when the admin flips the global switch, every student's view flips too, and students who need a previous term's materials have no way back. The platform also "looks stale" to returning students at term start until each one manually re-picks.

Owner decision: the fix is **profile-driven display filtering + two admin controls** (global default for new signups; one-click bulk migration of existing students). Student autonomy is absolute: they can switch their own semester at any time; nothing is ever locked or URL-blocked; past-term materials stay reachable.

### 1.1 Adjudicated exploration claim (I10)

Plan-mode exploration claimed `useSubjects.ts:75-76`'s chained `.or()` filters "OR all conditions together" (a correctness bug). **REJECTED after reading the installed supabase-js source**: `node_modules/@supabase/postgrest-js/dist/index.mjs:1978` shows `or()` uses `searchParams.append` — chained `.or()` calls produce **separate `or=` query params, which PostgREST AND-combines**. The current filter chain is semantically correct: `(is_academic…) AND (level = L OR level IS NULL) AND (semester = S OR semester IS NULL)`. No query-builder rewrite is needed; the real defect is only the effective-semester resolution. (Corrects the earlier diagnosis per the self-documentation protocol.)

## 2. Design

### 2.1 Database — `supabase/migrations/013_semester_management.sql`

1. **Widen `profiles.semester`** to 1|2|3 (3 = summer): drop the existing `CHECK (semester BETWEEN 1 AND 2)` (constraint name looked up dynamically from `pg_constraint`), re-add `profiles_semester_range CHECK (semester IS NULL OR semester BETWEEN 1 AND 3)`.
2. **Intent-preservation columns**: `semester_manually_set boolean NOT NULL DEFAULT false`, `semester_updated_at timestamptz`.
3. **`platform_settings['default_semester']`** (`{"semester": N}` — same shape as `active_semester`), backfilled from the current `active_semester` value. The old `active_semester` row is left in place but stops being read.
4. **`handle_new_user()` extended** (full live body from `FIX_profiles_table.sql:81-95` preserved): new profiles get `semester = COALESCE((SELECT (value->>'semester')::int FROM platform_settings WHERE key='default_semester'), 1)`, `semester_manually_set = false`.
5. **`admin_migrate_student_semesters(p_target_semester int, p_overwrite_manual boolean DEFAULT false) RETURNS integer`** — SECURITY DEFINER, `public.is_admin()` guard, validates 1..3:
   - ONE atomic `UPDATE profiles SET semester=p_target, semester_manually_set=false, semester_updated_at=now() WHERE (COALESCE(NOT semester_manually_set,true) OR p_overwrite_manual) AND NOT EXISTS (SELECT 1 FROM admins WHERE user_id = profiles.id)`; returns migrated row count.
   - Upserts `default_semester` in the same transaction.
   - `GRANT EXECUTE … TO authenticated`; plus explicit `GRANT UPDATE ON public.profiles TO authenticated` (covers new columns regardless of default privileges; verified against `information_schema.column_privileges` post-apply).

### 2.2 Effective-semester resolution — `hooks/useEffectiveSemester.ts` (new)

`useEffectiveSemester(profileSemester?: number | null)`:
- signed-in → `profileSemester` → fallback guest localStorage → `default_semester`
- guest → `localStorage['masar_guest_semester']` → `default_semester`
Guest writes dispatch a window event (`masarGuestSemesterChanged`) — same pattern as the existing `activeSemesterChanged` flow. On login, profile.semester takes over automatically.

`PlatformSettingsContext` / `usePlatformSettings`: switch fetch + realtime filter + localStorage cache from `active_semester` → `default_semester`; expose `defaultSemester` (rename of `activeSemester`); drop `setActiveSemester` (the admin path goes through the RPC now); also listen for the local `defaultSemesterChanged` window event so the admin's own UI updates instantly without waiting for realtime.

### 2.3 Students — `StudentSemesterSwitcher` (new)

Compact 3-option control (ترم 1 / ترم 2 / صيفي). Mounted in `Header` desktop actions (lg+) and inside the `MobileNav` drawer.
- Signed-in: new `useUserAcademic().setUserSemester(s)` — targeted `UPDATE profiles SET semester=s, semester_manually_set=true, semester_updated_at=now()` (one statement, own-row RLS), local state + `academicCache` update, `queryCache.invalidatePrefix("subjects")` AND `queryClient.invalidateQueries({queryKey:["subjects"]})` (edge case #3: belt-and-braces invalidation so the visible grid updates without a refresh).
- Guest: `writeGuestSemester(s)` (localStorage + event). Button stays enabled for guests — no login forced (edge case #1).
- Optimistic UI with revert + toast on error; `mounted` guard to avoid SSR hydration mismatch.

`setUserAcademic` also gains `semester_manually_set`: `options?.manualSemester ?? (options?.isProfileUpdate ?? false)` — onboarding = passive (false, will be bulk-migrated later), profile-settings academic edit = explicit choice (true).

### 2.4 Admin — `SemesterAdminControl` (new, replaces `SemesterSwitcher` in `PageManagementTab`)

Default-semester selector + "apply to all students" two-step inline confirm → `admin_migrate_student_semesters` RPC → success toast with the migrated count; optional "include manually-set students" checkbox (`p_overwrite_manual`). All copy i18n'd via `adminDashboard.pageManagementTab` (fixes the hardcoded-Arabic `SemesterSwitcher`, I3). `PageManagementTab`'s subject filter switches from `activeSemester` to `defaultSemester`.

`SemesterSwitcher.tsx` is retired (moved to `.trash/` per I9 — approved by the plan).

### 2.5 Query & consumer cleanup

- `useSubjects`: `effectiveSemester` now comes from `useEffectiveSemester(academic.semester)` (profile-driven; level/semester always coerced to numbers — no `undefined` can reach PostgREST syntax, edge case #2). The three `.or()` chains stay (correct per §1.1).
- `SubjectsGrid.tsx` / `HomeClient.tsx`: client-side semester filters removed (the DB query is the single filter; client duplicates would fight the student's own selection). `show_on_home` handling kept.
- `useAdminFilters` / `useAddSubjectForm`: `activeSemester` → `defaultSemester` (new-subject default = default semester).
- Onboarding academic page + subject form: summer (3) option added (`onboarding.academic.term3`, `addSubjectModal.semester3`).

## 3. Edge-case ledger (owner-supplied + verified)

| # | Case | Resolution |
|---|---|---|
| 1 | Guest toggles the switcher | Never disabled; writes `masar_guest_semester` localStorage + event; resolver prefers it over `default_semester` |
| 2 | `level`/`semester` `undefined` interpolated into PostgREST → 400 | Resolver always returns a number (`?? default 1`); query builder only interpolates coerced numbers |
| 3 | Stale react-query cache after switch | Explicit `invalidateQueries(["subjects"])` + `queryCache.invalidatePrefix("subjects")` + semester in the queryKey |
| 4 | Bulk migration moves admin accounts | `NOT EXISTS (admins)` exclusion in the RPC WHERE |
| 5 | RLS/column privileges on new columns | Existing own-row UPDATE policy covers rows; explicit table-level `GRANT UPDATE` added and verified post-apply |
| 6 | Student chose a term before admin's bulk run | `semester_manually_set=true` rows skipped by default; admin force checkbox available |
| 7 | Student changes at the exact moment of bulk run | Bulk is a single statement: under READ COMMITTED the UPDATE waits on the row lock and re-evaluates the WHERE after the student's commit → sees `manually_set=true` → skipped |

After a migration students become passive again (`manually_set=false`), so the next term's migration moves them; a self-set student stays skipped until they pick a term themselves again (one tap) or the admin forces.

## 4. Out of scope (explicit)

No new tables; no RLS participation gates; no URL/content blocking; no term lifecycle states or overrides; `active_semester` row stays in the DB but stops being read; quizzes/news semester facets keep 1|2 (summer facet later if needed).
