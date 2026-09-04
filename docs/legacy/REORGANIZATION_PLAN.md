# Masar X — Repository Reorganization Plan

**Date:** 2026-06-01
**Status:** Pending Execution
**Project:** masarx-app v0.5.6 — Next.js 16 + React 19 + TypeScript + Tailwind + Supabase + Drizzle + next-intl (Vercel)

---

## Executive Summary

- **No `.cursorignore` or `.windsurfignore` exist** — AI tools scan the entire tree including `node_modules/`, `.next/`, and ~1.4 MB of root-level noise every query.
- **~13 MB of heavy/local data** (`sandbox/`, `models/`, build caches, audit dumps) sits exposed to AI context windows, wasting tokens.
- **`.gitignore` line 71 (`*.sql`) blocks all SQL files** — including `supabase/migrations/` which must be tracked. This is a data-loss risk.
- **Root directory has 50+ files** — 24 of which are documentation/scratch files that should be consolidated into `docs/`.
- **`public/logo_EN.png` is 974 KB** — converting to WebP saves ~870 KB per page load.

---

## Current Architecture Map

```
masarx_next/
├── .agents/                  # AI agent configs
├── .cursor/                  # Cursor IDE (worktrees.json)
├── .git/                     # Git
├── .github/                  # CI templates
├── .next/                    # Build cache (gitignored)
├── .opencode/                # 14 speckit command files
├── .specify/                 # Spec-Kit memory + templates
├── .vercel/                  # Vercel metadata (gitignored)
├── .vscode/                  # Editor settings
├── .windsurf/                # 50+ plan files (~120 KB) + rules
├── models/                   # ~1 byte (essentially empty)
├── node_modules/             # Dependencies (gitignored)
├── public/                   # 1.7 MB static assets (4 large files)
├── sandbox/                  # 6.5 MB experiments (gitignored)
├── scripts/                  # 3 helper scripts (67 KB)
├── specs/                    # 3 historical specs (186 KB)
├── src/                      # 414 source files
│   ├── actions/              # 3
│   ├── app/                  # 77
│   ├── components/           # 161
│   ├── config/               # 1
│   ├── constants/            # 4
│   ├── contexts/             # 3
│   ├── hooks/                # 37
│   ├── i18n/                 # 2
│   ├── lib/                  # 29
│   ├── messages/             # 80 (ar/en JSON)
│   ├── styles/               # 1
│   ├── types/                # 6
│   └── utils/                # 3
├── supabase/                 # migrations, functions, migrations.old, blackbox, audited-files
└── [50+ root-level files]
```

---

## Context Hazards Registry

| Path | Size | Risk Level | Reason | Recommended Action |
|---|---:|---|---|---|
| `.cursorignore` | — | **Critical** | Does not exist — AI scans everything | Create file |
| `.windsurfignore` | — | **Critical** | Does not exist — AI scans everything | Create file |
| `.gitignore` line 71 (`*.sql`) | — | **Critical** | Blocks `supabase/migrations/*.sql` from being tracked | Fix rule to exclude migrations |
| `tsconfig.tsbuildinfo` | 508 KB | High | TS build cache, pure noise in AI context | Add to AI ignore files |
| `pnpm-lock.yaml` | 343 KB | High | Lockfile — needed in Git, not in AI context | Add to AI ignore files only |
| `pnpm-list.json` | 294 KB | High | Full dep tree dump, not gitignored | Add to `.gitignore` + AI ignore |
| `audit_log.md` | 185 KB | High | Append-only agent log, transient | Add to `.gitignore` + AI ignore |
| `MASAR_X_AUDIT_REPORT.md` | 64 KB | High | One-shot audit, transient | Add to `.gitignore` + AI ignore |
| `.windsurf/plans/` | ~120 KB | High | 50+ stale plan files | Archive or delete old plans |
| `tsconfig.app.tsbuildinfo` | 78 KB | Medium | TS build cache | Covered by `*.tsbuildinfo` pattern |
| `tsconfig.node.tsbuildinfo` | 58 KB | Medium | TS build cache | Covered by `*.tsbuildinfo` pattern |
| `temp-prompt.txt` | 29 KB | Medium | Scratch file | Add to `.gitignore` + AI ignore |
| `structure.txt` | 27 KB | Medium | Generated dump | Add to `.gitignore` + AI ignore |
| `DESIGN.json` | 25 KB | Medium | Design data — should be tracked but organized | Move to `docs/design/` |
| `SETUP.md` | 24 KB | Medium | Setup guide — should be tracked but organized | Move to `docs/` |
| `DESIGN.md` | 22 KB | Medium | Design doc — should be tracked but organized | Move to `docs/design/` |
| `public/logo_EN.png` | 974 KB | Medium | Uncompressed PNG logo | Convert to WebP (<100 KB) |
| `public/favicon.svg` | 397 KB | Medium | Abnormally large SVG (likely embedded raster) | Audit and compress |
| `sandbox/` | 6.5 MB | Medium | Experiments, already gitignored | Add to AI ignore files |
| `models/` | ~1 byte | Low | Empty directory | Delete |
| `analyze_branches.ps1` | 0 bytes | Low | Empty file | Delete |
| `arena.txt` | 0 bytes | Low | Empty file | Delete |
| `vite.config.ts.timestamp-*.mjs` | 14 KB | Low | Stale Vite artifact | Add to `.gitignore` + AI ignore |
| `.env.local.bak` | 2.3 KB | Low | Backup env with potential secrets | Do NOT delete — add to all ignore files |

