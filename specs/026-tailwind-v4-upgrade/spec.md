# Feature Specification: Tailwind CSS v4 (Oxide) Upgrade — apps/web

**Feature Branch**: `feat/026-tailwind-v4-upgrade`

**Created**: 2026-09-29

**Status**: Draft

**Type**: Refactor/Upgrade — **MVP Lock explicitly lifted for this track by owner decision (2026-09-29)**. I12 is satisfied for the 026 track only (spec → plan → tasks → implement); the lock remains in force for all other work. The lock file (`docs/agents/references/09-mvp-lock.md`) is NOT deleted by this lift.

**Input**: User description: "Upgrade Tailwind CSS from v3.4 to v4 (Oxide engine) in apps/web: replace tailwind.config.js with the CSS-first @theme system, and manage all breaking changes with zero visual regression."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Build pipeline runs on Tailwind v4 (Priority: P1)

apps/web compiles its stylesheet through Tailwind CSS v4.x (Oxide engine) using the PostCSS plugin `@tailwindcss/postcss` and the CSS-first entry `@import "tailwindcss"` in `src/index.css`. The v3 packages (`tailwindcss@^3.4.1`, `autoprefixer`) are removed from `apps/web/package.json`, and `postcss.config.js` references only `@tailwindcss/postcss`. Because v4 changes engine-level defaults (default border color `gray-200` → `currentColor`, default ring width `3px` → `1px`), this story includes a **temporary compat layer** neutralizing those engine deltas so the slice ships with zero visual change; the exact technique (base-layer bridge / `@utility` overrides / early pinning) is decided at plan phase, and Story 3 removes the layer. The existing JS config keeps working during this story through the official `@config` compatibility directive.

**Why this priority**: the engine swap is the foundation every later story compiles against; with the `@config` bridge + compat layer it is a zero-visual-change slice that can be merged alone.

**Independent Test**: run `pnpm --filter web build` (webpack mode) and boot the dev server on pages using ax-*/brand tokens; UI renders identically in dark and light.

**Acceptance Scenarios**:

1. **Given** the feature branch, **When** `pnpm --filter web build` runs, **Then** it completes with zero PostCSS/Tailwind errors and the dev server boots with the current UI unchanged.
2. **Given** `apps/web/package.json`, **When** inspected, **Then** it declares `tailwindcss@^4` and `@tailwindcss/postcss`, and no longer declares `autoprefixer`; `postcss.config.js` references only `@tailwindcss/postcss`.
3. **Given** `src/index.css`, **When** inspected, **Then** it starts with `@import "tailwindcss";` followed by `@config` referencing the existing config, and contains no `@tailwind` directives.

---

### User Story 2 - Theme ported from JS config to CSS @theme (Priority: P1)

All design tokens move from `tailwind.config.js` into `@theme` blocks inside `src/index.css`, the `@config` bridge is removed, and the JS config is retired via `git rm` in the approved implementation commit (I9 — no unapproved deletions). Custom variants move from the inline JS plugin to CSS:

- `@custom-variant dark (&:where(.dark, .dark *));` — preserving the ThemeScript.tsx pre-paint `.dark`-on-`<html>` strategy (I7).
- `@custom-variant hover-device (@media (any-hover: hover));` — preserving the round-14 touch-tablet fix consumed in `ChatMessageItem.tsx`.

**Token inventory to reproduce** (enumerated from `apps/web/tailwind.config.js`, verified 2026-09-29):

