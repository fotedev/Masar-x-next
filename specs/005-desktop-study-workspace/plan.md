# Implementation Plan: Desktop Study Workspace & Native Shell

**Branch**: `005-desktop-study-workspace` (work landed on `main`) | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-desktop-study-workspace/spec.md`

> **As-built plan.** The feature was implemented across sessions ending 2026-09-10 (commits
> `2152fbc`, `04053f1`, `9722e42`, `84ca992`) before this plan file was generated — `/speckit.plan`
> is being run retroactively to consolidate design artifacts (research, data model, contracts,
> quickstart) and to anchor the remaining verification work. Remaining open tasks live in
> [tasks.md](./tasks.md) (T016, T025, Phase 4, Phase 6) and are consolidated in
> `specs/007-desktop-shell-architecture/tasks.md` §B–§E.

## Summary

Rebuild the desktop app from "the website with F11 pressed" into a real desktop application:
a three-column Study Workspace (lecture list / document reader / lecture-scoped assistant) that
replaces page navigation with in-place selection, a native-feel shell that kills browser
behaviours (selection on chrome, drag ghosts, context menu, root scrolling, web footer/promo
surfaces), a frameless window with the app's own titlebar and working window-control IPC, and
development-environment safeguards so a UI change is only ever reported done when it is on
screen. Technical approach: all UI lives in `apps/web` and is selected at runtime by probing the
Electron preload bridge (`window.masarxDesktop`); the root layout branches between a desktop
shell and the browser shell (Dual-Shell Conditional Rendering); `apps/desktop` stays a thin OS
wrapper (window flags, IPC, preload).

## Technical Context

**Language/Version**: TypeScript (strict) on Node >= 24; Next.js 16 App Router + React 19 (renderer); Electron 32.2.0 (pinned exact per constitution V) for the shell.

**Primary Dependencies**: next-intl (i18n, 42 namespaces), Tailwind CSS (brand tokens via CSS variables), framer-motion, lucide-react; electron + electron-builder ^25 + electron-updater (shell); Vitest for `apps/desktop` main-process tests; `pg`/drizzle unrelated to this feature (no data layer changes).

**Storage**: N/A — no new schema, tables, or migrations. Workspace data maps from the existing `subjects` / summaries queries. Workspace selection state is session-scoped React state (not persisted).

**Testing**: Vitest in `apps/desktop` (`src/main/__tests__/main.test.ts` — window-options contract T017 + T043 IPC tests; 9 tests). Web side has no unit suite; correctness gates are `tsc --noEmit` (both apps) plus **GATE-VISUAL** (FR-027): DOM probes / screenshots of the rendered page — a passing typecheck is explicitly NOT evidence.

**Target Platform**: Windows is the reference verification platform (NSIS/portable builds); nothing in the design is Windows-specific. One codebase serves browser + Electron; the browser experience must remain byte-for-byte unchanged (FR-011, SC-010).

**Project Type**: pnpm monorepo feature spanning two packages: `apps/web` (all React/UI, runtime-gated) + `apps/desktop` (Electron main/preload/tests). Monorepo splitting is rejected (spec 007 ADR-2).

**Performance Goals**: Lecture switch renders new content within 1s on minimum-spec hardware (SC-003); no layout shift from scrollbar appearance (FR-018, `scrollbar-gutter: stable`).

**Constraints**: (1) Hydration-safe runtime gating — first SSR/first-paint HTML must match the browser build (FR-010); (2) zero document scrolling in the shell — the flex height chain `html → body → shell → columns` must be unbroken with `min-h-0`/`overflow-hidden` discipline; (3) no global CSS layout mutations on root elements (spec 007 ADR-1 — caused the 800px titlebar and black-screen incidents); (4) Windows file locks — kill `Masar X.exe`/`electron.exe` zombies before rebuilds; (5) degradation path when an older shell lacks the `window` IPC namespace (FR-012).

**Scale/Scope**: 2 packages, ~1,600 lines of desktop UI components (7 files) + shell CSS (158 lines) + main-process IPC/preload; 4 user stories, 27 functional requirements.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — no violations introduced; table below verified 2026-09-10 against the implemented code.*

| Principle | Status | Evidence |
|---|---|---|
| I. Server-Only Secrets | ✅ | No secrets in this feature; preload `contextBridge` exposes only window-control functions; no keys touched. Desktop `webPreferences` contract (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`) preserved (T017 test). |
| II. End-to-End Type Safety | ✅ | `workspace/types.ts` shapes map from existing subject/summary data; no parallel DB types; no schema changes. |
| III. Bilingual by Design | ✅ | Grep of `components/desktop/**`: zero hardcoded Arabic; all 7 UI files use `useTranslations`; columns use logical CSS (`order-*`, `border-e`/`border-s`) so RTL/LTR mirror (FR-008). |
| IV. Platform Boundaries | ✅ | Web remains source of truth; Electron owns only flags/IPC/preload/menu; OAuth callback paths untouched. |
| V. Pinned, Reproducible Toolchain | ✅ | Electron 32.2.0 exact-pinned; no new dependencies added (no lockfile change); no migrations. |
| VI. Theme & Correctness Details | ✅ | `ThemeScript.tsx` and CSP nonce handling untouched. |
| VII. Safe Version Control | ✅ | No destructive git ops used; retroactive ledger backfills done by editing files, not rewriting history. |

