# Tasks: Tailwind CSS v4 (Oxide) Upgrade — apps/web

**Input**: Design documents from `/specs/026-tailwind-v4-upgrade/` (spec.md, plan.md, research.md D1–D15, data-model.md, contracts/class-name-contract.md, quickstart.md)

**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/ ✅ · quickstart.md ✅

**Tests**: No NEW test files are created (spec FR-010 scope isolation). Verification = existing gates (`typecheck`/`lint`/`test`/`e2e`), grep gates (SC-002), and the quickstart parity matrix.

**Organization**: Tasks grouped by user story (spec.md: US1 P1 engine swap · US2 P1 theme port · US3 P1 rename sweep · US4 P2 regression gates). Story phases map to plan.md commits: US1=C1, US2=C2, US3=C3+C4, US4=C5.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1…US4)
- Every edit task names its exact file(s); verification tasks name their gate

**Path Conventions**: all edit work is inside `apps/web/` (FR-010 scope isolation). Repo-root commands run from `C:\programming\WEB_Development\projects\masarx_next`.

---

## Phase 1: Setup

**Purpose**: prove a green starting point and freeze the v3 baseline that every later gate is measured against.

- [ ] T001 Pre-flight at repo root: confirm branch `feat/026-tailwind-v4-upgrade` (`git branch --show-current`), Node ≥ 20 (`node -v`), clean `pnpm install`; record the unrelated dirty paths (`apps/mobile/*`, `.gitignore`, `.freebuff/`) as NEVER-TOUCH (I8/I14) in the PR notes
- [ ] T002 Capture the v3 baseline per quickstart.md §3/§6: compiled CSS size (`find apps/web/.next -name "*.css" -exec du -ch {} +` after a `pnpm --filter web build`), grep counts for EVERY row of contracts/class-name-contract.md §2, and one green run of `pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web test && pnpm --filter web test:e2e`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: reconcile the measured baseline with the spec before any edit; drift found here blocks all stories.

**⚠️ CRITICAL**: No user story work until T003 passes.

- [ ] T003 Reconcile T002's per-row grep counts against the spec.md Story-3 baseline table (outline-none 143, shadow-sm 82, bare shadow 58, ring-offset 66, bare ring 27, bg-gradient 33, backdrop-blur-sm 12, bg-opacity 12, flex-shrink 16, blur-sm 12, rounded-sm 4, flex-grow 5, space-reverse 8); emit the per-rule file hit lists (grep output into PR evidence notes) and investigate ANY drift before sweeping

**Checkpoint**: baseline frozen — US1 can begin.

---

## Phase 3: User Story 1 — Build pipeline runs on Tailwind v4 (Priority: P1) 🎯 MVP

**Goal**: `apps/web` compiles through Tailwind v4 Oxide via `@tailwindcss/postcss`, with the JS config bridged by `@config`, a permanent v3-defaults compat block, and both custom variants in CSS — zero visual change.

**Independent Test** (spec US1): `pnpm --filter web build` green + dev boot; pages using ax-*/brand tokens render identically in dark and light.

### Implementation for User Story 1

- [ ] T004 [US1] In apps/web/package.json: set `tailwindcss` to `^4`, add `@tailwindcss/postcss` `^4`, remove `autoprefixer`; run `pnpm install` (research D1/D14)
- [ ] T005 [US1] Rewrite apps/web/postcss.config.js to `export default { plugins: { "@tailwindcss/postcss": {} } }`
- [ ] T006 [US1] Replace the three `@tailwind` directives at the top of apps/web/src/index.css with `@import "tailwindcss";` + `@source "../src/**/*.{js,ts,jsx,tsx}";` + `@config "../../tailwind.config.js";` (research D1)
- [ ] T007 [US1] Add to apps/web/src/index.css the permanent v3-defaults compat block per research D2 (`@layer base { *, ::after, ::before, ::backdrop, ::file-selector-button { border-color: var(--color-gray-200, currentColor); } }` and `@theme { --default-ring-width: 3px; --default-ring-color: var(--color-blue-500); }` with a comment pointing to research.md D2) plus `@custom-variant dark (&:where(.dark, .dark *));` and `@custom-variant hover-device (@media (any-hover: hover));` (research D10)
- [ ] T008 [US1] Verify C1 gate (commit C1): `pnpm --filter web build` green (SC-001); dev boot with dark/light toggle identical; `grep -c "@tailwind" apps/web/src/index.css` = 0; a bare-border element computes gray-200 in devtools; grep gates still show v3 names (expected — sweep is US3)

**Checkpoint**: engine swapped, zero visual change — independently shippable (MVP).

---

## Phase 4: User Story 2 — Theme ported to CSS @theme (Priority: P1)

**Goal**: single source of truth moves into `@theme`/`@utility` in `src/index.css`; `tailwind.config.js` retired; call-site names unchanged.

**Independent Test** (spec US2): every former token resolves as a utility with identical computed values; config file gone with no build error.

### Implementation for User Story 2

