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

- I1 Service-role/AI keys server-side only · I2 `Database` types + Zod in `packages/shared` · I3 i18n for every user-facing string · I4 OAuth callbacks under `[locale]/auth/callback/` · I5 `pnpm.neverBuiltDependencies` in root `package.json` · I6 Electron version pinned exact · I7 `ThemeScript.tsx` native `<script>` + `suppressHydrationWarning` · I8 no destructive git ops on a dirty tree without consent · I9 no direct file deletion — move to `.trash/` on approval · I10 pasted model output: Validate & Adapt · **I11 spec-first: non-trivial work needs an approved spec** ([10-spec-first.md](./docs/agents/references/10-spec-first.md)) · **I12 MVP Lock active** ([09-mvp-lock.md](./docs/agents/references/09-mvp-lock.md)) · **I13 brand frozen in `docs/BRANDING.md`** — never "summaries platform".

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
| [03-invariants.md](./docs/agents/references/03-invariants.md) | Full 13-rule invariants table |
| [04-architecture.md](./docs/agents/references/04-architecture.md) | Architecture (30-second version) |
| [05-repo-layout.md](./docs/agents/references/05-repo-layout.md) | Repository layout |
| [06-mcp-cli.md](./docs/agents/references/06-mcp-cli.md) | MCP and CLI quick map |
| [07-quirks.md](./docs/agents/references/07-quirks.md) | Project-specific quirks |
| [08-precommit.md](./docs/agents/references/08-precommit.md) | Pre-commit / pre-merge checklist |
| [09-mvp-lock.md](./docs/agents/references/09-mvp-lock.md) | MVP Lock full text (delete on lift) |
| [10-spec-first.md](./docs/agents/references/10-spec-first.md) | Spec-First standard, spec anatomy |
| [11-git-standards.md](./docs/agents/references/11-git-standards.md) | Conventional Commits, PR rules |
