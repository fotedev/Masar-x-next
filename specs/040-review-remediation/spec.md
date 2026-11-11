# Spec 040 — Review Remediation (security + correctness)

**Status**: Approved 2026-11-08 (owner approved the remediation plan in session; scope locked to 28 review-critical findings + ~12 quick-win warnings; i18n batch deferred).
**Source**: Full-code review 2026-11-07 (`.tmp/full-code-review-2026-11-07/`, baseline `6cf3b95` — pre-purge `eb0277f`), all critical findings personally verified against source.
**Rollout**: 4 sequential PRs, each merged after CI green + `update-branch` (I14 worktrees at `../masarx-wt/`, no primary-checkout writes). After each merge: prod application per PR (DB migrations via Supabase MCP; edge function deploys via CLI).

## PR-1 `fix/security-hardening` (DB + edge)

| # | Fix | Source finding |
|---|---|---|
| S1 | Storage lockdown migration: drop the four `1xwkmju` wide-open policies; scoped replacements for `summaries-pdfs` (authenticated upload into `summaries/`), `payment-proofs` (owner-folder INSERT; owner/admin/course-instructor SELECT), `course-materials` (authenticated SELECT). Unscoped DELETE dropped without replacement (no app code removes objects). | D8 🔴 storage trio (baseline:4265-4269) |
| S2 | Quiz integrity migration (part 1): BEFORE INSERT trigger rejecting forged completed `quiz_attempts` (`finished_at IS NOT NULL OR score <> 0`); `admin_list_quiz_questions(uuid)` definer RPC (admin-gated, `search_path` pinned) for the admin tooling read path; `search_path` pinned + default-PUBLIC/anon EXECUTE revoked on the 10 unpinned SECURITY DEFINER fns (verified app-uncalled). | D8 P1.3 + WP3; D9 register |
| S3 | `reset-password`: atomic single-use token claim (conditional UPDATE) replacing read-check-mark; TTL 24h→1h in `request-password-reset`; `config.toml` `verify_jwt = true` on the two dead reset functions. | D9 🔴 TOCTOU + P0.5 + P0.3 |
| S4 | `auth-hook-email`: `SEND_EMAIL_HOOK_SECRET` JWT verification (fail-closed when set; restricted mode otherwise: `redirect_to` origin allowlist, `email_action_type` enum, per-recipient rate limit, encoded URLs) — closes the open relay without breaking live email before the secret is provisioned. | D9 🔴 open relay (P0.2) |
| S5 | `ai-chat`: 64KB raw-body cap + 50k `userMessage` cap + per-user `check_rate_limit` (10/min, service-role client) — closes the mobile-bypass spend hole. | D9/D11 🔴 uncapped AI |
| S6 | `process-pdf`: `@google/generative-ai` 0.21.0→0.24.1 + import-map stub alignment. | D12 🔴 F3, P1.9 |

**Not in PR-1**: `seed.sql` landmine fix — the file is **untracked/ignored locally** (`.gitignore:101 *.sql`, never committed); the two-line column fix is delivered to the owner directly.

## PR-2 `fix/web-mobile-correctness`
Mode-switch dead guard (`useAiChat` `modeRef`), edit-summary flat-route spinner + auth guard, DocumentReader watchdog `onLoad` cancel, NewsClient literal color-class map + validation memo split, NewsMediaUploads revoke-on-unmount, mobile QuizAttempts review race guard, cross-user state (academic cache userId-keyed + sign-out clears + `hasInitialized` reset + mobile `cacheClearAll`), admin layout locale-safe redirects + new `/[locale]/unauthorized` page, `QuizSchema` default `'pending'` + enum (+ test), `unused-exports-guard` per-symbol fix, `MESSAGE_NAMESPACES` reconcile, `any` server-action signatures, quick-win batch (noopener ×6, user-visible silent catches → logger+toast ~12 sites, `useSubjects` rollback via `getQueriesData`, `LatexRenderer` hoist, Theme/Notification context memos, locale-loss router fixes ×3). Re-verify each target against merged main first (#183 sidenav landed after the review baseline).

## PR-3 `fix/quiz-answer-key`
Column-grant migration (part 2 of S2: revoke `correct_answer` SELECT from anon+authenticated — ships here so grants and payloads flip together); strip the key from the RSC page select and `lib/quiz.ts` `getQuiz`; `QuizPlayer` renders post-finish correctness from `finish_quiz_attempt` `answers`; admin edit path reads via `admin_list_quiz_questions`; mobile explanation reveal gated post-finish; delete dead legacy `submitAttempt` (+ its unit test); update `guest-quiz` e2e.

## PR-4 `fix/desktop-build`
`will-navigate` origin comparison (URL parse, not prefix); recovery-page Retry via real IPC (`app:retryConnection`, bridge type + preload + web runtime); OAuth deep-link logged with query stripped; vitest/coverage alignment to 2.1.8 (+ per-workspace vite pin if the hoisted tree still leaks vite 8.3.5) — `pnpm -r test` fully green.

## Verification
Per PR: worktree lint/typecheck/unit tests; targeted e2e (PR-2: materials/study-flow; PR-3: guest-quiz). Post-merge prod probes: anon storage INSERT rejected; quiz-play HTML free of the key (post PR-3); signup email smoke; `pnpm -r test` green on main (post PR-4).

## Out of scope (documented, not fixed here)
`course-materials` per-enrollment SELECT scoping (needs a path convention) · i18n batch (~100 strings) · PR #194 docs blockers (owner's open PR) · `verify_system_access_code` double-consumption.
