# Spec 022 — Unit test coverage campaign (logic layer + critical components)

**Status:** APPROVED 2026-09-26 — owner approved the re-baselined plan (I12 adjudication recorded in §6)
**Branch:** `feat/022-test-coverage` (from `fcf9dfd` on `feat/020-mobile-polish`'s line)
**Inputs:**
- Spec 015 (`specs/015_test_coverage_critical_paths/`) — the seed spec. Its TRW contracts (A/B/C) are written against the **unmerged** `refactor/decouple-trw-subjects` branch (commit `fbeaf83`) and would go red against current main-state code. This spec supersedes 015's *scope* (see §1) while keeping 015's TRW contract tests blocked-on-PR.
- Test landscape audit 2026-09-26: web 14 unit files (~107 cases, all in `lib/`), mobile 11 (~89), desktop 5, shared **0**. `hooks/` (38 files), `components/` (189), `contexts/`, `actions/`, `utils/` have zero coverage. Web vitest config runs `.test.ts` only in a node environment — no DOM, no Testing Library, so hook/component tests are not currently *runnable at all*.

**Goal:** full coverage of the **logic layer** (`packages/shared` entirely + web `lib/hooks/contexts/actions/utils` + remaining mobile `lib/`) plus contract tests for high-traffic components, executed against the **current** code state.

**Out of scope (explicit non-goals):**
- Render tests for all 189 web components / 78 pages (brittle, low value).
- Mobile screen tests (would need `@testing-library/react-native` — deferred).
- Spec 015 TRW contracts A/B/C — **blocked** until `refactor/decouple-trw-subjects` merges; then land 015's tests on that code.
- Coverage threshold gate (informational reports only this round, per 015 §2.3).
- RLS integration tests, load tests, visual regression.

---

## 1. Relationship to spec 015 (re-baseline rationale)

015 targeted one refactor's regression vectors. The owner's ask — "المشروع يتم تغطيته بالكامل بالاختبارات" — is broader. Executing 015 as written against current code is impossible (its contracts assert `is_academic` is *gone*; current code still has it at `useSubjects.ts:76`, `SubjectsGrid.tsx:13`, `non-academic/[subject]/page.tsx:54`). Decision: campaign on current code; 015's TRW tests wait for the merge. Until then, `useSubjects`/`SubjectsGrid` get **current-state** regression locks documenting the `is_academic` behavior that actually ships.

## 2. Design

### 2.1 Infrastructure (web) — prerequisite for everything
- `vitest.config.ts`: include `**/*.{test.ts,test.tsx}`; jsdom via `environmentMatchGlobs` for `.test.tsx` only; `setupFiles: src/test/setup.ts`.
- New devDeps (compatible with pinned `vitest@2.1.8` + React 19): `jsdom`, `@testing-library/react@^16`, `@testing-library/jest-dom@^6`, `@vitest/coverage-v8@2.1.8`; script `test:coverage`.
- `src/test/mocks/supabase.ts` — 015 task A4: chain-recording PostgREST query builder.
- `src/test/utils/render.tsx` — QueryClientProvider wrapper + `renderHook` helper.
- JSX handled by esbuild + tsconfig (`react-jsx`); wire `@vitejs/plugin-react` only if transform fails.

### 2.2 Test targets (per stage)
| Stage | Target | Approach |
|---|---|---|
| 2 | `packages/shared` (13 src files, 0 tests) | Add vitest + `test` script; cover zod schemas, format, supabase factory (mocked env), ai helpers, i18n helpers |
| 3 | web `lib/` remainder (~40 untested files) | node-env pure logic, pattern of existing 14 files; priority: queryCache, supabase wrappers, i18n utils, remaining ai/* |
| 4 | web `hooks/` (38) | renderHook + supabase mock + useAuth mock; `useSubjects` (current-state lock), `useTRW*`, `useQuiz*`, `useCourses`, `useAiChat` (event-driven persistence — highest value), `useChatHistory` |
| 5 | contexts (3) + actions (3) + utils | AuthContext (mock onAuthStateChange), ThemeContext, actions with mocked db |
| 6 | Critical components (~10–15 `.test.tsx`) | SubjectsGrid, TRWAccessGate, ChatInput/ChatContainer smoke, QuizPlayer core, copy/retry affordances |
| 7 | mobile | explicit `vitest.config.ts`; finish remaining ~4 `lib/` files |
| 8 | desktop | fix `@vitest/coverage-v8@^5` ↔ `vitest@^2.1.8` mismatch |
| 9 | e2e (015 re-baselined) | `subjects-catalog.spec.ts` (valid now); `trw-gate.spec.ts` scenarios a/b (gate exists via useTRWMembership); scenario c deferred to TRW PR |

### 2.3 Commit policy
Pathspec-limited commits per stage; parallel-session dirty files (root `package.json` engines/lint, `packages/shared/src/i18n/index.ts` namespaces, `apps/web/src/lib/ai/providers/` WIP, `next-env.d.ts`) are **never** staged. Conventional Commits (`test(scope): …`).

## 3. Acceptance criteria
- [ ] `pnpm -r --if-present test` green across all packages (incl. new shared suite)
- [ ] web `typecheck` + `lint` (≤52) + `build` green
- [ ] web unit tests roughly double (~107 → 220+); shared 0 → ~30+; total 280+
- [ ] Informational coverage report generated for web + shared + mobile
- [ ] Parallel-session files untouched/uncommitted
- [ ] specs 015+022 committed with updated checkboxes

## 4. Tasks
See `tasks.md`.

## 5. Risks
- vitest 2.1.8 + jsdom + RTL16 + React 19 wire-up — discovered/fixed in Stage 1 before the rest depends on it.
- Hooks needing QueryClient — one helper solves all.
- Parallel sessions racing git state — small pathspec commits.
- Scale (~50 new test files) — stages are independent; branch stays green after each stage.

## 6. MVP Lock (I12) adjudication
Owner approved this campaign directly on 2026-09-26 (plan approval = the §6.4-style owner decision 015 anticipated). Rationale buckets: study-flow stability (hooks/components under test are the study flow) and blocking-bug prevention (regression nets for logic with documented bug history — e.g. useAiChat persistence).
