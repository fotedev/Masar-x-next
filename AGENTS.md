# Masar X — Agent Guide

> **TL;DR.** Full-stack Next.js 16 + React 19 monorepo (`apps/web`, `apps/desktop`, `apps/mobile`, `packages/shared`). Supabase backend. Bilingual ar/en via `next-intl`. This file is the **index only** — details live in [`docs/agents/references/`](./docs/agents/references/README.md).

**Absolute paths** (verified 2026-09-05):
- Repo: `C:/programming/WEB_Development/projects/masarx_next/`
- Web app: `apps/web/`
- Shared types/i18n/AI: `packages/shared/`
- Supabase: `supabase/` (migrations, edge functions)
- Specs: `specs/` (next spec number always derived from disk — [10-spec-first.md](./docs/agents/references/10-spec-first.md))
- Agent skills: `.agents/skills/`
- References index: [`docs/agents/references/`](./docs/agents/references/README.md)

---

## Hard rules (one line each — full table in [03-invariants.md](./docs/agents/references/03-invariants.md))

- I1 Service-role/AI keys server-side only · I2 `Database` types + Zod in `packages/shared` · I3 i18n for every user-facing string · I4 OAuth callbacks under `[locale]/auth/callback/` · I5 `pnpm.neverBuiltDependencies` in root `package.json` · I6 Electron version pinned exact · I7 `ThemeScript.tsx` native `<script>` + `suppressHydrationWarning` · I8 no destructive git ops on a dirty tree without consent · I9 no direct file deletion — move to `.trash/` on approval · I10 pasted model output: Validate & Adapt · **I11 spec-first: non-trivial work needs an approved spec** ([10-spec-first.md](./docs/agents/references/10-spec-first.md)) · **I12 MVP Lock active** ([09-mvp-lock.md](./docs/agents/references/09-mvp-lock.md)) · **I13 brand frozen in `docs/BRANDING.md`** — never "summaries platform" · **I14 branch isolation & file locking** — dedicated branch per task; never work/commit on main except owner-directed maintenance; never assume the checked-out branch; claim the task in a local `.agents/<task>.md` (branch, locked paths, In Progress) before editing, stage explicit paths only (no `git add .`/`git commit -a`), delete the claim after push; **every agent session works in its own dedicated `git worktree add` checkout — even solo (reinstated 2026-10-04); no switch/reset/test-commit in the primary checkout; run `git branch --show-current` + `git status --porcelain` before any git state op** ([11-git-standards.md](./docs/agents/references/11-git-standards.md) §Branch Isolation) · **I15 identity lock** — never set or override git identity at command time (no `git -c user.*=…`, no `--author`, no `GIT_AUTHOR_*`/`GIT_COMMITTER_*` env) and never bypass hooks (`--no-verify`, `-c core.hooksPath=`); identity comes from machine git config only — if `git var GIT_AUTHOR_IDENT` does not resolve to the owner's email, stop and ask. Enforced by `C:/Users/FOTE/.githooks/pre-commit` + `commit-msg` — hooks live **outside** the repo; repo-local `core.hooksPath` points to the absolute path so agent worktrees (`.kilo/worktrees/*`) are covered too ([11-git-standards.md](./docs/agents/references/11-git-standards.md) §Git Identity Lock) · **I16 escalation lock** — never modify repo rulesets, never force-push to any protected branch, and never rewrite pushed history — unless the owner's explicit written confirmation appears in the same conversation message requesting that exact action; a plan alone, silence, or a defaulted question does not count as confirmation ([11-git-standards.md](./docs/agents/references/11-git-standards.md) §Escalation Lock).

## 🔒 MVP Lock (until launch — full text in [09-mvp-lock.md](./docs/agents/references/09-mvp-lock.md))

No trivial/cosmetic/refactor work. Allowed only: (1) blocking bugs, (2) core study-flow stability, (3) login + essential data, (4) deployment readiness. Lifted only by explicit owner decision.

---

## References

| Doc | Covers |
|---|---|
| [README.md](./docs/agents/references/README.md) | Task → doc routing table (start here) |
| [00-setup.md](./docs/agents/references/00-setup.md) | Setup essentials + verify commands |
| [01-gotchas.md](./docs/agents/references/01-gotchas.md) | 20 gotchas (Trigger/Why/Fix/Symptom) |
| [02-release-pipeline.md](./docs/agents/references/02-release-pipeline.md) | Release pipeline, secrets model, CI summary |
| [03-invariants.md](./docs/agents/references/03-invariants.md) | Full 16-rule invariants table |
| [04-architecture.md](./docs/agents/references/04-architecture.md) | Architecture (30-second version) |
| [05-repo-layout.md](./docs/agents/references/05-repo-layout.md) | Repository layout |
| [06-mcp-cli.md](./docs/agents/references/06-mcp-cli.md) | MCP and CLI quick map |
| [07-quirks.md](./docs/agents/references/07-quirks.md) | Project-specific quirks |
| [08-precommit.md](./docs/agents/references/08-precommit.md) | Pre-commit / pre-merge checklist |
| [09-mvp-lock.md](./docs/agents/references/09-mvp-lock.md) | MVP Lock full text (delete on lift) |
| [10-spec-first.md](./docs/agents/references/10-spec-first.md) | Spec-First standard, spec anatomy |
| [11-git-standards.md](./docs/agents/references/11-git-standards.md) | Conventional Commits, PR rules, branch isolation & multi-agent safety (I14), git identity lock (I15), escalation lock (I16) |

---

## Active specs (planning)

| Spec | Plan | Status |
|---|---|---|
| [015-consolidate-shared-abstractions](./specs/015-consolidate-shared-abstractions/spec.md) | [plan.md](./specs/015-consolidate-shared-abstractions/plan.md) | **Closed — landed on main** (TRW decoupling PR #52 `de0b7a7`; `24d773a` (pre-rewrite `7fb17f4`)/`956e366` (pre-rewrite `3578828`)/`6c6e2a1` (pre-rewrite `27efc7c`) bridge, paste-helpers, schema deletions; all 41 tasks complete `a6eb689` (pre-rewrite `c5faa3b`)) — row corrected 2026-09-30 (was stale "Ready for `/speckit.tasks`"); SHAs refreshed 2026-10-03 after the identity history rewrite |
| [026-tailwind-v4-upgrade](./specs/026-tailwind-v4-upgrade/spec.md) | [plan.md](./specs/026-tailwind-v4-upgrade/plan.md) | **Merged (squash `a949ec9`, pre-rewrite `708477f`, PR #65)** — Tailwind 4.3.3, CSS −37%, visual QA green; MVP Lock explicitly lifted for this track (owner, 2026-09-29) |
| [028-desktop-crashpad-logs](./specs/028-desktop-crashpad-logs/spec.md) | — | **Merged (squash `94faaaa`, pre-rewrite `1b45490`, PR #98)** — desktop Crashpad dumps (local-only, owner decision) + electron-log file logging; audit R7 closed locally, remote submission stays an owner decision |

<!-- SPECKIT START -->
- [026-tailwind-v4-upgrade](./specs/026-tailwind-v4-upgrade/plan.md) — Tailwind v3→v4 (Oxide) upgrade: research D1–D15, data-model, class-name contract, quickstart, atomic plan C1–C5, tasks T001–T029
<!-- SPECKIT END -->
