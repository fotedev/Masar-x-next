# Spec 027: React Hooks v7 Compiler Rules — Incremental Enablement & `set-state-in-effect` Refactor

| | |
|---|---|
| **Feature Branch** | `feat/027-react-hooks-compiler-rules` |
| **Created** | 2026-09-29 |
| **Status** | DRAFT — awaiting owner approval (I11) **and** explicit MVP-Lock lift (I12) before any implementation commit |
| **Type** | Cross-cutting state-management refactor (per `10-spec-first.md` this category *requires* a spec) |
| **Input** | Dependency-batch plan approved 2026-09-29; measured baseline run (2026-09-29, eslint-plugin-react-hooks 7.1.1 forced, project-faithful config); `eslint.config.mjs` audit |
| **Blocks / Blocked by** | Independent of spec 015 (verified: no shared files, no behavior-change conflict). Blocked only by owner lift. |

## Context & problem statement

`eslint-plugin-react-hooks` v7 expanded its `recommended` preset from 2 rules to 16 compiler rules. PR #63 (2026-09-29) pinned the 14 new rules to `"off"` in `apps/web/eslint.config.mjs:58-71` to preserve v5 behavior under the MVP Lock. This spec re-enables them incrementally, fixing the underlying code instead of suppressing the rules.

**Measured baseline** (full `apps/web` `eslint .` scope, 463 files, plugin 7.1.1, all 14 rules forced to `error`; project ignores/overrides reproduced):

| Rule | Violations | Files |
|---|---|---|
| `react-hooks/set-state-in-effect` | **75** | 58 |
| `react-hooks/purity` | 5 | 4 |
| `react-hooks/refs` | 3 | 3 |
| `react-hooks/preserve-manual-memoization` | 3 | 2 |
| `react-hooks/static-components` | 1 | 1 (`LatexRenderer.tsx`) |
| `react-hooks/immutability` | 1 | 1 (test-only: `src/contexts/__tests__/AuthContext.test.tsx`) |
| remaining 8 rules (`use-memo`, `incompatible-library`, `globals`, `set-state-in-render`, `error-boundaries`, `unsupported-syntax`, `config`, `gating`) | 0 | 0 |
| **Total** | **88** | — |

`set-state-in-effect` area buckets (sum = 75): `src/hooks/**` = 22 (19 files) · `src/components/**` = 27 (22 files) · `src/app/[locale]/**` = 24 (15 files, incl. auth-flow `login` / `signup` / `reset-password`) · `src/contexts/**` = 2 (`PlatformSettingsContext.tsx`, `ThemeContext.tsx`).

Warning budget: lint runs with `--max-warnings=52`; current count **51 on main** (43 on a clean 7.1.1 install — see Step 0). All 14 compiler rules are `error`-severity, so they bypass the budget; fixes must never *add* warnings.

### Step 0 — hard prerequisite: stale plugin shadow

`apps/web/node_modules/eslint-plugin-react-hooks/` is a stale **real directory at 5.2.0** shadowing the hoisted 7.1.1 (lockfile has only 7.1.1; the dir predates commit `5df1476`). Because ESLint skips existence validation for *disabled* rules, the 14 `"off"` pins are currently inert dead letters — but forcing any compiler rule against the shadow fails instantly: `Could not find "set-state-in-effect" in plugin "react-hooks"`.

E0 (first commit of this spec) must: clean-reinstall workspace deps, probe `require.resolve('eslint-plugin-react-hooks')` from `apps/web` resolves to 7.1.1, re-run the baseline measurement, and confirm the 88-hit table reproduces. No rule is enabled before E0 verifies clean.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Prerequisite hygiene (Priority: P1)

**Why this priority:** every later increment measures against the plugin actually in use; a stale shadow invalidates all counts.

**Independent Test:** from `apps/web`, `node -e "console.log(require('eslint-plugin-react-hooks/package.json').version)"` prints `7.1.1`.

