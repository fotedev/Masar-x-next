# Project Structure

> **What is this?** A short reference for the next contributor (human or AI) explaining what lives where in this repo's root. Keep it under one screen.

**Project type:** Full-stack Next.js monorepo (frontend + backend, pnpm workspaces)
**Last organized:** 2026-09-03
**Maintainer:** the team
**Organized by:** organize-root v2.3

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
│   ├── legacy/                       # Outdated docs, prior skill outputs
│   ├── FEATURES.md
│   ├── PRODUCT.md
│   ├── SMOKE_TEST_REPORT.md
│   ├── design/                       # Design docs, logos, ADRs
│   ├── diagrams/                     # Mermaid + plantuml diagrams
│   ├── handoffs/                     # Build / agent handoff notes
│   └── ...                           # Subcategories per team conventions
├── scripts/                          # Utility scripts
│   ├── verify_courses.py             # Course verification helper
│   ├── verify_keys.py                # API key verification
│   ├── sql/                          # SQL fix scripts
│   │   └── SQL_FIX_VIDEOS_RATINGS.sql
│   └── workspace-tools/              # pnpm workspace utilities
├── supabase/                         # Supabase config, migrations, functions
├── specs/                            # Specify spec-driven-dev artifacts
│   ├── 001-critical-security-fixes/
│   ├── 002-fix-production-errors/
│   ├── 003-mobile-responsive-fix/
│   └── 004-multi-platform-expansion/
├── public/                           # Static assets served by Next.js
├── sandbox/                          # Personal sandbox (gitignored)
├── context_output/                   # Working output dir (gitignored)
├── masarx-remotion-ad/               # Sibling Remotion ad project (intentional, untracked)
├── masarx-video-ad/                  # Sibling video-ad project (intentional, untracked)
├── .github/                          # GitHub Actions workflows
├── .vscode/                          # VS Code workspace settings (shared)
├── .opencode/                        # OpenCode CLI metadata (shared)
├── .cursor/                          # Cursor IDE settings (shared)
├── .windsurf/                        # Windsurf IDE settings (shared)
├── .agents/                          # Hermes agent skill definitions
├── .context/                         # Hermes context store
├── .specify/                         # Specify workspace config + pnpm-list.json
│
│   --- Configuration files (stay at root) ---
├── package.json                      # Monorepo manifest
├── pnpm-workspace.yaml               # Workspace globs: apps/*, packages/*
├── pnpm-lock.yaml                    # Pinned install graph
├── drizzle.config.ts                 # Drizzle ORM config
├── vercel.json                       # Vercel deployment config
├── tsconfig.json                     # Base TypeScript config
├── tsconfig.app.json
├── tsconfig.node.json
├── .env, .env.example, .env.local    # Environment files (local ones gitignored)
├── .gitignore                        # 247 lines (now +3 from v2.3 run)
├── .gitattributes                    # Line-ending + LFS rules
├── .editorconfig                     # Editor formatting
├── .npmrc, .cssrc.json               # Package manager / CSS configs
├── .eslintrc.json, .stylelintrc.json, .markdownlint.jsonc  # Linters
├── .gitleaks.toml                    # Secret scanning config
├── .cursorignore, .windsurfignore    # AI tool ignore files
├── AGENTS.md                         # Agent-facing project guide
├── README.md, LICENSE                # Standard repo metadata
├── CHANGELOG.md, CODE_OF_CONDUCT.md, CONTRIBUTING.md, SECURITY.md
│
│   --- Permanent skill artifacts ---
├── STRUCTURE.md                      # ← this file
├── REVERT_PLAN.sh                    # Rollback for the 2026-09-03 reorganization
└── STRUCTURE_PROPOSAL.md             # ← will be removed once you accept STRUCTURE.md
```

---

## What lives here

| Path | Purpose |
|---|---|
| `apps/` | Deployable applications. Each has its own `package.json` and root conventions. Do NOT touch from this skill — each workspace has its own root. |
| `packages/` | Shared libraries across workspaces. Same rule as `apps/` — out of scope for root organization. |
| `docs/` | All project documentation. Subcategories: `legacy/` (outdated), `design/`, `diagrams/`, `handoffs/`, plus category-level `.md` files. |
| `scripts/` | Utility scripts. Subfolder `sql/` for SQL fixes, `workspace-tools/` for pnpm workspace helpers. |
| `supabase/` | Supabase config, migrations, edge functions. Project-internal, treated as a single source root. |
| `specs/` | Specify spec-driven-dev artifacts (numbered spec directories). |
| `sandbox/`, `context_output/` | Working directories. Both gitignored; contain throwaway experiments. |
| `masarx-remotion-ad/`, `masarx-video-ad/` | Sibling ad-generation projects kept at root by design. NOT part of pnpm workspace. Move only by explicit decision. |
| `my-project/` | **Flagged.** Contains `.opencode/` + `.specify/` — appears to be an OpenCode/Specify scaffolded workspace. Empty of code. Awaiting user decision: delete or relocate. |
| `pnpm-lock.yaml.bak` | Lockfile backup. Convention violation to coexist with active lockfile. Awaiting user decision. |
| `AGENTS.md` | Agent-facing project conventions. Read this before any agent task. |
| `STRUCTURE.md` | This file. |
| `REVERT_PLAN.sh` | Rollback for the 2026-09-03 reorganization. Safe to delete once you're confident in the new layout. |

### Config files (do not move)

| File | Locked because |
|---|---|
| `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` | pnpm reads from root |
| `.env`, `.env.example`, `.env.local` | dotenv convention; `.env*` files stay at root (local ones gitignored) |
| `.gitignore`, `.gitattributes` | git reads from root |
| `.editorconfig`, `.npmrc`, `.cssrc.json` | Tooling configs read from root |
| `.eslintrc.json`, `.stylelintrc.json`, `.markdownlint.jsonc`, `.gitleaks.toml` | Linters / scanners read from root |
| `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` | TypeScript reads from root |
| `drizzle.config.ts` | Drizzle ORM reads from root |
| `vercel.json` | Vercel reads from root |
| `.github/`, `.vscode/`, `.opencode/`, `.cursor/`, `.windsurf/` | Tooling / IDE / CI reads these from root |
| `.agents/`, `.context/`, `.specify/` | Agent / Specify tooling reads from root |
| `.cursorignore`, `.windsurfignore` | AI tool ignore files |
| `AGENTS.md`, `README.md`, `LICENSE`, `CHANGELOG.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md` | Standard project metadata |

### What was reorganized in 2026-09-03

| File / dir | Moved from | Moved to |
|---|---|---|
| 8 tracked files | (root) | `docs/`, `docs/legacy/`, `scripts/`, `scripts/sql/`, `.specify/` |
| 9 untracked files | (root) | **deleted** (with explicit user approval) |
| `.trash/` | (root) | **deleted recursively** |
| `.gitignore` patterns | — | added `.tmp_old_*.txt`, `.vercel/`, `sandbox/` |
| `my-project/` | (root) | **flagged — non-empty, contains `.opencode/` + `.specify/`** |

To reverse the moves (not the deletions): `bash REVERT_PLAN.sh`.

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
9. **Is it media?** → `public/` (if served at URL) or `assets/` (if imported by code).
10. **Is it a build artifact?** → **`.gitignore`**, not deletion.
11. **Still unsure?** → Flag in the PR description, don't move it.

**Important for this repo:** if you're adding a top-level file, check whether it belongs inside one of the existing top-level dirs first (most things do). The convention is "thin root".

---

## When this guide gets stale

This guide gets out of date the moment a top-level file is added or moved. Update it in the same PR that changes the root layout. The maintainer of the PR owns the update.

If a future reorganization is needed, run `organize-root` again — Phase 0 (idempotency check) will detect this file and offer to re-scan rather than duplicating layout.

---

## Open items (still flagged from the 2026-09-03 run)

These were deliberately left untouched. Decide on them separately:

- **`my-project/`** — Untracked dir at root, not empty (contains `.opencode/` + `.specify/` tool scaffolding). Looks like an orphaned OpenCode/Specify workspace session. Decision pending.
- **`masarx-remotion-ad/`** — Sibling Remotion ad project. Out of pnpm workspace by design. Move only if explicitly promoted.
- **`masarx-video-ad/`** — Same as above for video ads.
- **`pnpm-lock.yaml.bak`** — Lockfile backup file. Convention violation; should not coexist with active lockfile. Decision pending.
