# Spec 015 — Tasks

Mirror of §4 in `spec.md`. Authors: copy/own these tasks onto the PR description; tick them as they land.

## A. Test scaffolding (unit + static regression)
- [ ] A1. `apps/web/src/hooks/__tests__/useSubjects.test.ts` — static `is_academic` regex assertion on the `queryFn` body + dynamic test via mocked `@/lib/supabase/client` + mocked `useAuth`/`useUserAcademic`/`useEffectiveSemester`. Must fail if the PostgREST call adds back `is_academic.eq…` or `is_academic.is.null…` clauses.
- [ ] A2. `apps/web/src/components/__tests__/SubjectsGrid.type-test.ts` — single `@ts-expect-error` line on `<SubjectsGrid is_academic={false} />`. Must produce a tsc error if the prop is re-added.
- [ ] A3. `apps/web/src/app/[locale]/non-academic/[subject]/__tests__/page.test.tsx` — static `from("subjects")` regex assertion (false in the page body) + dynamic render-and-record-of-supabase-calls test. Must fail if the page starts reading from `subjects` again, or if it stops filtering `trw_categories.is_published`.
- [ ] A4. `apps/web/src/test/mocks/supabase.ts` (only if no equivalent exists). Builder that returns a chained query whose every call is recorded into an array; `vi.clearAllMocks()` between tests.

## B. Production-traffic tests (e2e)
- [ ] B1. `apps/web/e2e/trw-gate.spec.ts` — three scenarios:
  - B1.a Anonymous → `/ar/non-academic` → redirected to `/`.
  - B1.b Anonymous → `/ar/non-academic/<slug>` → either redirected to `/` or shown the existing "Access Denied" sentinel.
  - B1.c Anonymous → `/ar` → page must NOT contain the `emptyNonAcademicTitle` / `emptyNonAcademicDescription` i18n strings on the academic grid (regression check for the removed `is_academic ? … : …` ternary).
- [ ] B2. `apps/web/e2e/subjects-catalog.spec.ts` — signed-in (existing seed user, profile semester = 1, level = 1) visits `/ar/subjects` → at least one subject card visible → none of the rendered cards carry the `emptyNonAcademic*` empty-state copy. If the seed user isn't portable, leave `test.skip()` with TODO referencing the seed-spec concern (NOT a hard failure).

## C. Gates
- [ ] C1. From `apps/web`:
  - `pnpm typecheck` — exit 0
  - `pnpm test --run` — exit 0; new test count +5 minimum vs the 89 baseline
  - `pnpm build` — exit 0; route table still lists `/[locale]/non-academic/[subject]`
  - `pnpm lint` — exit 0; warnings ≤ 52 (baseline)
- [ ] C2. **Manual regression proof** (do once, then revert):
  1. In `apps/web/src/hooks/useSubjects.ts`, re-introduce `query = query.or("is_academic.eq.true,is_academic.is.null");` inside the `!isAdmin` block.
  2. Run only `pnpm test --run useSubjects` and confirm the static AND dynamic assertions go red.
  3. `git checkout apps/web/src/hooks/useSubjects.ts` to revert. Do NOT keep the broken state.
- [ ] C3. Commit on `refactor/decouple-trw-subjects`. Either:
  - fixup into `fbeaf83` (one squash commit `fbeaf83` → new hash, message keeps Phase 1 wording), or
  - add a separate commit on the same branch. Author's discretion; do NOT push a new branch.
  - Push the branch (`git push origin refactor/decouple-trw-subjects`).
- [ ] C4. PR description should call out: "Phase 1 + safety net (5 tests, 1 type-test). Closes the regression vectors identified in spec §1." Link this spec file in the PR body.

---

## Done-when (from spec §3 — quick reference)

- typecheck green
- vitest green, ≥+5 tests
- build green
- lint green
- manual regression proof recorded (the deliberate-broken run)
- same branch, not a new PR
