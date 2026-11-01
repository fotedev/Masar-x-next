# Feature Specification: /factory Workflow (Issue → Spec → Plan → Implement → Review)

**Status:** Draft for owner approval · **Date:** 2026-11-01
**Template deviation:** speckit's User Stories/Requirements/Success Criteria sections are deliberately not used — this spec defines a **process**, so it is a stage table + gates + rules. Kept under 2 pages by cutting, not compressing.

## Scope ruling (owner's, confirmed at spec review)

This workflow is **process tooling**: documentation + a future `/factory` skill. It changes **no product code, no Core Flow** → outside I12 (MVP Lock) scope, same ruling class as `docs/decisions/2026-10-31-external-software-factory-tool.md` (which records the separate, parked Electron experiment — see that ADR; no action taken on its PR).

## Full-path pipeline

Every stage names its artifact + executor. Human gates (✋) are **mandatory and unskippable**; the agent never merges.

| # | Stage (executor) | Output artifact | Key rules |
|---|---|---|---|
| S0 | Triage (agent proposes → **owner decides**) | size class: light/full | bug vs feature; light path needs owner's explicit declaration (criteria below) |
| S1 | Reproduce — bugs only (agent) | repro steps + **failing test** + root-cause probe + before-screenshots | the failing test **defines "done"**; cannot reproduce → stop and ask; no spec before this exists |
| S2 | Issue (agent drafts → **owner approves text** → agent runs `gh issue create`) | GitHub issue | repro + acceptance criteria attached; **no external GitHub action before Gate 1** |
| S3 | Spec (agent) | feature-level `.md` ≤1 page | objective; inputs/outputs as types; edge cases; constraints (forbidden libs/patterns) |
| S4 | Prototype — UI tasks only (agent) | mockup | generated **after** the spec and **reviewed against it**; built with real project components/tokens, never standalone HTML |
| ✋ | **GATE 1 (owner)** | — | approve spec + prototype + before-evidence |
| S5 | Plan (agent) | plan doc | approach, affected files, risks, edge cases, rollback note |
| S6 | Tasks + Critique (agent, fresh context) | tasks list | small, ordered, independent tasks; critique pass **max 2 rounds → escalate to owner** |
| ✋ | **GATE 2 (owner)** | — | approve plan + tasks |
| S7 | Implement (agent) | commits | one task at a time: dedicated branch + `git worktree` + `.agents/` claim; binding spec directive — **on conflict: stop and report, never improvise** |
| S8 | Verify (agent) | gate report | bug: failing test red→green; feature: tests written **from the spec first** (TDD); then tsc / lint / tests; anti-slop: no `any`, `// @ts-ignore`, empty catch, test-weakening |
| S9 | Review (fresh-context reviewer — **separate session from the coder**, e.g. `masarx-verifier.md`) | review report | two distinct sections: **code review** and **spec-conformance review**; UI: Playwright screenshot vs prototype with seeded fixtures + baseline diff — evidence only, never "looks fine" |
| ✋ | **GATE 3 (owner)** | PR | PR links the issue; **owner approves and merges** (agent never merges — I14/I16) |
| S10 | Learn (agent, one line) | issue closed + rules line | close issue with summary; recurring mistakes → one line in `AGENTS.md` / `docs/agents/references/01-gotchas.md` |

All planning artifacts live in the repo (`specs/<nnn>-*/`), never only in chat, so a new session can resume from files.

## Light path (owner-declared at triage)

**Entry criteria (all must hold):** ≤3 files touched · no auth/payments/RLS/migrations files · no new dependencies · no API-contract change.
**Flow:** triage → one-paragraph spec → ✋ owner "ok" → implement → verify (S8) → PR (Gate 3).
**No issue is opened by default** on the light path (add an issue only if the owner asks for traceability).

## Absolute rules

1. Stop-on-spec-conflict: code conflicts with the binding spec → stop and report; never improvise.
2. Scope discipline: no files outside the current task's declared set.
3. Every human gate is mandatory; skipping a gate is a protocol violation, not an optimization.
4. The reviewer always runs in a fresh context, never the coder's session.
5. Critique/retry loops are bounded (2 rounds); exceeding them escalates to the owner.
6. Visual QA is evidence-based only (screenshots, seeded fixtures, baseline diffs).

## Out of scope for v1 (future work, one line)

Metrics/lead-time measurement, post-merge flags/monitoring, traceability tooling, a11y gates.

## Implementation note (separate step, after owner approval of this spec)

Realized as `.agents/skills/factory/SKILL.md` (`/factory`), wiring the stages to what already exists: speckit commands (S3/S5/S6), `gh` (S2/PR), Playwright (S1/S4/S9), `.agents/agents/masarx-verifier.md` (S9), worktree + claim conventions (S7). First proof: one real small bug through the light path.