- [ ] T009 [US2] In apps/web/src/index.css add `@theme` color vars per research D5: 24 `--color-ax-*` (incl. nested flattening `ax-surface-hover`, `ax-accent-soft`, `ax-edge-strong`, `ax-on-accent`, `ax-tooltip-bg/fg`), 5 `--color-brand-*` (`rgb(var(--brand-*))` for triplets, `#8b5cf6` for purple), `--color-primary-foreground: hsl(var(--primary-foreground))`
- [ ] T010 [US2] In apps/web/src/index.css `@theme` add `--breakpoint-xs: 475px; --breakpoint-tablet: 820px;` (research D5/data-model)
- [ ] T011 [US2] In apps/web/src/index.css `@theme` add the 9 `--text-*` sizes with `--text-*--line-height` pairs exactly as apps/web/tailwind.config.js lines 76–86 (xs…5xl, incl. `--text-5xl--line-height: 1`) (research D6)
- [ ] T012 [US2] In apps/web/src/index.css `@theme` add `--spacing-18/88/128` + `--spacing-ax-sidebar: var(--ax-space-sidebar)` + `--spacing-ax-sidebar-collapsed: var(--ax-space-sidebar-collapsed)`, `--shadow-ax-sm/md/lg: var(--ax-shadow-*)`, `--ease-ax-standard: var(--ax-ease-standard)`, `--animate-wiggle` + `--animate-ping-slow` with `@keyframes wiggle` defined INSIDE `@theme` (research D7–D9)
- [ ] T013 [US2] In apps/web/src/index.css add static `@utility z-header/sidebar/modal/popover/toast/tooltip { z-index: 40/45/50/55/60/70 }` and `@utility duration-ax-fast/base/slow { transition-duration: var(--ax-dur-*) }` — NO namespaces exist for these in v4.3 (research D3/D4)
- [ ] T014 [US2] Remove the `@config` line from apps/web/src/index.css and retire the JS config with `git rm apps/web/tailwind.config.js` (approved-deletion path, I9)
- [ ] T015 [US2] Verify C2 gate (commit C2): build green; devtools spot-checks of identical computed values for `bg-ax-accent-soft/50` (alpha via color-mix), `text-brand-navy`, `tablet:` breakpoint, `text-5xl` line-height 1, `w-ax-sidebar`, `shadow-ax-md`, `animate-ping-slow` (ping keyframes present — fallback research D9), `ease-ax-standard`, `z-popover`, `duration-ax-fast`; `ls apps/web/tailwind.config.js` fails

**Checkpoint**: CSS-first theme complete — `tailwind.config.js` gone, all 223 consumer files untouched.

---

## Phase 5: User Story 3 — v3→v4 breaking-change sweep (Priority: P1)

**Goal**: every renamed/changed utility (contracts §2) reaches the v4 spelling with v3-equivalent rendering; v3 spellings reach 0 hits.

**Independent Test** (spec US3): targeted greps return 0 for every contract §2 row; spot-check pages render identically to the T002 baseline.

**Execution note**: all sweep tasks edit overlapping files (e.g. HomeClient.tsx matches several rules) — run SEQUENTIALLY in ID order; do not parallelize. Sweep scope is `apps/web/src/**/*.{ts,tsx}` including the 147 dynamic template literals and `src/constants/notifications.ts` + `src/constants/assistantUIStyles.ts` (research D15). Verify each rule with its grep BEFORE moving on.

### Implementation for User Story 3 (plan commit C3 — scale renames)

- [ ] T016 [US3] Sweep `outline-none` → `outline-hidden` (baseline 143) across apps/web/src — v3's forced-colors-preserving behavior maps to `outline-hidden` (contract §2)
- [ ] T017 [US3] Sweep shadow scale in apps/web/src IN THIS ORDER: first `shadow-sm` → `shadow-xs` (82), THEN bare `shadow` → `shadow-sm` (58) — reversing the order corrupts the sweep (contract §2)
- [ ] T018 [US3] Sweep `bg-gradient-to-*` → `bg-linear-to-*` (baseline 33) across apps/web/src, explicitly including apps/web/src/constants/notifications.ts and apps/web/src/constants/assistantUIStyles.ts
- [ ] T019 [US3] Convert `bg-opacity-*`/`text-opacity-*`/`border-opacity-*` usages (baseline 12) to color/alpha suffix form (e.g. `bg-white bg-opacity-75` → `bg-white/75`) across apps/web/src
- [ ] T020 [US3] Sweep `flex-shrink-*` → `shrink-*` (16) and `flex-grow-*` → `grow-*` (5) across apps/web/src
- [ ] T021 [US3] Sweep blur scales in apps/web/src IN THIS ORDER: `blur-sm` → `blur-xs` (12) then bare `blur` → `blur-sm` (~8); `backdrop-blur-sm` → `backdrop-blur-xs` (12) then bare `backdrop-blur` → `backdrop-blur-sm` (~7)
- [ ] T022 [US3] Sweep `rounded-sm` → `rounded-xs` (4) and `drop-shadow-sm` → `drop-shadow-xs` (1) across apps/web/src
- [ ] T023 [US3] Verify C3 gate (commit C3): SC-002 greps = 0 for T016–T022 rows; build + typecheck + lint + test green; per-file diff review of every touched file (I10)

