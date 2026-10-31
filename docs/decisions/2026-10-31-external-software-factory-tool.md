# ADR: External Software Factory Tool — Out of MVP-Lock Scope

- **Date:** 2026-10-31
- **Status:** Accepted (owner decision, same-day)
- **Related invariants:** I11 (spec-first), I12 (MVP Lock), I14 (branch isolation), I15 (git identity lock), I16 (escalation lock)

## Decision

The **Masarx Software Factory** — a local Electron control-plane app that automates the repo's existing agent protocol (git worktree isolation, task claims, verification gates, human diff-approval, PR submission) — is classified as **internal developer tooling, not shipped product**. It is therefore **out of scope for I12 (MVP Lock)**: it does not modify any product code path, core user flow, login, or deployment artifact of masarx_next.

The owner lifted I12 explicitly for this track on 2026-10-31, bounded to the tool itself.

## Why external (not inside the repo)

1. **Zero product-repo footprint:** the factory lives in its own repository at `C:/programming/WEB_Development/projects/masarx-factory/` (sibling directory) and targets masarx_next purely via `git worktree` from the outside. No dependency, CI, or release changes land in masarx_next for it.
2. **No governance entanglement:** masarx_next's MVP Lock, CI pipelines (gitleaks, lighthouse, fallow), and desktop release pipeline remain untouched by a dev tool with a different audience and cadence.
3. **Reusability:** the factory can target other repositories later without changes to masarx_next.

## How the factory operates on masarx_next (guardrails)

- Creates isolated worktrees under **`.kilo/worktrees/`** (existing convention; absolute `core.hooksPath` means the I15 identity-lock hooks cover them automatically).
- Keeps its **own** task registry — it does **not** write to `.kilo/agent-manager.json` (Kilo Code's registry).
- **Never commits to `main`** and **never merges** anything (I14/I16). Its "Approve" action is `git push` + `gh pr create`; the owner remains the sole merger on GitHub via the update-branch ruleset.
- Stages explicit locked paths only, per the `.agents/` claim protocol it automates.
- Verification gates run the repo's real scripts (`pnpm -r --if-present typecheck`, `pnpm lint`, `pnpm -r --if-present test`) inside the worktree — no `vp check` (does not exist in this repo).

## Alternatives considered

- **New `apps/factory` in the monorepo:** rejected — product CI/security/release pipelines would cover a dev tool; workspace manifests polluted.
- **Extend `apps/desktop`:** rejected — the product desktop app is for end users (students); the factory is for the owner, with a different release cadence.
- **No in-repo record:** rejected — without this ADR, future agents reading I12 would re-litigate the scope question with no context.
