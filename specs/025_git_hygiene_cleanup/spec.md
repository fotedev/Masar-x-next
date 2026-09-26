# Spec 025 — Git Hygiene Cleanup (Local & Remote)

**Date:** 2026-09-26 · **Status:** approved (owner ratified plan via interactive review)
**Type:** repo hygiene / deployment-readiness (MVP Lock carve-out: security PR = deployment readiness)

## Problem

25 local branches (5 merged, 20 unmerged), 4 worktrees, 2 stashes, ~30 remote branches (mostly
closed dependabot PRs), stale `origin/pr/*` refs. Critical: `fix/security-p0-cves` is **local-only**
and carries unlanded security fixes (Next 16.2.1→16.3.6 RCE/middleware-bypass CVEs, password-reset
hardening, is_admin() RPC guards, Cloudinary webhook signature). `main` is still on next 16.2.1.

## Requirements

R1 Zero loss: every commit stays reachable (bundle + archive tags + pushed branches).
R2 Unlanded valuable work → pushed to origin + PRs (stacked by real dependency).
R3 Stashes → branches (never blind-dropped).
R4 Stale branches → archive tag with same name, then delete.
R5 Remote: closed-PR dependabot branches deleted, merged feature branches deleted, backups → tags.
R6 Worktrees: dead ones removed (Temp, .kilo), `masarx_main_wt` kept (owner decision).
R7 Current worktree triaged: spec-023 WIP committed, legitimate untracked committed, providers/
    WIP protected on a dedicated branch (owner-ratified, untouched in place), junk → `.trash/` (I9).

## Decisions (owner-ratified 2026-09-26)

| Decision | Choice |
|---|---|
| Unlanded work (security/017/TRW/brand-icon) | Push + open PRs |
| Stale/backup branches | Archive tag then delete |
| Worktrees | Remove dead (Temp, .kilo, .worktrees/test-space); keep `masarx_main_wt` |

## PR dependency chain (discovered)

`refactor/decouple-trw-subjects` (fbeaf83) is the base of `fix/security-p0-cves`, which is the base
of `feat/017-zane-provider-abstraction` ⇒ stacked PRs: TRW→main, security→TRW, 017→security.

## Safety nets

1. `git bundle create ../masarx_next-backup-2026-09-26.bundle --all` (16.6 MB, all refs).
2. `.agents/git-cleanup-2026-09-26.md` claim file (I14 file locking).
3. Before/after inventories in `docs/audits/git-cleanup-2026-09-26/`.

## Invariants honored

I8 (no destructive ops on dirty tree — every tree cleaned/parked first), I9 (file deletions →
`.trash/`), I11 (this spec), I12 (security PR = deployment readiness carve-out), I14 (file locking,
explicit-path staging only).

## Out of scope

Merging any PR (owner reviews), purging `.trash/` archives, spec-023 feature completion,
dependabot PR review (#33, #37, #51 stay open).