- **colors**: `ax.*` palette (canvas; surface + hover/inset; primary; secondary; muted; edge + edge-strong; accent + hover/soft/soft-hover; on-accent; success + soft; warning + soft; danger + soft; info + soft; tooltip-bg; tooltip-fg) — CSS-var driven with `<alpha-value>`; `brand.{navy,blue,sky,orange}` from `--brand-*` RGB triplets + hardcoded `brand.purple`; `primary.foreground` (shadcn remnant).
- **screens**: `xs: 475px`, `tablet: 820px` (plus framework defaults).
- **fontSize**: xs–5xl overridden with explicit line-height pairs.
- **spacing**: `18`, `88`, `128`, `ax-sidebar`, `ax-sidebar-collapsed`.
- **boxShadow**: `ax-sm`, `ax-md`, `ax-lg`.
- **animation/keyframes**: `wiggle`, `ping-slow`.
- **transitionDuration**: `ax-fast/base/slow`; **transitionTimingFunction**: `ax-standard`.
- **zIndex**: header 40, sidebar 45, modal 50, popover 55, toast 60, tooltip 70.

**Why this priority**: this fulfils the core scope of the upgrade — the CSS-first `@theme` system replaces the JS config as the single source of truth.

**Independent Test**: with the theme ported, every former token resolves as a utility (e.g. `bg-ax-primary/50` with working alpha, `text-brand-navy`, `min-tablet:` breakpoint, `z-popover`, `duration-ax-fast`, `animate-wiggle`), and `tailwind.config.js` is gone with no build error.

**Acceptance Scenarios**:

1. **Given** the retired config tokens, **When** the stylesheet compiles, **Then** every listed token resolves to an identical computed value as under v3.
2. **Given** ThemeScript.tsx toggles `.dark` on `<html>` before first paint, **When** the theme switches, **Then** `dark:` variants behave exactly as in v3 (light/dark parity).
3. **Given** the `hover-device` usages in `ChatMessageItem.tsx`, **When** rendered on an any-hover device vs a touch-only device, **Then** the round-14 behavior is unchanged.
4. **Given** the retired config file, **When** a repo-wide grep runs, **Then** no `tailwind.config.js` remains under apps/web and no build error occurs.

---

### User Story 3 - v3→v4 breaking-change sweep (Priority: P1)

All renamed/behavior-changed utilities are migrated to v4 spellings with v3-equivalent rendered behavior. **Baseline counts measured on `apps/web/src` (2026-09-29)**:

| v3 pattern | count | v4 action |
|---|---|---|
| `outline-none` | 143 | → `outline-hidden` (forced-colors-preserving port) |
| `shadow-sm` / bare `shadow` | 82 / 58 | → `shadow-xs` / `shadow-sm` |
| `ring-offset-*` | 66 | audit against new shadow stacking behavior |
| bare `ring` (vs 165 explicit `ring-N`) | 27 | default width 3px→1px: audit each site, pin explicit `ring-N` where the 3px look is intended |
| `bg-gradient-to-*` | 33 | → `bg-linear-to-*` |
| `backdrop-blur-sm` / bare `backdrop-blur` | 12 / ~7 | → `backdrop-blur-xs` / `backdrop-blur-sm` |
| `bg-opacity-*` | 12 | → alpha suffix on color utilities |
| `flex-shrink-*` / `flex-grow-*` | 16 / 5 | → `shrink-*` / `grow-*` |
| `blur-sm` / bare `blur` | 12 / ~8 | → `blur-xs` / `blur-sm` |
| `rounded-sm` | 4 | → `rounded-xs` |
| `space-x-reverse` / `space-y-reverse` | 8 | verify against v4 margin logic |
| bare `border` / `border-s` / `border-e` / `divide-y` | ~350 proxy | **default color change gray-200→currentColor** — strategy decided at plan phase: per-site explicit color pin vs base-layer bridge; documented in `plan.md` |

The sweep covers **147 dynamic className template literals across 71 files** and class strings held outside components in `src/constants/notifications.ts` and `src/constants/assistantUIStyles.ts`.

**Why this priority**: without the sweep, v4's renamed/changed utilities silently change the UI; it must land with or before the compat-layer removal from Story 1.

**Independent Test**: targeted greps return zero occurrences of the v3-only spellings, and the spot-check pages render identically to the v3 baseline screenshots.