## Project Structure

### Documentation (this feature)

```text
specs/005-desktop-study-workspace/
├── plan.md              # This file (retroactive /speckit.plan output)
├── research.md          # Phase 0: as-built decisions with rationale (2026-09-10)
├── data-model.md        # Phase 1: workspace entities & state transitions
├── quickstart.md        # Phase 1: run, verify, and gate instructions
├── contracts/           # Phase 1: Electron bridge IPC + shell CSS contracts
│   ├── desktop-bridge.md
│   └── shell-css.md
├── spec.md / tasks.md / checklists/ / handoff.md
└── verification.md      # (pending — GATE evidence file, task T053)
```

### Source Code (repository root)

```text
apps/web/                                   # ALL React/UI code (runtime-gated)
├── src/
│   ├── components/
│   │   ├── Layout.tsx                      # Dual-shell branch: isDesktop ? shell : browser chrome
│   │   ├── desktop/
│   │   │   ├── DesktopShell.tsx            # Shell composition: CustomTitlebar + DesktopSidebar + content
│   │   │   ├── DesktopShellGate.tsx        # Sets [data-masarx-desktop] on <html>; context-menu suppression
│   │   │   ├── DesktopSidebar.tsx          # RTL-aware lateral navigation (shell-only)
│   │   │   ├── CustomTitlebar.tsx          # 32px strip: drag region + minimize/maximize/close via bridge
│   │   │   └── workspace/
│   │   │       ├── types.ts                # WorkspaceLecture / WorkspaceSelection / StudyWorkspaceProps
│   │   │       ├── StudyWorkspace.tsx      # 3-column composition, selection + panel state
│   │   │       ├── LectureListColumn.tsx   # Fixed-width, own scroll, active row, empty state
│   │   │       ├── ReaderToolbar.tsx       # Title, highlight, download, assistant toggle
│   │   │       ├── DocumentReader.tsx      # Embedded document surface + retry states
│   │   │       └── AssistantPanel.tsx      # Lecture-scoped collapsible panel
│   ├── lib/desktop/
│   │   ├── runtime.ts                      # isDesktopRuntime() / getDesktopBridge() — SSR-safe probe
│   │   └── useIsDesktopRuntime.ts          # Hydration-safe hook (false until mounted effect)
│   ├── hooks/useUserAcademic.ts            # (untouched by feature; consumer)
│   ├── app/[locale]/subjects/[subject]/    # Route mounting the workspace
│   └── styles/desktop-shell.css            # ALL shell CSS under [data-masarx-desktop="true"]
└── scripts/clean.mjs                       # US4 clean entry point (Phase 4 — pending)

apps/desktop/                               # Electron shell only
├── src/main/
│   ├── index.ts                            # Frameless BrowserWindow + window:* IPC handlers
│   ├── preload.ts                          # contextBridge: window.masarxDesktop.{...}.window namespace
│   └── __tests__/main.test.ts              # T017 window-options contract + T043 IPC tests
└── src/renderer/ipc-supabase-storage.ts    # (pre-existing, unrelated)
```

**Structure Decision**: Monorepo stays intact (spec 007 ADR-2). All desktop UI lives in
`apps/web` behind the runtime gate because the Electron window loads the Next.js app served
from `apps/web` — there is no second renderer bundle. `apps/desktop` owns only genuine shell
concerns. The desktop/browser split is a *layout-level* conditional in `Layout.tsx`, never a
CSS override of shared chrome (spec 007 ADR-1).

## Complexity Tracking

> No constitution violations to justify — table intentionally empty.