**Acceptance Scenarios:**
1. **Given** a clean `pnpm install`, **When** the resolution probe runs, **Then** it reports 7.1.1 and no `apps/web/node_modules/eslint-plugin-react-hooks` directory exists.
2. **Given** the probe passes, **When** the measurement re-runs, **Then** counts match the baseline table above (±0) or the delta is explained in the increment commit.

### User Story 2 — Low-count rules (Priority: P1)

`immutability` (1, test-only), `static-components` (1), `refs` (3), `preserve-manual-memoization` (3) — eight violations total, each an isolated fix.

**Independent Test:** flipping each rule to `"error"` in its own commit leaves lint green after the targeted fix.

**Acceptance Scenarios:**
1. **Given** `immutability: "error"`, **When** `AuthContext.test.tsx` is fixed, **Then** lint passes and the auth-context suite is green.
2. **Given** `static-components: "error"`, **When** `LatexRenderer.tsx` is restructured (component definition hoisted out of render scope), **Then** lint passes and math-rendering visual output is unchanged (chat math smoke).
3. **Given** `refs` + `preserve-manual-memoization: "error"`, **When** `NavTooltip.tsx`, `NewsMediaUploads.tsx`, `useQuizPlayerRuntime.ts`, `useAiChat.ts` are fixed, **Then** lint passes and quiz-player + chat behavior suites are green.

### User Story 3 — `purity` (Priority: P2)

Five violations in `PuterSettingsModal.tsx` (×2), `profile/page.tsx`, `QuizPlayer.tsx`, `LectureExplanationSection.tsx` — typically render-time side effects (Date/random/localStorage reads during render).

**Independent Test:** `purity: "error"` + green lint + affected page smoke.

**Acceptance Scenarios:**
1. **Given** the rule on, **When** each render-time side effect is moved to event handlers/effects/lazy init, **Then** lint passes and the settings modal, profile page, and quiz player render identically (manual smoke + suites).

### User Story 4 — `set-state-in-effect`: contexts + hooks buckets (Priority: P2)

24 violations (contexts 2, hooks 22 across 19 files). Refactor patterns, in preference order (repo precedent: event-driven persistence in `useAiChat`, commit `11307f7`): derive-during-render; event-driven writes; lazy state init; keyed re-mount; effect with correct deps as last resort.

**Independent Test:** `set-state-in-effect: "error"` scoped to the two buckets via targeted `--rule` runs reports 0 before the global flip.

**Acceptance Scenarios:**
1. **Given** each hook fixed in its own commit, **When** `pnpm -r --if-present test` runs, **Then** all suites stay green per commit.
2. **Given** `ThemeContext.tsx` / `PlatformSettingsContext.tsx` fixed, **When** theme and platform settings are toggled, **Then** behavior is identical (manual dark/light + desktop-runtime smoke).

### User Story 5 — `set-state-in-effect`: components bucket (Priority: P2)

27 violations across 22 component files (incl. `NotificationProvider.tsx`, `OnboardingModal.tsx`, `FilterBottomSheet.tsx`, `AdminCommandPalette.tsx`, `MobileNav.tsx`).

**Independent Test:** bucket-scoped rule run reports 0; component suites + smoke green.

**Acceptance Scenarios:**
1. **Given** each component fixed, **When** its suite runs, **Then** green per commit with no new warnings.
2. **Given** notification/onboarding flows, **When** exercised manually, **Then** behavior identical to pre-refactor.

### User Story 6 — `set-state-in-effect`: app routes bucket (Priority: P1 — highest regression risk, strictest gate)

24 violations across 15 route files, **including the auth flow** (`login/page.tsx` ×2, `signup/page.tsx`, `reset-password`) — MVP-Lock category 3 territory. Executed last, behind the full e2e suite (`pnpm --filter web test:e2e`, incl. seeded-auth specs) per commit, plus manual login → session-refresh → logout smoke.

**Independent Test:** full e2e green after each auth-adjacent commit; final global rule flip leaves lint at 0 errors.