**Acceptance Scenarios**:

1. **Given** the baseline table, **When** the sweep completes, **Then** targeted greps for `outline-none`, `bg-gradient-to-`, `bg-opacity-`, `flex-shrink-`, `flex-grow-` return 0 hits in `apps/web/src`, and the shadow/blur/rounded scale conversions are verified by the same method.
2. **Given** the bare-border sites, **When** the chosen strategy is applied, **Then** borders render the same color as v3 in both light and dark mode.
3. **Given** `tailwind-merge` usage (`cn()` helpers), **When** class strings merge, **Then** v4 class names classify correctly (tailwind-merge 3.6 already targets v4 grammar — verify at plan phase).

---

### User Story 4 - Regression gates (Priority: P2)

Before merge, the upgrade proves parity against the v3 baseline:

1. `pnpm --filter web typecheck`, `pnpm --filter web lint`, `pnpm --filter web test` — green.
2. `pnpm --filter web test:e2e` (route-mocked suites) — green.
3. Dark/light × ar/en spot-check of home, subject detail, quiz play, AI chat, and the admin shell — no visual diff beyond the declared renames.
4. Desktop shell (`data-masarx-desktop` + `src/styles/desktop-shell.css`), the in-web Electron UI components (`src/components/desktop/*`), and KaTeX rendering (`HeavyLatexRenderer`, `dir="ltr"` isolation) are unaffected.
5. Compiled CSS size recorded before/after (expect a reduction; no dead-utility bloat).

**Why this priority**: gates do not add capability but they are what makes "zero visual regression" a verified claim rather than a hope.

**Independent Test**: run the four gate commands and the spot-check matrix; all pass.

**Acceptance Scenarios**:

1. **Given** the completed Stories 1–3, **When** all gates run, **Then** every gate passes and the before/after CSS size comparison is recorded in the PR description.

---

### Edge Cases

