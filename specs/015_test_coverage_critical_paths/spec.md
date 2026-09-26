# Spec 015 — Test coverage for critical paths (Phase 1 regression safety net)

**Status:** SUPERSEDED-BY-015-REBASELINE 2026-09-26 — see `specs/022_test_coverage_campaign/spec.md` §1. The TRW contracts (A/B/C) here were written against the unmerged `refactor/decouple-trw-subjects` branch (commit `fbeaf83`) and go red against main-state code (`useSubjects.ts` still has `is_academic`). These contract tests are **blocked-on-PR**: land them on the day `refactor/decouple-trw-subjects` merges. The broader coverage campaign runs as spec 022 on the current code state. Original status: DRAFT 2026-09-23, pending MVP Lock adjudication (§6.4 — adjudicated as approved via spec 022).
**Branch:** `refactor/decouple-trw-subjects` (extends the same PR; see §6.2)
**Inputs:**
- Spec 014 (refactor/decouple-trw-subjects, commit `fbeaf83`): `apps/web/src/hooks/useSubjects.ts`, `apps/web/src/components/SubjectsGrid.tsx`, `apps/web/src/app/[locale]/non-academic/[subject]/page.tsx` now treat `subjects` as **academic-only**, and `/non-academic` reads only from `trw_categories` + `trw_memberships`.
- Repo evidence: `apps/web/src/lib/__tests__/` has 11 vitest files (mostly utilities); `e2e/` has study-flow + guest-quiz only. No tests touch `useSubjects`, the TRW gate, or the `/non-academic` page. Estimated coverage ≈ 20–30% on critical paths (the question this spec answers).

**Goal:** lock the Phase 1 decoupling against regression with deterministic tests, and start lifting coverage on the riskiest paths before more code lands on top of the refactor.

**Out of scope:**
- Phase 2 DB migration (dropping `is_academic`) — separate spec.
- RLS policy integration tests against live Supabase — separate spec.
- Performance / load tests.
- Visual-regression coverage (Playwright screenshots are incidental, not asserted here).
- Backfilling tests for features unrelated to the TRW decoupling (e.g. quiz scoring, Zane AI chat).

---

## 1. Problem statement

The Phase 1 PR passed `tsc`, `pnpm build`, and the existing 89 vitest tests — but **none of those tests assert anything about the Phase 1 change**. A future contributor could:

1. Re-introduce `is_academic` filtering in `useSubjects` and the build would still be green.
2. Switch `/non-academic/[subject]` back to reading from the `subjects` table and `tsc` would still pass.
3. Re-add the `is_academic` prop to `SubjectsGrid` and the type-checker would still pass (props are structural).

These are exactly the kinds of regressions specs 005–013 spent time adjudicating. Without a test that names the contract, the next refactor will re-litigate the same ambiguity.

The risk is amplified by the multi-agent setup (ZCode owns `apps/web/**`, desktop owns `apps/desktop/**`; see AGENTS.md) — different agents reading the same code can reach different conclusions about "what was supposed to change" without executable artifacts.

This spec is **not** a request to reach 80% coverage. It targets the **three regression vectors** above plus the **two highest-traffic paths in production** (the TRW gate and the subjects catalog). Other paths (quiz attempts, summaries, AI chat streaming) are explicitly deferred.

---

## 2. Design

### 2.1 Test files (new)

```
apps/web/src/hooks/__tests__/useSubjects.test.ts        (unit, regression)
apps/web/src/components/__tests__/SubjectsGrid.test.tsx  (unit, regression)
apps/web/src/app/[locale]/non-academic/[subject]/__tests__/page.test.tsx  (unit, regression)
e2e/trw-gate.spec.ts                                    (e2e, highest-traffic)
e2e/subjects-catalog.spec.ts                            (e2e, highest-traffic)
```

The first three are the **regression net** for Phase 1 — each one fails if the relevant contract is violated. The last two are the **production-traffic net** for the two flows the Phase 1 change touches.

The three unit tests do **not** require a running DB or browser — they run inside vitest against mocked supabase + react-query. The e2e tests use the existing Playwright setup (`playwright.config.ts`) and existing seed data; if seed data is missing for the gate, the spec is allowed to be a smoke that just confirms the membership path rejects an anonymous user.

### 2.2 Contracts under test

#### Contract A — `useSubjects.queryFn` no longer references `is_academic`

This is the heart of Phase 1. Asserted at two layers:

- **Static:** the function body has no string literal `"is_academic"` in any PostgREST builder call. (`read_file` then simple substring check — implementation in §2.4.)
- **Dynamic:** when invoked through `renderHook` with a non-admin user, the PostgREST query passed to `supabase.from('subjects').select(...).or(...)` must not contain `is_academic` in any of its `.or(...)` arguments.

Both layers protect different classes of regression:
- Static catches a careless copy-paste from spec-013 history.
- Dynamic catches the same regression introduced by a refactor that doesn't keep the same call shape.

#### Contract B — `SubjectsGrid` does not accept an `is_academic` prop

Asserted via `expect(grid).not.toHaveProp('is_academic')` style check — actually, simpler: confirm the component's prop type does not include `is_academic` by rendering it twice with default props and asserting the rendered output is identical regardless of the (now-illegal) prop that TS would reject. Skip if too brittle — fall back to a TypeScript compile-time assertion via a `.test-d.ts` file that uses `@ts-expect-error`:

```ts
// SubjectsGrid.type-test.ts (no runtime cost)
import { SubjectsGrid } from "../SubjectsGrid";

// @ts-expect-error — is_academic is no longer a valid prop after Phase 1
<SubjectsGrid is_academic={false} />;
```

If `@ts-expect-error` triggers, the prop was re-added. If it doesn't trigger (the line compiles cleanly), the contract is broken. This is the cheapest regression catcher in the entire spec.

#### Contract C — `/non-academic/[subject]` reads from `trw_categories`, not `subjects`

Same pattern as A:
- Static: file body has no `from("subjects")` call.
- Dynamic: render the page with a mocked client (using `@/lib/supabase/client`); assert the call was made against `trw_categories` and that **no call went to `subjects`**.

Use Vitest's existing mocking helpers (`vi.mock`). No DB required.

#### Contract D — TRW gate end-to-end behavior (anonymous)

Three scenarios via Playwright:

1. **Anonymous user visits `/ar/non-academic`** → redirected to `/` (existing `useTRWMembership` behavior).
2. **Anonymous user visits `/ar/non-academic/<some-slug>`** → either redirected to `/` or shown an "Access Denied" sentinel — both are acceptable per the existing page (`non-academic/page.tsx:59-71`).
3. **The home page (`/ar`) does NOT contain a TRW SubjectsGrid rendered with a `null` `is_academic` flag.** Look for the empty-state copy "emptyNonAcademic…" — that key was removed in Phase 1, and if anyone re-adds the prop it would reappear.

#### Contract E — Subjects catalog end-to-end (signed-in)

One scenario:

- Sign in as a student whose profile semester = 1, level = 1 (existing seed data).
- Visit `/ar/subjects`.
- Expect at least one subject card rendered (assumes seed data populates the academic table).
- Expect **none** of the academic subjects to display the empty-state copy `emptyNonAcademicTitle` / `emptyNonAcademicDescription` (those keys were kept for now, but they must not render on the academic grid — a regression here would mean the grid is rendering the academic empty-state AND the non-academic copy simultaneously, which the old `is_academic ? … : …` ternary could do).

### 2.3 Test framework conventions

- **Unit:** follow existing patterns in `apps/web/src/lib/__tests__/` (vitest, `.test.ts` / `.test.tsx`, single-file).
- **Mocks:** use `vi.mock("@/lib/supabase/client", …)` and `vi.mock("@tanstack/react-query", …)` patterns already used elsewhere if any exist; otherwise introduce a minimal helper `src/test/mocks/supabase.ts` exporting a per-test builder that records all calls.
- **E2E:** follow existing patterns in `e2e/*.spec.ts`. Use the `ar` locale (`/ar/...`) to match the seed admin URL.
- **Coverage reporting:** do NOT add a coverage gate yet — the first run is informational. Add `vitest --coverage` to `pnpm test` only after this spec lands and the team agrees on a threshold.

### 2.4 Static-check implementation (Contract A & C)

The static check is intentionally trivial to keep the spec deterministic and zero-deps:

```ts
// apps/web/src/hooks/__tests__/useSubjects.test.ts
import * as fs from "node:fs";
import * as path from "node:path";

test("Phase 1 contract: useSubjects.queryFn has no 'is_academic' PostgREST clause", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "..", "useSubjects.ts"),
    "utf8",
  );
  // Slice to the queryFn body to avoid false positives in comments / unrelated strings.
  const queryFnStart = src.indexOf("queryFn: async");
  expect(queryFnStart).toBeGreaterThan(-1);
  const after = src.slice(queryFnStart);
  // Allow only in comments — strip line comments first.
  const codeOnly = after
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");
  expect(codeOnly).not.toMatch(/is_academic\.eq|is_academic\.is\.null/);
});
```

