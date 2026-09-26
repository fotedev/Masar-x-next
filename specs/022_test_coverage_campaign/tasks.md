# Spec 022 — Tasks

Mirror of spec §2.2/§4. Tick as they land.

## Stage 0 — setup
- [x] S0.1 Branch `feat/022-test-coverage` from current HEAD (`fcf9dfd`).
- [x] S0.2 Write spec 022 (this file pair) + update spec 015 status line.
- [x] S0.3 Commit specs 015 (previously untracked) + 022 together, pathspec-limited.

## Stage 1 — web test infrastructure
- [ ] S1.1 vitest.config.ts: `.test.tsx` in include glob, jsdom via environmentMatchGlobs for tsx, setupFiles.
- [ ] S1.2 devDeps: jsdom, @testing-library/react@^16, @testing-library/jest-dom@^6, @vitest/coverage-v8@2.1.8; `test:coverage` script.
- [ ] S1.3 `src/test/setup.ts`, `src/test/mocks/supabase.ts` (chain recorder), `src/test/utils/render.tsx` (QueryClient + renderHook).
- [ ] S1.4 Smoke-prove infra: one trivial `.test.tsx` renders a component green.

## Stage 2 — packages/shared
- [ ] S2.1 vitest@2.1.8 devDep + vitest.config + `test` script in package.json.
- [ ] S2.2 Tests: schemas, format, supabase factory, ai helpers, i18n helpers.

## Stage 3 — web lib/ remainder
- [ ] S3.x Cover remaining untested lib/ files by risk (queryCache, supabase wrappers, i18n utils, remaining ai/, validation).

## Stage 4 — web hooks/
- [ ] S4.x useSubjects (current-state lock), useTRW*, useQuiz*, useCourses, useAiChat, useChatHistory + rest.

## Stage 5 — contexts + actions + utils
- [ ] S5.x AuthContext, ThemeContext, actions, utils.

## Stage 6 — critical components (.test.tsx)
- [ ] S6.x SubjectsGrid, TRWAccessGate, ChatInput/ChatContainer smoke, QuizPlayer core, copy/retry.

## Stage 7 — mobile
- [ ] S7.1 Explicit vitest.config.ts.
- [ ] S7.2 Remaining lib/ files covered.

## Stage 8 — desktop
- [ ] S8.1 Fix @vitest/coverage-v8 version mismatch.

## Stage 9 — e2e (015 re-baselined)
- [ ] S9.1 `e2e/subjects-catalog.spec.ts`.
- [ ] S9.2 `e2e/trw-gate.spec.ts` scenarios a/b (c deferred to TRW PR merge).

## Stage 10 — gates + docs
- [ ] S10.1 `pnpm -r --if-present test` green everywhere.
- [ ] S10.2 web typecheck + lint (≤52) + build green.
- [ ] S10.3 Coverage report (informational) for web + shared + mobile.
- [ ] S10.4 Update spec 015 status; memory entry; final report.

## Done-when
All Stage 10 boxes + spec §3 acceptance criteria green.