---

## Action Plan

### 1. Create `.cursorignore`
- [ ] Create `.cursorignore` at project root with the content specified in section 7 below.
- **Type:** create
- **Files:** `.cursorignore`

### 2. Create `.windsurfignore`
- [ ] Create `.windsurfignore` at project root with the content specified in section 7 below (identical to `.cursorignore`).
- **Type:** create
- **Files:** `.windsurfignore`

### 3. Fix `.gitignore` `*.sql` rule
- [ ] On line 71 of `.gitignore`, replace the single line `*.sql` with:
  ```
  *.sql
  !supabase/migrations/**/*.sql
  ```
- **Type:** modify
- **Files:** `.gitignore`

### 4. Add missing entries to `.gitignore`
- [ ] Append the lines specified in section 8 below to the end of `.gitignore`.
- **Type:** modify
- **Files:** `.gitignore`

### 5. Delete zero-byte files
- [ ] Delete `analyze_branches.ps1` (0 bytes)
- [ ] Delete `arena.txt` (0 bytes)
- **Type:** delete
- **Files:** `analyze_branches.ps1`, `arena.txt`

### 6. Delete empty `models/` directory
- [ ] Delete `models/` directory (contains ~1 byte, no meaningful content)
- **Type:** delete
- **Files:** `models/`

### 7. Create `docs/` structure and move files
- [ ] Create `docs/design/`
- [ ] Move `DESIGN.md` → `docs/design/DESIGN.md`
- [ ] Move `DESIGN.json` → `docs/design/DESIGN.json`
- [ ] Create `docs/audits/`
- [ ] Move `MASAR_X_AUDIT_REPORT.md` → `docs/audits/MASAR_X_AUDIT_REPORT.md`
- [ ] Move `BRANCH_ANALYSIS.md` → `docs/audits/BRANCH_ANALYSIS.md`
- [ ] Move `audit_log.md` → `docs/audits/audit_log.md`
- [ ] Create `docs/diagrams/`
- [ ] Move `vizvibe.mmd` → `docs/diagrams/vizvibe.mmd`
- [ ] Create `docs/scratch/`
- [ ] Move `temp-prompt.txt` → `docs/scratch/temp-prompt.txt`
- [ ] Move `structure.txt` → `docs/scratch/structure.txt`
- [ ] Move `files.txt` → `docs/scratch/files.txt`
- [ ] Move `compare.md` → `docs/scratch/compare.md`
- **Type:** create + move
- **Files:** see above
- **Note:** After moving, remove `DESIGN.md` and `DESIGN.json` from `.gitignore` additions since they are now organized tracked docs. Keep `audit_log.md`, `MASAR_X_AUDIT_REPORT.md`, and `BRANCH_ANALYSIS.md` in `.gitignore` since they are transient reports.

### 8. Move `proxy.ts` to `scripts/`
- [ ] Move `proxy.ts` → `scripts/proxy.ts`
- **Type:** move
- **Files:** `proxy.ts`

### 9. Compress `public/logo_EN.png` and audit `favicon.svg`
- [ ] Convert `public/logo_EN.png` to WebP format (target < 100 KB). Save as `public/logo_EN.webp` and update all references in `src/`.
- [ ] Open `public/favicon.svg` and check for embedded raster images (`<image>` tags with `data:image/png` or `data:image/jpeg` hrefs). Strip them and keep pure vector paths. Target < 10 KB.
- **Type:** modify
- **Files:** `public/logo_EN.png`, `public/favicon.svg`, and any source files referencing the logo path

### 10. Clean `.windsurf/plans/`
- [ ] Delete any plan files in `.windsurf/plans/` older than 30 days, or move all to `.windsurf/plans/archive/`.
- **Type:** delete or move
- **Files:** `.windsurf/plans/*.md`

---

## Proposed Final Architecture

