# Spec 030 — Server-Authoritative Quiz Grading

> | | |
> |---|---|
> | Branch | `feat/030-quiz-server-grading` |
> | Created | 2026-10-24 |
> | Status | Approved (owner plan approval 2026-10-24) |
> | Type | DB contract + client integration |
> | Input | Full bug-audit 2026-10-24 finding C4 (`masarx-plan/bug-audit-2026-10-24/REPORT.md`) |

## Problem

Quiz grading is fully client-authoritative. The web player computes `isCorrect`
per answer (`useQuizPlayerRuntime.ts:200`), computes the final score
(`QuizPlayer.tsx:74`), and `quiz.ts finishAttempt()` persists the client's
numbers with a plain `.update()` on `quiz_attempts` — which RLS permits
(owner-scoped `FOR ALL`/UPDATE-own policies). The mobile app mirrors the same
path. A forged client therefore writes any score into the database, and
`correct_answer` reaches the browser in the question payload. Audit C4.

## Scope

**In (this spec):**
1. `finish_quiz_attempt(p_attempt_id uuid, p_time_taken_seconds integer DEFAULT NULL) RETURNS jsonb` —
   a SECURITY DEFINER RPC (011 canonical style: `auth.uid()` guard with
   ERRCODE 42501, `SET search_path = public`, REVOKE PUBLIC/anon + GRANT
   authenticated footer) that:
   - locks the attempt row (`FOR UPDATE`), rejects non-owners, treats an
     already-finished attempt as idempotent (`reason: 'already_finished'`
     with the stored graded state — network retries are safe);
   - re-grades every `quiz_answers` row of the attempt against
     `quiz_questions.correct_answer`, overwriting the client-sent
     `is_correct` flags;
   - computes `score` (correct count) and `total_questions` (quiz question
     count) server-side, sets `finished_at = now()`, `status = 'completed'`,
     `time_taken_seconds = COALESCE(p_time_taken_seconds, floor(now() - started_at))`,
     `last_updated_at = now()`;
   - rebuilds the `answers` jsonb authoritatively from the re-graded rows in
     the existing shape `[{question_id, selected_option, is_correct}]`;
   - returns `{success, score, total_questions, answers}`.
2. Guard trigger `trg_guard_quiz_attempt_score` (BEFORE UPDATE): clients may
   not change `score`, `total_questions`, `finished_at`, `status`, `answers`,
   or `time_taken_seconds` directly — only the RPC, which sets
   `app.quiz_grading = 'on'` for its transaction (same GUC-bypass pattern as
   migration 018's `extra_assets_entitled` guard). INSERTs (startAttempt's
   `score: 0`) are unaffected.
3. Client swaps: web `quiz.ts finishAttempt` + `useQuizAttempt` and mobile
   `quiz.ts finishAttempt` + `QuizPlayScreen` call the RPC and display the
   returned score/totals/answers.

**Out (non-goals):**
- Stopping `correct_answer` from shipping to students (separate decision;
  audit rated it Low). In-quiz instant feedback is unchanged.
- Server-side timer trust: `p_time_taken_seconds` remains client-supplied
  (accepted); the server only falls back to `now() - started_at`.
- Guest/local attempt scores (guests fire zero attempt requests — locked by
  e2e `guest-quiz.spec.ts`; local history keeps client scores by design).
- Legacy `submitAttempt` (dead code on web) — stays dead, unmodified.
- Anti-cheat beyond score integrity.

## Contracts

- RPC: `public.finish_quiz_attempt(p_attempt_id uuid, p_time_taken_seconds integer DEFAULT NULL) RETURNS jsonb`
  - success: `{"success": true, "score": int, "total_questions": int, "answers": [...]}`
  - idempotent retry: `{"success": true, "reason": "already_finished", "score": ..., "total_questions": ..., "answers": [...]}`
  - errors: ERRCODE 42501 on ownership violation (client shows generic error)
- Migration `019_quiz_server_grading.sql`; no RLS policy changes (the owner
  UPDATE policy stays; the trigger is what blocks direct client writes).

## Behavior preservation & regression strategy

- Honest clients see identical scores: the server recompute agrees with the
  client computation when inputs are honest; the results screen swaps to the
  server-returned numbers only at RPC resolution.
- Guest flows untouched; `quiz_attempts` selects (history pages) unchanged —
  they read the same columns.
- `rls-verify.sql` gains existence-guarded assertions (RPC present, anon
  revoked) — CI runs it on a disposable branch.

## Test specification

- `apps/web/src/lib/__tests__/quiz.test.ts`: `finishAttempt` asserts the
  rpc call (`finish_quiz_attempt`, `p_attempt_id`, `p_time_taken_seconds`)
  instead of the old `.update()` payload.
- `apps/mobile/src/lib/__tests__/quiz-service.test.ts`: same contract; the
  mobile supabase test mock gains an `rpc` method.
- `apps/mobile/src/test/mocks/supabase.ts`: add configurable `rpc`.
- Typecheck gates: `tsc --noEmit` for web AND mobile (vitest does not
  typecheck — CI's cross-workspace check is the backstop).

## Acceptance

1. Migration applied (prod, owner-approved same-session) and post-verified:
   RPC + trigger present, anon revoked, negative test (direct owner UPDATE of
   `score`) rejected by the trigger with zero mutation (rolled back).
2. All CI checks green; squash-merged via update-branch.
3. Honest-path e2e behavior unchanged (guest-quiz e2e untouched).
