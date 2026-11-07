# Project Structure

> **What is this?** A short reference for the next contributor (human or AI) explaining what lives where in this repo's root. Keep it under one screen.

**Project type:** Full-stack Next.js monorepo (frontend + backend, pnpm workspaces)
**Last organized:** 2026-11-07 (structure sync against the tracked tree)
**Maintainer:** the team
**Organized by:** docs-refresh pass (earlier: organize-root v2.3, 2026-09-05)

---

## Tree

```
masarx_next/                          # Full-stack Next.js monorepo
├── apps/                             # Deployable applications
│   ├── desktop/                      # Electron desktop app
│   ├── mobile/                       # React Native / Expo app
│   └── web/                          # Next.js web app (primary)
├── packages/                         # Shared libraries
│   └── shared/                       # Shared types, utils, components
├── docs/                             # All project documentation
│   ├── agents/                       # Agent-facing references
│   ├── audits/                       # Bug / desktop / perf audit reports
│   ├── delivery/                     # Handover, review, traceability, verification reports
│   ├── design/                       # Design docs (DESIGN.md / DESIGN.json), logos
│   ├── diagrams/                     # Mermaid (.mmd) diagrams
│   ├── handoffs/                     # Build / agent handoff notes
│   ├── legacy/                       # Outdated docs, prior reorganization plans
│   ├── perf/                         # Performance audits and baselines
│   ├── releases/                     # Release cut checklists and templates
│   ├── security/                     # Security audits, runbooks, DB verification
│   └── BRANDING.md, FEATURES.md, PRODUCT.md, SETUP.md, …   # Top-level topic docs
├── scripts/                          # Utility scripts
│   ├── audit-rls.mjs                 # RLS policy audit
│   ├── i18n-audit.mjs                # i18n coverage audit
│   ├── seed-mvp-launch.mjs           # MVP launch seeding
│   └── workspace-tools/              # pnpm workspace utilities
├── supabase/                         # Supabase config, migrations, functions
│   ├── config.toml                   # Supabase CLI project config
│   ├── functions/                    # Deno Edge Functions (+ _shared/, tests)
│   ├── migrations/                   # Timestamped SQL migrations (spec 031)
│   ├── migrations-archive/           # Legacy sequential chain (numbered-chain-001-019)
│   └── tests/                        # Database test scripts
├── specs/                            # SpecKit spec-driven-dev artifacts
│   └── (numbered dirs, 001–038)      # One folder per spec
├── promo_assets/                     # Brand/promotional assets (logos, lockups, previews)
├── .github/                          # GitHub Actions workflows, templates, scripts
├── .specify/                         # Specify workspace config (templates, memory, integrations)
├── .windsurf/                        # Windsurf workflows (shared)
│
│   --- Configuration files (stay at root) ---
├── package.json                      # Monorepo manifest
├── pnpm-workspace.yaml               # Workspace globs: apps/*, packages/*
├── pnpm-lock.yaml                    # Pinned install graph
├── deno.lock                         # Deno lockfile for Supabase Edge Functions
├── vercel.json                       # Vercel deployment config
├── .env.example                      # Environment template (.env/.env.local stay local, gitignored)
├── .gitignore                        # Git ignore rules
├── .gitattributes                    # Line-ending + LFS rules
├── .editorconfig                     # Editor formatting
├── .npmrc, .cssrc.json               # Package manager / CSS configs
├── .nvmrc                            # Node version pin (24)
├── .stylelintrc.json, .markdownlint.jsonc  # Linters
├── .gitleaks.toml                    # Secret scanning config
├── .fallowrc.json                    # Fallow static-analysis config
├── .mailmap                          # Git author identity mapping
├── .cursorignore, .windsurfignore, .zcodeignore  # AI tool ignore files
├── AGENTS.md                         # Agent-facing project guide
├── README.md, LICENSE, NOTICE.md     # Standard repo metadata (NOTICE.md added 2026-11-07)
├── CHANGELOG.md, CODE_OF_CONDUCT.md, CONTRIBUTING.md, SECURITY.md
│
│   --- Permanent skill artifacts ---
└── STRUCTURE.md                      # ← this file
```

---

## What lives here

| Path | Purpose |
|---|---|
| `apps/` | Deployable applications. Each has its own `package.json` and root conventions. Do NOT touch from this skill — each workspace has its own root. |
| `packages/` | Shared libraries across workspaces. Same rule as `apps/` — out of scope for root organization. |
| `docs/` | All project documentation. Subdirectories: `agents/`, `audits/`, `delivery/`, `design/`, `diagrams/`, `handoffs/`, `legacy/`, `perf/`, `releases/`, `security/`, plus top-level topic docs (`BRANDING.md`, `FEATURES.md`, `PRODUCT.md`, `SETUP.md`, …). |
| `scripts/` | Utility scripts (`audit-rls.mjs`, `i18n-audit.mjs`, `seed-mvp-launch.mjs`), plus `workspace-tools/` for pnpm workspace helpers. |
| `supabase/` | Supabase CLI config, timestamped migrations, Deno Edge Functions, tests. Project-internal, treated as a single source root. |
| `specs/` | SpecKit spec-driven-dev artifacts (numbered spec directories, currently 001–038). |
| `promo_assets/` | Brand and promotional assets (logos, lockups, previews). Not part of the pnpm workspace. |
| `AGENTS.md` | Agent-facing project conventions. Read this before any agent task. |
| `STRUCTURE.md` | This file. |

