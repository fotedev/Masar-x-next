# Spec 040 — Plan

Atomic execution units (owners: lead session; subagents only for mechanical multi-file edits in PR-2, waves of 2 on disjoint files).

## PR-1 `fix/security-hardening` (branch from origin/main @ 4ad5afa)
1. `supabase/migrations/20261108090001_storage_policy_lockdown.sql` — S1.
2. `supabase/migrations/20261108090002_quiz_integrity.sql` — S2 part 1 (trigger + admin RPC + definer pinning/revokes). Column grants deferred to PR-3.
3. Edge: `reset-password` atomic claim; `request-password-reset` TTL 1h; `auth-hook-email` hardening rewrite; `ai-chat` caps + rate limit; `process-pdf` 0.24.1; `_shared/tests/import-map.json` + stub header; `config.toml` verify_jwt=true ×2.
4. Checks: `deno check` (functions config) + `deno test supabase/functions/_shared/tests/` offline suite; `pnpm -r typecheck && pnpm --filter web lint` (no TS surface touched — regression guard only).
5. Commit `fix(db+edge): storage lockdown, quiz integrity, auth-hook relay closure (spec 040 PR-1)` → PR → CI green → update-branch → squash-merge.
6. Rollout: apply both migrations via `supabase-masarx` MCP; deploy `auth-hook-email`, `reset-password`, `ai-chat`, `process-pdf`; owner supplies `SEND_EMAIL_HOOK_SECRET` value → `supabase secrets set` + redeploy auth-hook for full closure; probes (anon storage INSERT → reject; signup email smoke).

## PR-2 `fix/web-mobile-correctness` (branch post-PR-1)
Per-file edits per spec §PR-2; re-verify targets vs merged main (#183 changed subjects/materials pages). Checks: web+mobile lint/typecheck/test, e2e materials+study-flow. Merge → no prod DB changes.

## PR-3 `fix/quiz-answer-key` (branch post-PR-2)
Migration `20261108…_quiz_column_grants.sql` + web/mobile payload & UI rework + dead `submitAttempt` removal + guest-quiz e2e update. Merge → apply migration → probe quiz-play HTML.

## PR-4 `fix/desktop-build` (branch post-PR-3)
Desktop fixes + vitest/coverage alignment (adapt to PR #198 if it merges first). `pnpm -r test` all-green gate. Merge → confirm green on main.

## Close-out
Update review SUMMARY reconciliation with fix SHAs; memory entry.