### Implementation for User Story 3 (plan commit C4 — ring & audit)

- [ ] T024 [US3] Pin the 27 bare `ring` sites in apps/web/src to explicit `ring-3` (+ an explicit color where the site relied on v3's blue-500 default) — hotspots per spec: desktop/workspace/AssistantPanel.tsx, desktop/workspace/ReaderToolbar.tsx, UpdateToast.tsx, desktop/CustomTitlebar.tsx
- [ ] T025 [US3] Audit the 66 `ring-offset-*` sites in apps/web/src against v4 shadow stacking (compute box-shadow output for one representative per file) and verify the 8 `space-x-reverse`/`space-y-reverse` sites behave identically under v4 margin logic
- [ ] T026 [US3] Verify C4 gate (commit C4): bare-ring grep = 0; build + `pnpm --filter web test:e2e` green; visual spot-check of the affected components (desktop workspace panels, UpdateToast, ring-offset hosts)

**Checkpoint**: all renamed utilities migrated; compat layer from T007 remains as the documented default-restoration contract.

---

## Phase 6: User Story 4 — Regression gates (Priority: P2)

**Goal**: prove parity — every SC demonstrable from PR evidence.

**Independent Test** (spec US4): all four gate commands green + parity matrix complete.

- [ ] T027 [US4] Run the full gate suite: `pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web test && pnpm --filter web test:e2e` (SC-003); run the FR-010 scope check `git diff --stat main...HEAD -- . ':(exclude)apps/web' ':(exclude)specs' ':(exclude)AGENTS.md'` and confirm 0 lines (SC-006)
- [ ] T028 [US4] Produce the SC-005 comparison (compiled CSS size v3 from T002 vs v4) and complete the quickstart.md §5 parity matrix (dark/light × ar/en on home, subject, quiz, chat, admin, desktop shell); assemble the PR evidence table (baseline counts, greps, sizes, matrix)

**Checkpoint**: zero-visual-regression claim is evidence-backed.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T029 Final cross-cutting audit: confirm FR-008 (unlayered custom classes in apps/web/src/index.css byte-identical vs main — `git diff main...HEAD -- apps/web/src/index.css` reviewed), FR-009 (zero i18n/brand copy changes — I3/I13), PR-010 residue (no files outside apps/web+specs+AGENTS.md touched), update the AGENTS.md 026 row status to implementation-complete state, delete the `.agents/` claim file after push (I14)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001–T002)**: no dependencies — start immediately
- **Foundational (T003)**: depends on T002 — BLOCKS all user stories (drift invalidates the gates)
- **US1 (T004–T008)**: depends on T003; independently shippable (MVP)
- **US2 (T009–T015)**: depends on US1 (the engine must run for `@theme` to compile); C2 removes the `@config` bridge US1 introduced
- **US3 (T016–T026)**: depends on US2 (sweep validates against the final engine); C3 before C4 (ring pinning assumes renames done)
- **US4 (T027–T028)**: depends on US1+US2+US3 complete
- **Polish (T029)**: depends on US4

### Within Each Story

- Edit tasks are ordered so grep gates of earlier tasks stay valid (T017/T021 encode rename ORDER explicitly)
- Each story ends with a Verify task that is also its commit gate (C1–C5 in plan.md)
- Commit after each Verify task passes — 5 implementation commits total, each independently revertible

### Parallel Opportunities

- **None between edit tasks** — deliberately: T009–T013 all edit the same `apps/web/src/index.css`, and the US3 sweeps share hit-files across rules (e.g. HomeClient.tsx matches outline/shadow/blur rules), so parallel execution would collide. The one safe parallelism is per-file DIFF REVIEW inside T023/T029, which can be distributed.
- Stories must also be sequential (US2 removes US1's bridge; US3 validates on the final engine) — this is a pipeline upgrade, not independent features.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001–T003 (setup + baseline)
2. T004–T008 (engine swap with `@config` bridge + compat layer)
3. **STOP and VALIDATE**: zero visual change on the dev server — this state is safely mergeable and deployable on its own

### Incremental Delivery

1. US1 merged → engine on v4, UI unchanged
2. US2 merged → CSS-first theme, config retired
3. US3 merged (C3 then C4) → all v4 spellings, defaults contract documented
4. US4 + Polish → gates, evidence, PR review

### Notes

- Every commit passes 08-precommit gates; explicit-path staging only (`git add <paths>`, never `git add .`) — I14
- The official `@tailwindcss/upgrade` codemod stays the documented fallback ONLY if the tree becomes clean (research D11)
- Reconcile `git log` before each commit — parallel sessions commit on this repo (memory: known pattern)