Equivalent for the `/non-academic/[subject]/page.tsx` static check (must not contain `from("subjects")`).

If the team later moves to a `"check-regex-no-deps"` ESLint rule, these inline checks can be deleted; for now they live with the test file to keep them discoverable.

### 2.5 Mocking strategy

**For Contract A & C (unit):**

- Mock `@/lib/supabase/client` to return a chained query builder whose `.or(...)`, `.select(...)`, `.eq(...)` arguments are collected into an array.
- Mock `useAuth` to return a non-admin, non-anonymous user with a fixed profile.
- Mock `useUserAcademic` to return `{ level: 1, semester: 1 }`.
- Assert against the collected arguments after `await waitFor(() => result.current.loading === false)`.

**For Contract D & E (e2e):**

- Reuse the existing `playwright.config.ts` and seed fixtures.
- For D-anonymous: no auth setup needed.
- For E-signed-in: assume an existing seed user (likely the admin from previous specs — `fotedev@…` or the canonical study-flow fixture). If the seed isn't portable, the spec is allowed to skip with `test.skip()` and a TODO — but the static / unit side still runs.

### 2.6 Where these tests live

| Test | Path | Why |
|---|---|---|
| `useSubjects.test.ts` | `apps/web/src/hooks/__tests__/` | Co-located with the hook it covers |
| `SubjectsGrid.test.tsx` | `apps/web/src/components/__tests__/` | Co-located with the component |
| `page.test.tsx` | `apps/web/src/app/[locale]/non-academic/[subject]/__tests__/` | Co-located with the page route |
| `SubjectsGrid.type-test.ts` | `apps/web/src/components/__tests__/` | Co-located; no runtime cost |
| `trw-gate.spec.ts` | `apps/web/e2e/` | Existing pattern |
| `subjects-catalog.spec.ts` | `apps/web/e2e/` | Existing pattern |

---

## 3. Acceptance criteria

This spec is done when **all of the following** are green:

- [ ] `cd apps/web && pnpm typecheck` exits 0
- [ ] `cd apps/web && pnpm test --run` exits 0 and the new test count is **+5 minimum** vs the current 89 (3 unit + 1 type-test + 2 e2e; the e2e count is allowed to vary if some scenarios become skips)
- [ ] `cd apps/web && pnpm build` exits 0 and the route table still contains `/[locale]/non-academic/[subject]`
- [ ] `cd apps/web && pnpm lint` exits 0 (or no new warnings vs the baseline `≤52` threshold)
- [ ] Static-regression assertions fail when deliberately violated (manual proof — re-introduce `is_academic.eq.true,is_academic.is.null` in `useSubjects` locally, run only `pnpm test --run useSubjects`, confirm the test goes red, revert)
- [ ] New tests are added under the same `refactor/decouple-trw-subjects` branch (no new PR) so the Phase 1 change ships with its safety net

This spec is **not** done when:
- ❌ A coverage % threshold is met (deferred)
- ❌ Other `e2e/` specs are touched (out of scope)
- ❌ `is_academic` is removed from the DB (Phase 2)

---

## 4. Tasks

### A. Test scaffolding
- [ ] A1. Create `apps/web/src/hooks/__tests__/useSubjects.test.ts` with the static check from §2.4 and one dynamic test using the mocked query builder for `Contract A`.
- [ ] A2. Create `apps/web/src/components/__tests__/SubjectsGrid.type-test.ts` (Contract B).
- [ ] A3. Create `apps/web/src/app/[locale]/non-academic/[subject]/__tests__/page.test.tsx` with the static check + dynamic test (Contract C).
- [ ] A4. Create `apps/web/src/test/mocks/supabase.ts` only if no equivalent already exists; otherwise reuse.

### B. Production-traffic tests (e2e)
- [ ] B1. Create `apps/web/e2e/trw-gate.spec.ts` with the three scenarios from §2.2-D.
- [ ] B2. Create `apps/web/e2e/subjects-catalog.spec.ts` with the signed-in scenario from §2.2-E. If the seed user isn't portable, leave a single `test.skip` with a TODO referencing the seed-spec concern.

