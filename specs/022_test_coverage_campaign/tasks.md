# Spec 022 — Tasks

Mirror of spec §2.2/§4. Executed on the shared branch line (feat/023-mobile-sentry — the parallel session built on top of feat/022-test-coverage's spec commit a182d9b).

## Stage 0 — setup
- [x] S0.1 Branch created (feat/022-test-coverage); campaign later continued on feat/023-mobile-sentry which contains it.
- [x] S0.2 Spec 022 + spec 015 status update (a182d9b).
- [x] S0.3 Specs committed pathspec-limited.

## Stage 1 — web test infrastructure
- [x] S1.1 vitest.config.ts: .test.tsx + jsdom via environmentMatchGlobs + setupFiles (07f6d9a).
- [x] S1.2 devDeps: jsdom, @testing-library/react@16, jest-dom@6, @vitest/coverage-v8@2.1.8; test:coverage script.
- [x] S1.3 src/test/setup.ts, mocks/supabase.ts (thenable chain recorder), utils/render.tsx (QueryClient renderHook/render).
- [x] S1.4 React 19 smoke: 4/4 green before any real test depended on it.

## Stage 2 — packages/shared
- [x] S2.1 vitest@2.1.8 + config + test script (2bb739e).
- [x] S2.2 52 tests: schemas, supabase guard/factory/client-info, ai client+SSE, i18n, format.

## Stage 3 — web lib/ + utils/
- [x] S3.1 quiz service (12), rate-limit (6), ai/errors (17), ai/sanitize (8), textDirection (5), lecture-inference (13), notificationUtils (7) (4f3ffea).

## Stage 4 — web hooks/
- [x] S4.1 useSubjects with LEGACY is_academic describe tagged `@todo: remove after TRW refactor merge (spec 015)` (c7cf291).
- [x] S4.2 useTRWMembership + useTRWCategories + useEffectiveSemester + useCourses.

## Stage 5 — contexts
- [x] S5.1 AuthContext (9) + ThemeContext (4) (46fa6cd, b97d168).
- [ ] S5.2 server actions — DEFERRED (need server-runtime mocking; follow-up spec bullet).

## Stage 6 — critical components
- [x] S6.1 SubjectsGrid (5) + TRWAccessGate (4) (6d01e73). ChatContainer/QuizPlayer component smokes deferred with Stage 5 note.

## Stage 7 — mobile
- [x] S7.1 Explicit vitest.config.ts (node env + @/ alias) + local chain mock (82fd523).
- [x] S7.2 uuid (3), quiz-service (10), reviews-service (9). **Bonus: fixed real bug** — listGuestResults prefix filter never matched read-cache storage keys (attempts history always rendered empty).
- [ ] S7.3 RN screens/hooks — non-goal (needs @testing-library/react-native).

## Stage 8 — desktop
- [x] S8.1 @vitest/coverage-v8 pinned 2.1.8 (7c4b47a); suite 37 passed / 4 skipped.

## Stage 9 — e2e
- [x] S9.1 subjects-catalog.spec.ts: anonymous route-mocked contract green; signed-in variant skipped on seed portability (spec 015 §5) (0c88292).
- [x] S9.2 trw-gate.spec.ts: scenarios a/b green LIVE (anonymous redirect contract, 45s cold-compile budget); scenario c deferred to TRW merge (438e618).

## Stage 10 — gates + docs
- [x] S10.1 Final test gates: shared 52/52 · web 241/241 · desktop 37p/4s · mobile 125/126 (single failure = paste-attachments.test.ts, parallel session's spec 024 file, fails at HEAD — pre-existing, not this campaign's).
- [x] S10.2 web typecheck ✓ lint 52 warnings (ratchet) ✓; shared/mobile/desktop typecheck ✓.
- [x] S10.3 Coverage (informational, web): utils 96.6% · contexts 40.9% · lib 20.9% · hooks 9.2% · components 3.9% (render tests for the 189 components are an explicit non-goal). No threshold gate added (per spec 015 §2.3 discipline).
- [x] S10.4 Memory entry recorded; final report delivered.

## Environment scars (machine-local, gitignored node_modules)
The hoisted-linker node_modules was repeatedly degraded by parallel-session install races (stale .bin shims, missing @playwright/test, mixed esbuild JS 0.28.2 vs binary 0.21.5). Fixed via junctions (vitest in web/mobile, typescript in shared) + manual binary pairing (root 0.28.2, vite-nested 0.21.5). Anyone hitting `Host version X does not match binary version Y` or "unknown command" shims: re-check junctions before reinstalling.
