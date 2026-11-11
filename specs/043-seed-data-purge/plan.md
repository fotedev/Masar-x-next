# Spec 043 — Plan

## Phase 1 — Verify (pre-push gate)

1. `verify.sh` V1–V10 in the mirror (tree delta, seed-file absence, blob
   unreachability, verbatim-text sweep, shared-commit coherence, prefix, identity +
   dates, signatures, merge sets).
2. Additions: `merge-base --is-ancestor bf009d9d` over every kept head/tag
   (all must be CLEAN); `ls-tree main -- supabase/migrations/` (4 absent, 2 keepers
   present); `%G?` audit.
3. **Gate:** any failure stops execution (rollback bundle + `refs/original/*`
   still intact at this point).

## Phase 2 — Commit prep (mirror working tree on rewritten main)

1. Write `specs/043-seed-data-purge/{spec.md,plan.md}` + withdrawal migration.
2. Doc reconciliation (see spec §Scope 2). SHA map from subject-matched
   `refs/original/refs/heads/main` vs new `main` logs.
3. Single commit `chore(spec-043): withdraw real-exam seed migrations + reconcile docs`
   (machine identity, SSH-signed, hooks pass — I15).

## Phase 3 — Push window (kept short)

1. Delete `refs/original/*` (3 refs); re-verify blob unreachability from push refs.
2. Relax ruleset `20299668` (5 rules removed, 3 kept; `deletion`,
   `required_linear_history`, `copilot_code_review` preserved).
3. `git push --force origin refs/heads/main refs/heads/docs/e2e-agent-runbook
   refs/heads/dependabot/npm_and_yarn/uuid-14.0.3 refs/tags/v0.6.0-test.1`
   — explicit refspecs only.
4. Restore ruleset byte-for-byte from `ruleset-20299668.orig.json`; verify via GET.
5. Remote verification: `gh api` SHA equality; PR #227 head auto-follow; throwaway
   clone sweep over all reachable blobs (zero seed-text hits).

## Phase 4 — Reconciliation + hygiene

1. Prod: insert withdrawal ledger row, delete 4 orphan seed rows, verify counts
   18 quizzes / 245 questions / 24 subjects and no seed text in `statements`.
2. Draft GitHub Support + Software Heritage tickets (owner files both).
3. Local hygiene: primary residue refs → `.trash/` inventory then delete (all
   `refs/backup/*` + `refs/cline/*` + `refs/tmp/pr179` — owner choice), forced fetch
   + `reset --hard origin/main`, runbook worktree reset, `.tmp/` → `.trash/`, reflog
   expire + gc; mirror pull-refs + gc; delete rollback bundle + roundtrip clone +
   temp scratch after remote verification.
4. Final report: purged vs. remaining exposure.

## Verification

- Pre-push gate green (Phase 1), post-push sweep zero-hit, prod counts unchanged,
  ruleset restored, local blob SHAs unresolvable after gc.