### C. Gates
- [ ] C1. Run `pnpm typecheck`, `pnpm test --run`, `pnpm build`, `pnpm lint`. All green.
- [ ] C2. Manual regression proof per §3 acceptance bullet "Static-regression assertions fail when deliberately violated." Do this ONCE locally, then revert.
- [ ] C3. Append the new tests to the existing Phase 1 commit on `refactor/decouple-trw-subjects` (see §6.2 — squash or fixup, author's discretion; do **not** open a new PR).

---

## 5. Risks & open questions

- **Seed portability for E (signed-in subjects catalog):** if the admin seed used in spec-013's Playwright run is locked to a specific email, the e2e test will need credentials in `playwright.config.ts` or a `.env.test`. If that's not in place, the test is allowed to `test.skip` with a TODO. This is the only spec bullet with a graceful-degradation path; everything else is hard-required.
- **Vitest version mismatch:** `vitest run " --run"` in the earlier turn fed the `--run` flag via pnpm args; double-check that the command shape in §3-C1 still works. If not, drop the trailing `--run` (vitest's default in this repo is `run` per `vitest.config.ts`).
- **Speed budget:** the existing suite runs in ~2s. Three new vitest files should add <1s. Two new e2e specs will add 10–60s depending on Playwright warmup. That is acceptable for CI; flag it here so it isn't a surprise.
- **Coverage ratchet:** deliberately not added this round. The team's velocity policy needs an explicit threshold + per-PR delta rule before that becomes enforceable.

---

## 6. Appendix

### 6.1 Files inspected / referenced

- `apps/web/src/hooks/useSubjects.ts` — Phase 1 target.
- `apps/web/src/components/SubjectsGrid.tsx` — Phase 1 target.
- `apps/web/src/app/[locale]/non-academic/[subject]/page.tsx` — Phase 1 target.
- `apps/web/src/app/[locale]/non-academic/page.tsx` — TRW gate; not modified by this spec but consumed by Contract D.
- `apps/web/src/hooks/trw/useTRWCategories.ts`, `apps/web/src/hooks/trw/useTRWMembership.ts` — TRW data source, not modified.
- `apps/web/src/lib/queryCache.ts` — used by the page; not modified.
- `apps/web/src/types/database.ts` + `packages/shared/src/types/database.ts` — `Subject` row still carries `is_academic: boolean | null`. Phase 2 will drop it; Phase 1 leaves it untouched.

### 6.2 Branch / commit policy

Per the user direction that opened this spec:

> "اشتغل على branch جديد: refactor/decouple-trw-subjects عشان نحافظ على ثبات الـ main."

The Phase 1 commit is `fbeaf83` on `origin/refactor/decouple-trw-subjects`. The new tests from this spec are committed on the **same branch**, ideally fixup'd into `fbeaf83` so the PR diff cleanly shows "refactor + safety net" together. Do not push a separate branch.

### 6.3 Conventions used

This spec follows `specs/013_semester_profile_management/spec.md` — same frontmatter shape, same numbered sections, same "adjudicated claims" discipline (none here; this spec is small enough that the design IS the proof). Where this spec breaks convention (§4 lists tests as A/B/C rather than A/B/…/G), it's because the file count is small and the A/B/C grouping mirrors the spec's three-contract structure.

### 6.4 MVP Lock (I12) adjudication

`docs/agents/references/03-invariants.md#I12` (2026-09-14) says: *"no trivial/cosmetic/refactor work until MVP launch. Allowed only: blocking bugs, core study-flow stability, login + essential data, deployment readiness."*

This spec writes **test coverage that locks a refactor that already shipped** on the `refactor/decouple-trw-subjects` branch (commit `fbeaf83`). Reading I12 strictly, "test coverage" is not one of the four permitted buckets — but two read-paths justify treating it as in-scope:

1. **Argument from study-flow stability (allowed bucket 2):** the `/non-academic` gate and `/subjects` catalog are part of the student-facing study flow. Phase 1 changed both without a regression net. A future regression on either breaks study flow. Writing the net now is "study-flow stability" wearing a test-coverage hat.
2. **Argument from blocking-bug prevention (allowed bucket 1):** spec 014's §1 names **three specific regression vectors** that the next refactor will re-introduce without a test. Each of those is a one-line revert to a code path already shipping — i.e. a latent bug waiting on the next careless commit. Locking the contracts now pre-empts blocking bugs.

If the owner reads I12 more strictly and rejects both arguments, this spec should be **deferred until MVP launch**, not abandoned — `tasks.md` and `spec.md` stay on disk so the work can be re-picked in one PR after launch with zero rework. The disk artifacts have no runtime cost and zero risk to the MVP branch.

**Recommended owner decision message:** `Spec 015 APPROVED via I12-bucket-2 (study-flow stability). Tests lock the already-merged Phase 1 refactor against regression — no new features, no scope expansion, no schema changes.`