**Acceptance Scenarios:**
1. **Given** `login`/`signup`/`reset-password` refactored, **When** the e2e auth specs run, **Then** all pass.
2. **Given** all buckets complete, **When** the 14 pins are removed from `eslint.config.mjs` (config comment updated to document the now-default on-state), **Then** `pnpm --filter web lint` reports 0 errors and ≤51 warnings.

### Edge Cases

- A violation that turns out to be a **real latent bug** (state written in effect causing a visible loop/race): fix it, and record it in the increment's commit body — do not silently normalize behavior.
- A violation where the only compliant rewrite measurably changes behavior: STOP, document in the increment, and escalate to the owner instead of shipping a behavior change.
- Fixes that would add a warning (e.g. new `exhaustive-deps` hits): forbidden — resolve or restructure until warning count does not increase.

## Requirements *(mandatory)*

- **FR-1** — Purge the stale 5.2.0 plugin shadow and verify 7.1.1 resolution before any enablement (E0).
- **FR-2** — Enable rules one increment per commit, in count order: `immutability` → `static-components` → `refs` → `preserve-manual-memoization` → `purity` → `set-state-in-effect` (buckets: contexts → hooks → components → app routes), each commit independently revertible.
- **FR-3** — Zero new `eslint-disable` directives for any `react-hooks/*` rule (current count: 0 for compiler rules; the 2 existing `exhaustive-deps` suppressions are out of scope).
- **FR-4** — Warning budget: `pnpm --filter web lint` must pass at every commit; warning count must never exceed the pre-increment count.
- **FR-5** — Every increment runs the gate suite: `pnpm -r --if-present typecheck`, `pnpm --filter web lint`, `pnpm -r --if-present test`, `pnpm --filter web build`; app-routes increments additionally run `pnpm --filter web test:e2e`.
- **FR-6** — Behavior preservation: no intentional user-visible behavior change anywhere in this spec; fixes are structural only (see Edge Cases for the escalation path).
- **FR-7** — When the last rule flips, delete the pinned `"off"` block from `eslint.config.mjs` and replace the block comment with the final measurement summary.

### Key Entities

- `apps/web/eslint.config.mjs` — the 14-rule `"off"` block (lines 58–71) and its comment (lines 49–57).
- 58 violation-bearing files enumerated in the baseline run (58 files for `set-state-in-effect`; +9 files for the other five rules).
- `apps/web/package.json` lint script (`--max-warnings=52`) — unchanged by this spec.

## Success Criteria *(mandatory)*

- **SC-1** — All 14 compiler rules enabled at `"error"` (default preset) with `pnpm --filter web lint` reporting **0 errors**.
- **SC-2** — Warning count ≤ 51 (strictly no regression vs main's 51).
- **SC-3** — Every commit in the series passes the FR-5 gate suite; final state passes the full e2e suite.
- **SC-4** — Zero `eslint-disable` directives referencing `react-hooks` compiler rules exist in `apps/web/src`.
- **SC-5** — Baseline measurement re-run at the end reports 0 hits for all 14 rules.
- **SC-6** — Each commit is independently revertible (atomic increments; no cross-increment coupling).

## Assumptions

- **MVP Lock (I12):** this is cross-cutting refactor work — **execution requires an explicit owner lift** (same pattern as spec 015). Auth-flow files additionally fall under MVP-Lock category 3 (login + essential data); US6 carries the strictest gating to honor that even after a lift.
- Spec 015 overlap: verified none (its web-side touches — `src/lib/desktop/runtime.ts` type re-export, `ChatInput.tsx` import source — appear in no violation list; FR-010 of 015 forbids behavior change either way).
- The 0-count rules (`use-memo`, `incompatible-library`, `globals`, `set-state-in-render`, `error-boundaries`, `unsupported-syntax`, `config`, `gating`) need no code work — they flip with the final config cleanup (FR-7) at zero risk.
- Dependency batch PRs (#79+) are unrelated to this spec's file set; no rebase coupling expected.