### Config files (do not move)

| File | Locked because |
|---|---|
| `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` | pnpm reads from root |
| `deno.lock` | Deno reads from root (Edge Function dependency graph) |
| `.env.example` | dotenv convention; `.env` / `.env.local` stay local and gitignored |
| `.gitignore`, `.gitattributes` | git reads from root |
| `.editorconfig`, `.npmrc`, `.cssrc.json` | Tooling configs read from root |
| `.nvmrc` | Node version managers read from root |
| `.mailmap` | `git log` / `git shortlog` reads from root |
| `.stylelintrc.json`, `.markdownlint.jsonc`, `.gitleaks.toml` | Linters / scanners read from root |
| `.fallowrc.json` | Fallow static analysis reads from root |
| `vercel.json` | Vercel reads from root |
| `.github/`, `.windsurf/` | Tooling / CI reads these from root |
| `.specify/` | Specify tooling reads from root |
| `.cursorignore`, `.windsurfignore`, `.zcodeignore` | AI tool ignore files |
| `AGENTS.md`, `README.md`, `LICENSE`, `NOTICE.md`, `CHANGELOG.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md` | Standard project metadata |

### What was reorganized in 2026-09-03

| File / dir | Moved from | Moved to |
|---|---|---|
| 8 tracked files | (root) | `docs/`, `docs/legacy/`, `scripts/`, `scripts/sql/`, `.specify/` |
| 9 untracked files | (root) | **deleted** (with explicit user approval) |
| `.trash/` | (root) | **deleted recursively** |
| `.gitignore` patterns | — | added `.tmp_old_*.txt`, `.vercel/`, `sandbox/` |
| `my-project/` | (root) | **flagged — non-empty, contains `.opencode/` + `.specify/`** |

### What was cleaned up in 2026-09-05

Four gitignored backup/scratch artifacts at root with no git history — removed:

| File | Size | Why |
|---|---|---|
| `pnpm-lock.yaml.bak` | ~620 KB | Lockfile backup; convention violation to coexist with active lockfile. Flagged in prior run. |
| `temp-chat.txt` | ~41 KB | Stray throwaway chat log; ignored by `.gitignore`. |
| `.env.local.bak` | ~2.3 KB | Backup of `.env.local`; ignored by `.gitignore` (`*.bak`). |
| `.npmrc.bak` | ~89 B | Backup of `.npmrc`; ignored by `.gitignore` (`*.bak`). |

`my-project/` not found at root — the 2026-09-03 flag was already resolved (dir removed elsewhere or never persisted).

`REVERT_PLAN.sh` was left alone — it has git history (committed in `c07d0e6` and `611a022`) and is intentionally retained as the rollback for the prior reorg.

No destructive git ops were performed; the 9 modified files and 8 untracked user-work items from the prior turn are untouched.

To reverse the moves (not the deletions): `bash REVERT_PLAN.sh`.

**2026-11-07 update:** `REVERT_PLAN.sh` is no longer tracked at the repo root (verified against the tracked tree) — the rollback script from the 2026-09-03 reorganization has since been removed.

---

## Where does a new top-level file go?

Use the decision rule in `references/CATEGORIES.md` from the organize-root skill. Short version:

1. **Is it a build manifest or lockfile?** → root.
2. **Is it a dotfile the tool reads from root?** → root.
3. **Is it a deployment / CI config?** → root.
4. **Is it markdown documentation?** → `docs/<subcategory>/`.
5. **Is it a script?** → `scripts/<subcategory>/`.
6. **Is it a SQL fix script?** → `scripts/sql/`.
7. **Is it a test fixture?** → `test-data/` or `fixtures/`.
8. **Is it a small data file?** → `data/`.
9. **Is it media?** → `apps/web/public/` (if served at URL) or `assets/` (if imported by code).
10. **Is it a build artifact?** → **`.gitignore`**, not deletion.
11. **Still unsure?** → Flag in the PR description, don't move it.

**Important for this repo:** if you're adding a top-level file, check whether it belongs inside one of the existing top-level dirs first (most things do). The convention is "thin root".

---

## When this guide gets stale

This guide gets out of date the moment a top-level file is added or moved. Update it in the same PR that changes the root layout. The maintainer of the PR owns the update.

If a future reorganization is needed, run `organize-root` again — Phase 0 (idempotency check) will detect this file and offer to re-scan rather than duplicating layout.

---

## Open items

The sibling ad projects flagged in the 2026-09-03 run (`masarx-remotion-ad/`, `masarx-video-ad/`) are untracked and no longer appear at the repo root (verified 2026-11-07). No open items remain from that run.
