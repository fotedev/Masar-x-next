---
name: factory
description: Run a task through the /factory stage pipeline (triage → reproduce+failing-test → issue → spec → prototype → plan → tasks+critique → implement → verify → fresh-context review → learn) with three mandatory human gates. Use when the owner asks to fix or build something "through the factory", "بالخط الإنتاجي", or references the factory workflow. Not for pure questions, docs-only edits, or P0 incidents.
metadata:
  author: fotedev
  version: 0.1.0
---

# /factory — Stage Pipeline with Human Gates

## Purpose

Executes the stage pipeline defined in **`specs/030-factory-workflow/spec.md`** — the binding authority. On any conflict between this skill and the spec, **the spec wins**: stop and report the conflict. The skill turns each spec stage into concrete invocations using what the repo already has; it adds no tooling.

## Fixed Config

| Purpose | Path / command |
|---|---|
| Pipeline authority | `specs/030-factory-workflow/spec.md` |
| Reviewer agent (S9) | `.agents/agents/masarx-verifier.md` — Read/Grep/Glob/Bash; runs typecheck, lint, tests, i18n + migration checks; returns PASS/FAIL table; read-only |
| Verification scripts | `pnpm -r --if-present typecheck` · `pnpm lint` · `pnpm -r --if-present test` · `node .agents/agents/verify_i18n.mjs --scan-only` |
| E2E / screenshots | `pnpm --filter web test:e2e` (specs in `apps/web/e2e/`) |
| Worktrees / claims | `.kilo/worktrees/<slug>/` · `.agents/<task>.md` (machine-local, gitignored) |
| Git identity / hooks | absolute `core.hooksPath` covers worktrees — never bypass (I15); never `git -c user.*`, `--no-verify` |
| gh CLI | prefix git/gh calls with `HOME=/c/Users/FOTE` on this machine |

## Hard Rules (Non-Negotiable)

1. The three human gates are **unskippable**. A skipped gate is a protocol violation, not an optimization.
2. Stop-on-spec-conflict: if the code you are about to write conflicts with the binding spec, **stop and report** — never improvise.
3. Scope discipline: touch no files outside the current task's declared set.
4. The S9 reviewer always runs in a **fresh context**, never the coder's session.
5. Critique/retry loops are bounded: **max 2 rounds**, then escalate to the owner.
6. Visual QA is evidence-based only (screenshots, seeded fixtures, baseline diffs) — never "it looks fine".
7. **The agent never merges.** Owner approves and merges (I14/I16). Agent: push + PR only.
8. Worktrees: dedicated branch `<type>/<slug>`, never work on `main`, claim file before editing, explicit-path staging only, delete claim after push, zero orphan worktrees (resolve file-locks immediately).

## When NOT to Use

- Pure questions or docs-only edits.
- P0 production incidents — direct fix under MVP-Lock rules.
- Tasks the owner explicitly routes through plain speckit commands.

## Workflow

**0. TRIAGE** — Reproduce the ask as one line. Propose: bug or feature; **size class (light/full)**. → `STOP — owner decides the path. Light path jumps to LIGHT FLOW below.`

**1. REPRODUCE** (bugs) — Run the app / read logs until the bug reproduces. Write the **failing test** (web vitest unit, or `apps/web/e2e/` spec) that proves it. Capture before-screenshots (Playwright). Probe root cause in code. Cannot reproduce → stop and ask. *The failing test defines "done" for this task.*

**2. ISSUE** (full path only) — Draft title + body (repro steps, acceptance criteria) **in chat**. → `STOP — owner approves the text.` Then `gh issue create`. No external GitHub action happens before Gate 1.

**3. SPEC** — Write `specs/<nnn>-<name>/spec.md` (next number from disk + `git branch -a` + open PRs): objective, inputs/outputs as types, edge cases, constraints, ≤1 page.

**4. PROTOTYPE** (UI tasks) — Open the worktree branch early (see 7) and implement the minimal UI on it; screenshot via a throwaway Playwright spec; show the images. Marked prototype — never merged as-is.

**→ GATE 1: show spec + prototype + before-evidence. STOP until the owner approves.**

**5. PLAN** — `specs/<nnn>-<name>/plan.md`: approach, affected files, risks, edge cases, rollback note.

**6. TASKS + CRITIQUE** — `specs/<nnn>-<name>/tasks.md`: small, ordered, independent tasks (vertical slices). Then a **fresh-context** subagent (critic prompt, no coder context) reviews plan+tasks vs spec vs `AGENTS.md` invariants. Max 2 rounds, then escalate.

**→ GATE 2: show plan + tasks + critique result. STOP until the owner approves.**

**7. IMPLEMENT** — From the branch the planning artifacts live on: `git worktree add .kilo/worktrees/<slug> -b <type>/<slug>`; write the claim file (branch, status, locked paths); implement **one task at a time**, one commit per task; stage explicit paths only; on any spec conflict → stop and report.

**8. VERIFY** (in the worktree) — Bug: failing test red → green; old tests intact. Feature: tests written from the spec first, then implementation. Then the gate set: `pnpm -r --if-present typecheck` · `pnpm lint` · `pnpm -r --if-present test` (+ i18n scan when messages changed). Anti-slop: no `any`, no `// @ts-ignore`, no empty catch, no weakened tests. Fail → fix root cause (this is part of the task, not a gate bypass).

**9. REVIEW** — Spawn a **fresh** `masarx-verifier` subagent on the diff (its PASS/FAIL report = code review). Separately, run the **spec-conformance pass**: does the diff implement exactly what the spec requires, nothing more? UI tasks: Playwright screenshot vs prototype with seeded fixtures + baseline diff. Both reports go to the owner.

**10. SUBMIT** — Push the branch; `gh pr create` with the issue link, per-task summary, and both review reports attached. → `GATE 3: STOP — the owner reviews and merges. The agent never merges.`

**11. LEARN** — After the owner merges: close the issue with a one-paragraph summary; if a recurring mistake surfaced, add **one line** to `AGENTS.md` or `docs/agents/references/01-gotchas.md`. Delete the claim file; `git worktree remove` the worktree; verify zero orphans (`git worktree list`).

### LIGHT FLOW (owner-declared at triage)

Entry criteria (all must hold): ≤3 files · no auth/payments/RLS/migrations files · no new dependencies · no API-contract change.
TRIAGE → one-paragraph spec **in chat** → `STOP — owner "ok"` → IMPLEMENT (worktree + claim, as above) → VERIFY (as above) → PR (Gate 3). No issue by default (add one only if the owner asks for traceability). No plan/tasks/critique artifacts.

## Report Format

- At every gate: one line — `GATE n: <what is being approved> → awaiting owner`.
- Final summary table: `stage → artifact → result`, plus issue/PR links, worktree/claim cleanup status.

## What "Done" Looks Like

PR open and linked to its issue · all three gates logged with owner decisions · failing test (bugs) green · review reports attached · claim files deleted · worktrees removed, zero orphans · issue closed after merge · lessons line written if a recurring mistake appeared.
