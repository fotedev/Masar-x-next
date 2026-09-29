# Implementation Plan: Tailwind CSS v4 (Oxide) Upgrade — apps/web

**Branch**: `feat/026-tailwind-v4-upgrade` | **Date**: 2026-09-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/026-tailwind-v4-upgrade/spec.md`

## Summary

Upgrade `apps/web` from Tailwind CSS 3.4.19 to v4.x (Oxide engine) with **zero visual regression**. The JS config is replaced by the CSS-first system in `src/index.css`: `@import "tailwindcss"` + explicit `@source`, `@theme` tokens (colors/screens/fontSize/spacing/shadows/animations/ease), static `@utility` for z-index and duration names (no such namespaces exist in v4 — research D3/D4), `@custom-variant` for `dark` and `hover-device`, and a **permanent v3-defaults restoration block** (border gray-200, ring 3px/blue-500 — official compat recipes, research D2) that neutralizes the engine-level default changes for ~350 bare-border and 27 bare-ring call sites. The rename sweep (~1,400 measured sites, 15 categories) is a manual, grep-driven, diff-verified pass — the official codemod is unusable here (dirty tree from a parallel session; I8/I14). tailwind-merge 3.6.0 verified v4-compatible empirically (D12).

**Plan-level refinement vs spec**: the spec called the compat layer "temporary, removed by Story 3"; research showed removal would itself be the breaking moment, so the layer is permanent and documented (research D2). The spec's outcome (zero visual regression, FR-007 strategy decided and documented) is fully satisfied.

## Technical Context

**Language/Version**: TypeScript 5.x · Next.js 16.3.6 (webpack mode: `next dev/build --webpack`) · React 19 · pnpm 9.15.4 monorepo

**Primary Dependencies**: `tailwindcss` 3.4.19 → **4.x** · `postcss` 8.5.26 (unchanged) · `autoprefixer` **removed** · `@tailwindcss/postcss` **added** · `tailwind-merge` 3.6.0 (unchanged, v4 grammar verified)

**Storage**: N/A (styling-only upgrade)

**Testing**: vitest (unit) · Playwright (e2e, route-mocked) · `typecheck`/`lint` gates · grep-based rename gates (SC-002) · visual parity spot-check matrix

**Target Platform**: web (modern browsers — v4 floor: Chrome 111+/Safari 16.4+/Firefox 128+, research D13) + Electron 44.4.5 desktop shell (Chromium ≥ 130, unaffected)

**Project Type**: pnpm monorepo (`apps/web`, `apps/desktop`, `apps/mobile`, `packages/shared`) — Tailwind lives **only** in `apps/web` (verified)

**Performance Goals**: build-time reduction (Oxide engine) and smaller compiled CSS (recorded before/after, SC-005)

**Constraints**: zero visual regression · scope isolation to `apps/web` (FR-010) · I1–I14 invariants · MVP Lock explicitly lifted for this track only (owner, 2026-09-29) · Node 20+ (already enforced by Next 16)

**Scale/Scope**: 223 files with `className`; ~1,400 rename sites across 15 categories; 147 dynamic template literals in 71 files; 5 files modified + 1 retired (`tailwind.config.js`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is an **unratified template** (placeholders only) — the effective governance of this repo is the AGENTS.md invariants table. Checked against it:

| Invariant | Requirement | Status |
|---|---|---|
| I3 | i18n for every user-facing string | ✅ PASS — no strings touched (FR-009) |
| I7 | ThemeScript native `<script>` + `suppressHydrationWarning` | ✅ PASS — untouched; `@custom-variant dark` preserves `.dark`-on-`<html>` (FR-004) |
| I8 | No destructive git ops on dirty tree without consent | ✅ PASS — others' dirty files untouched; manual sweep chosen partly for this (D11) |
| I9 | No direct file deletion — `.trash/` or approved `git rm` | ✅ PASS — `tailwind.config.js` retired via `git rm` inside approved commit C2 |
| I10 | Validate pasted/model output against real repo state | ✅ PASS — every decision verified against live docs + real config; sweep diff-verified |
| I11 | Spec-first: approved spec before code | ✅ PASS — spec.md authored; implementation starts only after owner approval |
| I12 | MVP Lock | ✅ PASS — explicit owner lift for the 026 track (2026-09-29), documented in spec Type line; lock otherwise in force |
| I13 | Brand frozen | ✅ PASS — visual identity/copy untouched; parity gates protect it |
| I14 | Branch isolation + claim file + explicit staging | ✅ PASS — dedicated branch `feat/026-tailwind-v4-upgrade`; `.agents/` claim file active; no `git add .` |

**Post-Phase-1 re-check**: design artifacts introduce no new violations. The compat layer is the *simplest* mechanism that satisfies FR-007 (documented in research D2). No complexity entries required.

## Project Structure

### Documentation (this feature)

```text
specs/026-tailwind-v4-upgrade/
├── spec.md                        # approved-cycle input (user scenarios, FRs, SCs)
├── checklists/requirements.md     # spec quality checklist
├── plan.md                        # this file
├── research.md                    # Phase 0 — 15 verified decisions (D1–D15)
├── data-model.md                  # Phase 1 — token/variant/compat entity model
├── contracts/
│   └── class-name-contract.md     # Phase 1 — utility-name API for 223 consumer files
├── quickstart.md                  # Phase 1 — local verification + gates + rollback
└── tasks.md                       # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
apps/web/                          # ONLY workspace touched (FR-010)
├── package.json                   # C1: tailwindcss ^4, @tailwindcss/postcss; remove autoprefixer
├── postcss.config.js              # C1: { plugins: { "@tailwindcss/postcss": {} } }
├── tailwind.config.js             # C2: retired via git rm (I9)
└── src/
    ├── index.css                  # C1/C2: @import + @source + @theme + @utility + @custom-variant + compat layer
    └── **/*.{ts,tsx}              # C3/C4: rename sweep (223 files, measured baseline)

apps/desktop, apps/mobile, packages/shared, sandbox/fcai-anu-guide   # untouched
```

**Structure Decision**: single-workspace styling upgrade — no new directories, no new components; the entire surface is 5 files plus the mechanical call-site sweep documented in the contract.

## Execution Plan (atomic commits, each independently revertible — 10-spec-first item 5)

Each commit passes the 08-precommit gates (`typecheck`, `lint`, targeted tests) plus its own verification below. Baseline CSS size captured **before C1** (quickstart §6).

### C1 — Engine swap with `@config` bridge + compat layer (Story 1)

- `apps/web/package.json`: `tailwindcss@^4`, `@tailwindcss/postcss@^4`, remove `autoprefixer`; `pnpm install`
- `postcss.config.js`: only `@tailwindcss/postcss`
- `src/index.css`: `@import "tailwindcss";` + `@source "../src/**/*.{js,ts,jsx,tsx}";` + `@config "../../tailwind.config.js";` + compat layer (research D2) + `@custom-variant dark` + `@custom-variant hover-device`
- **Verify**: build green (SC-001); dev boot; dark/light toggle identical; `grep -c "@tailwind" src/index.css` = 0; grep gates still show v3 names (expected — sweep comes later)

