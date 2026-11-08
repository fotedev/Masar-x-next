# Spec 041 — Review Follow-ups: dedup clusters, chat-error integrity, i18n batch, DB/desktop/CI leftovers

**Status:** Approved (owner, 2026-11-08 — "continue" after spec 040 close-out)
**Origin:** 2026-11-07 full-code review (`.tmp/full-code-review-2026-11-07/`), post-spec-040 leftovers
**Baseline:** origin/main `c642b1c`

## Problem

Spec 040 (#200–#203) fixed the 28 criticals + quick wins. The remaining actionable review findings are:

1. **P1.7 duplicate clusters** — three live puter dup pairs with drift (`isPuterTransportError` differs: `lib/puter.ts` matches `'400'/'bad request'/'disconnect'/'connection refused'`, `lib/ai/errors.ts` does not; `PUTER_UNAVAILABLE_UNTIL_KEY` declared twice; `getPuterStatus` two divergent shapes), academic types/fetch ×2, `ContentItem` type ×2 (both imported), locale-toggle logic ×2.
2. **P1.10 puter error-as-chat-content** — `lib/ai/puter-client.ts extractPuterChatText` returns error-object strings as if they were successful assistant text; only a canned-prefix heuristic downstream distinguishes them.
3. **P1.5 i18n batch (deferred from spec 040)** — ~100–105 hardcoded user-facing Arabic strings across ~30 web files (verified inventory on 2026-11-08; English literals: none).
4. **DB leftovers** — spec-038 `sync_subject_id()` `LIMIT 1` without `ORDER BY` (nondeterministic anchoring on name collisions); `audit_logs` has no pruning (10 trigger tables, unbounded growth); blanket `DELETE/INSERT/UPDATE` grants on `audit_logs` to anon/authenticated; `course-materials` bucket readable by any authenticated user (needs naming probe before scoping).
5. **Desktop R13** — `server.ts` 500ms one-shot probe resolves "healthy" without verifying the port listens.
6. **Desktop R18** — no Host validation for the loopback Next standalone server (DNS-rebinding surface); mitigation in-repo is only the `127.0.0.1` bind.
7. **CI R22** — no dependency-audit job; two mutable action pins (`fallow@v3`, `lighthouse-ci-action@v12`).

## Goals (non-goals excluded: owner-gated items)

- One canonical implementation per duplicated symbol; behavior merged deliberately (puter transport predicate = union of both lists).
- Puter error objects never render as assistant content.
- Zero hardcoded user-facing strings in the inventoried files; strings live in `packages/shared/src/messages/{ar,en}/` (parity preserved).
- `sync_subject_id` deterministic; `audit_logs` prunable (90-day default, owner-vetoable); grants hygiene.
- Desktop startup reports truthful liveness; loopback requests validated by Host.
- `pnpm audit` job in CI; actions pinned.

## Out of scope (owner-gated)

- `SEND_EMAIL_HOOK_SECRET` set + auth-hook-email redeploy (waiting on owner value).
- Ruleset change making `test`/`workspaces`/`deno-check` required checks (I16).
- Wire-or-delete decisions (instructor-dashboard, trw/my-access, mobile SummaryDetail).
- `seed.sql` local fix (gitignored, no PR path — separate owner-approved edit).

## Delivery

5 PRs, sequential web pair + independent db/desktop/ci:

| PR | Branch | Scope |
|---|---|---|
| A | `refactor/dedupe-and-chat-errors` | items 1, 2 + shared residuals (schemas enum-rejection test, guard-test allowlist-path bug) |
| B | `fix/i18n-batch` | item 3 |
| C | `fix/db-followups` | item 4 |
| D | `fix/desktop-conn-probe` | items 5, 6 |
| E | `ci/deps-audit-job` | item 7 |

Each: worktree from `origin/main`, lint/typecheck/tests green, CI green + `update-branch`, squash-merge, worktree removed. PR-C migrations applied to prod via MCP after merge.

## Acceptance

- No `puter.ts`-local copies of the three symbols; tests cover the union predicate.
- Error responses from puter produce error-styled chat entries (not plain bubbles).
- Hardcoded-literal grep over the inventory files returns 0 user-facing hits; translations parity test green.
- Prod: `sync_subject_id` definition contains `ORDER BY`; `prune_audit_logs` exists (+ cron schedule if pg_cron enabled); `audit_logs` DML grants revoked.
- Desktop unit tests cover the liveness poll; e2e green.
- `deps-audit` job runs on CI.
