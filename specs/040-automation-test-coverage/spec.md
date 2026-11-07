# Spec 040 — automation test coverage campaign (full sweep)

| Field | Value |
|---|---|
| Status | Approved (owner plan approval 2026-11-07, in-session; scope decisions: full sweep, coverage report-only no gate, e2e specs + production testids) |
| Type | Test infrastructure + coverage campaign (no production behavior changes except: `MESSAGE_NAMESPACES` drift fix, pure-helper exports for testability, data-testid attributes) |
| Origin | 10-agent parallel audit of unit-test coverage across the monorepo (2026-11-07) |

## Problem

~80 test files total (66 vitest across 4 workspaces, 9 Playwright e2e, 5 Deno edge suites) against a 4-workspace monorepo. Verified gaps:

- `apps/web` ≈9% file coverage; **components 2/154 tested**; all 7 API route handlers, all 3 server actions, the OAuth callback route, and `src/proxy.ts` CSP/cookie choreography have **zero** tests.
- Hooks layer: `useAiChat` (guest-persistence regression zone), `useQuizAttempt` (server-grading contract), `useQuizPlayerRuntime` (timer state machine) untested.
- SQL layer: `finish_quiz_attempt` + `guard_quiz_attempt_grading` trigger, `trw_redeem_access_code` (money path), `check_rate_limit`, `norm_subject_name` — no harness of any kind.
- `packages/shared`: Drive*/Schedule* Zod schemas (parsed at module import — drift crashes pages) untested; `MESSAGE_NAMESPACES` drifted (phantom `trw`, missing `downloads`/`materials`/`schedules`/`desktopStudyWorkspace`/`desktopUpdates`/`enrollments`/`titlebar`); full ar/en per-key parity never tested.
- Edge functions: `cloudinary-webhook/signature_test.ts` exists but the CI deno-test path never runs it; `_shared/net.ts`/`cors.ts`/`http.ts`/`crypto.ts` untested.
- Coverage tooling dormant: `@vitest/coverage-v8` version-skewed (2.1.9 vs vitest 2.1.8) in web/desktop, absent in mobile/shared; no CI collection.
- E2E: every authenticated write path uncovered (redeem, quiz finish, AI send, login, admin gate); e2e-critical UI surfaces (auth forms, TRW redeem, QuizPlayer, ChatInput) carry no `data-testid`s.

## Changes

Single branch `test/040-automation-tests`, staged waves, one PR. Conventions preserved: tests only in `__tests__/` dirs (glob-enforced), vitest **2.1.8 exact** (dependency majors are spec 039's territory), Electron pinned, RTL + jest-dom + jsdom-per-`.test.tsx` unchanged.

- **W1 infra** — pin `@vitest/coverage-v8@2.1.8` (web/desktop), add to mobile/shared; `test:coverage` scripts everywhere; CI uploads coverage-summary artifacts (report-only, no thresholds); deno test path gains `cloudinary-webhook/`; shared `next-intl` mock module.
- **W2 shared** (~7 files) — Drive*/Schedule* schema tests, `MESSAGE_NAMESPACES` parity test **+ drift fix**, factory mobile-storage path, i18n nested lookup, desktop-bridge fallbacks, ai-client edge cases, `formatApproxSize` MB tier, `formatDate` invalid input.
- **W3 hooks** (~9 files) — quiz runtime/attempt/chat, `useUserAcademic`, `PlatformSettingsContext`, `useQuizPlayerData`, TRW hooks, `useSubjects` rollback, `useLectureContent`; `AuthContext` suite deepened in place.
- **W4 web lib** (~10 files) — assistant orchestrator, puter-client, queryCache, github-releases, cloudinary, storage trio, supabase proxy + stripBOM, api-auth contract, validation/profile + reactions + materials/schedules + withTimeout.
- **W5 server** (~8 files) — OAuth callback (pure helpers exported, table-driven open-redirect tests), proxy helpers, `updateSession` matrix, route handlers, server actions, sitemap, `isAdminRole`.
- **W6 edge** (~6 files) — net/cors/http/crypto, request-password-reset uniform-response, cloudinary-webhook mapping (stub extension), upload-file + ai-chat pure extractions.
- **W7 SQL** — `supabase/tests/rpc-verify.sql` + README (plain-SQL `rls-verify.sql` pattern, no pgTAP dependency): quiz grading + guard trigger, TRW redemption lifecycle, rate-limit windows, `norm_subject_name` parity. Portable-PG run documented; not wired into CI.
- **W8 components** (~11 files) — QuizPlayer trio + orchestrator, UserMenu, ChatInput, ReviewForm, login/signup, TRW redeem page, EditSummaryModal, ChatMessageItem, ThemeToggle; `@testing-library/user-event` added.
- **W9 e2e** — 5 specs (`trw-redeem`, `quiz-finish`, `ai-chat-send`, `auth-surface`, `admin-gate`) + data-testids on auth forms, TRW redeem, QuizPlayer, ChatInput (testid-only production edits).
- **W10** — CI coverage job, spec ledger row, AGENTS.md update, PR.

## Out of scope

Dependency version bumps (spec 039) · RN component/hook tests (documented non-goal in `apps/mobile/vitest.config.ts`) · pgTAP (vanilla-PG plain-SQL harness instead) · coverage thresholds enforcement (owner decision deferred) · I3 hardcoded-string remediation in the violation tail (audit-documented; separate track) · locale-aware fix of `admin-dashboard/layout.tsx` unprefixed redirects (flagged to owner, not changed).