### C2 — `@theme` port + `@utility` z/duration + config retirement (Story 2)

- Port all tokens per research D3–D9 into `@theme`/`@utility` blocks; remove `@config` line; `git rm tailwind.config.js` (I9)
- **Verify**: build green; every token group spot-checked as a utility (`bg-ax-accent-soft/50`, `text-brand-navy`, `tablet:`, `text-5xl` line-height, `w-ax-sidebar`, `shadow-ax-md`, `animate-ping-slow`, `ease-ax-standard`, `z-popover`, `duration-ax-fast`) with identical computed values; `ls apps/web/tailwind.config.js` fails; alpha modifier works on a var-triplet color

### C3 — Rename sweep, scale classes (Story 3 part 1)

- Mechanical grep-driven edits per contract §2: `outline-none→outline-hidden` (143), `shadow-sm→shadow-xs` (82), bare `shadow→shadow-sm` (58), `bg-gradient-to-*→bg-linear-to-*` (33), `backdrop-blur-sm→backdrop-blur-xs` (12), `bg-opacity-*→alpha` (12), `flex-shrink/grow→shrink/grow` (21), `blur-sm→blur-xs` (12), `rounded-sm→rounded-xs` (4) — including the 147 dynamic templates and constants files
- **Verify**: SC-002 greps = 0; build green; typecheck/lint/test green; diff review per file (I10)

### C4 — Ring & audit sweep (Story 3 part 2)

- 27 bare `ring` → explicit `ring-3` (+ v3-matching color where the site relied on blue-500); audit `ring-offset-*` (66) against v4 shadow stacking; verify `space-x-reverse` (8) behavior; `drop-shadow-sm` (1)
- **Verify**: bare-ring grep = 0; build + e2e green; visual spot-check of the affected components (desktop workspace panels, UpdateToast, ChatInput area)

### C5 — Gates & evidence (Story 4)

- Full gates: `typecheck` + `lint` + `test` + `test:e2e`; scope check `git diff --stat main...HEAD` (FR-010); CSS size before/after recorded (SC-005); parity matrix completed (quickstart §5); PR opened with the evidence table
- **Verify**: all SCs demonstrable from the PR description

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| bare-border visual regression (~350 sites) | permanent compat layer (D2) — highest-risk item eliminated by design |
| sweep false positives (e.g. `shadow-sm` inside prose/comments) | edits restricted to class-string contexts; per-file diff review (I10); grep gates |
| `ping` keyframes absent from a given v4 minor | C2 verification step; fallback `@keyframes ping` inside `@theme` (D9) |
| older-Safari mobile-web users below v4 floor (D13) | floor documented in PR; owner decision already implied by approved upgrade |
| parallel sessions committing concurrently (memory: known pattern) | re-verify `git log`/status before each commit; explicit-path staging only (I14) |