- **Unlayered custom CSS must keep beating layered utilities.** `index.css` carries ~40 unlayered classes (`.chat-scrollbar-hidden`, `.zane-ul`/`.zane-ol` markers, `.ax-*` admin classes, `.glass-card`, `.btn-primary`, …) whose precedence over Tailwind utilities is a documented, deliberately-engineered behavior (cascade bug fixes from earlier rounds). v4 uses real cascade layers where unlayered author CSS still wins — verify no ordering regression.
- **Pre-paint dark mode (I7).** `ThemeScript.tsx` is a native inline `<script>` with `suppressHydrationWarning`; it must remain untouched and the `@custom-variant dark` must resolve identically before first paint.
- **Webpack mode.** All scripts run `next dev/build --webpack` (not Turbopack) on Next 16.3.6; `@tailwindcss/postcss` must work in this mode.
- **Standalone output.** `output: "standalone"` desktop packaging must include the v4-compiled CSS.
- **RTL & bidi.** Logical utilities (`border-s/e`, `ms/me`) and bidi classes (`.bidi-ltr`, `.zane-bidi-plaintext`) must be unaffected; KaTeX `dir="ltr"` isolation preserved.
- **Codemod vs dirty tree.** The official `@tailwindcss/upgrade` codemod requires a clean git tree; main currently carries uncommitted work from another session (mobile files, `.gitignore`, `.freebuff/`). Plan phase decides: coordinate to park the dirt, or perform a directed manual sweep. Either way, any codemod output MUST be diff-verified against real repo state (I10).
- **Accepted limitation carried forward.** Assistant actions remain hover-only on hybrid any-hover devices (round-14 ratified trade-off) — this upgrade must NOT attempt to change it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: apps/web MUST compile through tailwindcss v4.x with `@tailwindcss/postcss`; `tailwindcss@3` and `autoprefixer` MUST be removed from apps/web dependencies.
- **FR-002**: The theme MUST be expressed via `@theme` in `src/index.css`; the JS config MUST be retired via `git rm` in an approved implementation commit (I9).
- **FR-003**: Every token in the User Story 2 inventory MUST be reproduced with identical resolved values.
- **FR-004**: Dark mode MUST remain class-driven on `<html>` via `@custom-variant dark`, preserving `ThemeScript.tsx` behavior (I7).
- **FR-005**: The `hover-device` variant MUST be preserved via `@custom-variant` with the identical `any-hover` media condition.
- **FR-006**: Every renamed utility in the User Story 3 table MUST be migrated to the v4 spelling with v3-equivalent rendered behavior, including inside dynamic template literals and constants files.
- **FR-007**: The bare-border default-color strategy MUST be chosen and documented at plan phase and applied consistently across all affected sites.
- **FR-008**: No new `@apply` usage may be introduced; unlayered custom CSS classes MUST be preserved verbatim with their cascade precedence intact.
- **FR-009**: No i18n strings or brand copy may change (I3, I13); visual identity untouched.
- **FR-010**: Scope isolation — only `apps/web` (package.json, postcss.config.js, src/index.css, src/** class strings, retired tailwind.config.js) may change; apps/desktop, apps/mobile, and packages/shared MUST be untouched (verified by `git diff --stat` scope check).
- **FR-011**: If the official codemod is used, its diff MUST be verified against real repo state before commit (I10).
- **FR-012**: All gates in User Story 4 MUST pass before merge.

### Key Entities *(include if feature involves data)*

- **Theme tokens**: the ax/brand/shadcn palette, screens, fontSize scale, spacing, shadows, animations, durations, easing, and zIndex — their single source of truth moves from `tailwind.config.js` to `@theme` in `src/index.css`. The runtime CSS custom properties (`--ax-*`, `--brand-*`, shadcn HSL set) remain the light/dark switching mechanism and MUST NOT be flattened into static values.
- **Custom variants**: `dark` and `hover-device` — defined once via `@custom-variant` in `src/index.css`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `pnpm --filter web build` (webpack mode) completes with zero Tailwind/PostCSS errors.
- **SC-002**: Targeted greps for v3-only spellings (`outline-none`, `bg-gradient-to-`, `bg-opacity-`, `flex-shrink-`, `flex-grow-`) return 0 hits in `apps/web/src`.
- **SC-003**: typecheck, lint, unit tests, and the e2e suite all pass.
- **SC-004**: Visual parity spot-check (dark/light × ar/en on home, subject, quiz, chat, admin) shows no unintended diffs.
- **SC-005**: `tailwind.config.js` absent from apps/web; `postcss.config.js` contains only `@tailwindcss/postcss`; compiled CSS size reported with a before/after comparison.
- **SC-006**: Zero changes outside apps/web (verified by `git diff --stat` scope check).

## Assumptions

- Only apps/web uses Tailwind (verified: no config or deps in apps/desktop, apps/mobile, packages/shared; `sandbox/fcai-anu-guide` is outside the pnpm workspaces and out of scope).
- tailwind-merge 3.6.0 already targets the v4 class grammar (to be re-verified at plan phase).
- This spec requires owner approval before implementation begins (I11); the MVP Lock lift recorded in the Type line covers the whole 026 track (spec → plan → tasks → implement).
- Spec number 026 derived from disk per 10-spec-first (highest on-disk spec = `025_git_hygiene_cleanup`). A remote branch stub `spec/026-turbopack-default` exists but contains no `specs/026` directory (verified 2026-09-29, same commit as main).
- Tooling note: `.specify/scripts/powershell/create-new-feature.ps1` derives the next number with a regex (`^(\d{3,})-`) that only recognizes hyphenated spec dirs; it under-derived **016** from the underscore-style dirs on disk (`025_git_hygiene_cleanup` etc. were invisible to it). The branch and directory were renamed to 026 manually immediately after the script run — use disk-derived numbering, not the script's output, until the script regex is fixed.