```
masarx_next/
├── .github/
├── .opencode/
├── .vscode/
├── .windsurf/
│   ├── plans/
│   │   └── archive/          # or cleaned
│   ├── rules/
│   └── workflows/
├── .cursor/
├── .agents/
├── .specify/
│
├── public/
│   ├── logo_EN.webp          # compressed (was 974 KB PNG)
│   ├── logo_AR.png
│   ├── favicon.svg           # cleaned (was 397 KB)
│   └── favicon.ico
│
├── src/
│   ├── actions/
│   ├── app/
│   ├── components/
│   ├── config/
│   ├── constants/
│   ├── contexts/
│   ├── hooks/
│   ├── i18n/
│   ├── lib/
│   ├── messages/
│   ├── styles/
│   ├── types/
│   └── utils/
│
├── supabase/
│   ├── migrations/
│   └── functions/
│
├── scripts/
│   └── proxy.ts              # moved from root
│
├── specs/
│
├── docs/                     # NEW
│   ├── design/
│   │   ├── DESIGN.md
│   │   └── DESIGN.json
│   ├── audits/
│   │   ├── MASAR_X_AUDIT_REPORT.md
│   │   ├── BRANCH_ANALYSIS.md
│   │   └── audit_log.md
│   ├── diagrams/
│   │   └── vizvibe.mmd
│   └── scratch/
│       ├── temp-prompt.txt
│       ├── structure.txt
│       ├── files.txt
│       └── compare.md
│
├── .cursorignore             # NEW
├── .windsurfignore           # NEW
├── .gitignore                # FIXED + APPENDED
├── .editorconfig
├── .eslintrc.json
├── .stylelintrc.json
├── .npmrc
├── .cssrc.json
├── .gitattributes
│
├── .env.example
├── .env.local.bak            # KEPT — in all ignore files
├── AGENTS.md
├── README.md
├── PRODUCT.md
├── LICENSE
│
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
│
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── next.config.mjs
├── next-env.d.ts
├── eslint.config.mjs
├── tailwind.config.js
├── postcss.config.js
├── drizzle.config.ts
├── vercel.json
└── skills-lock.json
```

---

## `.cursorignore` / `.windsurfignore` Content

Create both files with this identical content:

```gitignore
# Dependencies & Build Outputs
node_modules/
.next/
.vercel/
.turbo/
.cache/
*.tsbuildinfo

# Heavy Dumps & Lockfiles
pnpm-lock.yaml
pnpm-list.json

# Local Data & Experiments
sandbox/
models/
supabase/.temp/
supabase/migrations.old/
supabase/blackbox/
supabase/audited-files/

# AI Editor Internals
.cursor/
.windsurf/
.opencode/
.agents/
.specify/
.vscode/

# Environment & Secrets
.env
.env.local
.env.*.local
.env.local.bak

# Transient Reports & Token Bloat
audit_log.md
MASAR_X_AUDIT_REPORT.md
BRANCH_ANALYSIS.md
DESIGN.json
SETUP.md
structure.txt
files.txt
arena.txt
temp-prompt.txt
compare.md
vizvibe.mmd
SQL_FIX_VIDEOS_RATINGS.sql
vite.config.ts.timestamp-*.mjs
analyze_branches.ps1
*.bak
```

---

## `.gitignore` Additions

Append these lines to the end of `.gitignore` (do NOT remove existing lines):

```gitignore
# === Added by Reorganization Plan ===

# Heavy transient files
pnpm-list.json
audit_log.md
MASAR_X_AUDIT_REPORT.md
BRANCH_ANALYSIS.md
*.tsbuildinfo
*.bak
vite.config.ts.timestamp-*.mjs
temp-prompt.txt
structure.txt
files.txt
arena.txt
compare.md
vizvibe.mmd
SQL_FIX_VIDEOS_RATINGS.sql
analyze_branches.ps1

# Heavy local data
/models/
/sandbox/
/supabase/blackbox/
/supabase/audited-files/
/supabase/migrations.old/

# Env backups
.env.local.bak
```

**And fix line 71** — replace:
```
*.sql
```
with:
```
*.sql
!supabase/migrations/**/*.sql
```

---

## Notes & Warnings

1. **`supabase/migrations.old/`** — Before deleting, archive to a separate branch or `docs/migrations-archive/`. Old migrations may be needed to replay production database state.

2. **`pnpm-lock.yaml`** — Remains tracked in Git. It is only listed in `.cursorignore` / `.windsurfignore` to prevent AI from indexing it. Do NOT add it to `.gitignore`.

3. **`.env.local.bak`** — Kept at root by user request. Do NOT delete, modify, or move it. It is added to all three ignore files (`.gitignore`, `.cursorignore`, `.windsurfignore`) to prevent AI context exposure and accidental commits.

4. **`src/components/` (161 files)** — This is the largest folder. A follow-up audit is recommended to group components by domain (e.g., `auth/`, `exam/`, `ui/`, `layout/`) rather than leaving them flat. This plan does not touch `src/` internals.

5. **`public/logo_EN.png` → WebP conversion** — After creating `logo_EN.webp`, search all `src/` files for references to `logo_EN.png` and update them. Keep the original PNG until all references are migrated, then delete it.

6. **`docs/audits/` files in `.gitignore`** — `audit_log.md`, `MASAR_X_AUDIT_REPORT.md`, and `BRANCH_ANALYSIS.md` remain in `.gitignore` even after moving to `docs/audits/` because they are transient generated reports. `DESIGN.md` and `DESIGN.json` should be REMOVED from `.gitignore` after moving to `docs/design/` since they are intentional tracked documentation.

7. **Step ordering matters** — Create ignore files (steps 1-2) and fix `.gitignore` (steps 3-4) before moving files (step 7). This prevents accidental commits of sensitive or heavy files during the reorganization.
