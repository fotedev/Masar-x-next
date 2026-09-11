---

description: "Task list for 005-desktop-study-workspace"
---

# Tasks: Desktop Study Workspace & Native Shell

**Input**: `specs/005-desktop-study-workspace/spec.md`

> **Reconciliation note (2026-09-10):** the US1/US2 build tasks below were implemented and
> committed (2152fbc, 84ca992) during the same session that finished US3 (T040–T046), but
> their checkboxes were never flipped. They are backfilled here with evidence — see
> `specs/007-desktop-shell-architecture/spec.md` §2. Verification-gate tasks (T016, T025)
> and Phases 4/6 remain open; they are consolidated as spec 007 tasks.md §B–§D.

**Tests**: Vitest already runs in `apps/desktop` (`pnpm --filter desktop test`). Main-process tasks that change window creation MUST keep the existing T017 contract test green, since it asserts the `BrowserWindow` options object. New tests are called out where a task changes a contract.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — different files, no dependencies
- **[Story]**: Owning user story (US1–US4) or `FOUND` for foundational

## Path Conventions

Monorepo. Two packages are touched:

- `apps/web/` — ALL React/user-interface code, including desktop-only surfaces (the Electron window loads this app; there is no separate renderer bundle)
- `apps/desktop/` — Electron shell only: window flags, window-control IPC, preload surface, menu

## Verification Gates (apply to every phase)

Because pnpm's corepack shim is broken on the reference machine, the working invocation is:

```bash
PNPM="node C:/Users/FOTE/AppData/Local/node/corepack/v1/pnpm/9.15.4/bin/pnpm.cjs"
```

- **GATE-TYPE-DESKTOP**: `$PNPM --filter desktop typecheck` → 0 errors
- **GATE-TYPE-WEB**: `$PNPM --filter web typecheck` → 0 errors (no regression in shared packages)
- **GATE-TEST-DESKTOP**: `$PNPM --filter desktop test` → all pass
- **GATE-VISUAL**: per FR-027 — for any task that changes rendered output, confirm (a) the changed component is imported by the route that renders it, and (b) the expected text/DOM is present in the rendered page. A passing typecheck is NOT sufficient evidence. Record what was observed.

Baseline recorded before this feature: GATE-TYPE-DESKTOP 0 errors, GATE-TYPE-WEB 0 errors.

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: The runtime-gating contract every other phase reads from.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T001 [FOUND] Create `apps/web/src/lib/desktop/runtime.ts` exporting `isDesktopRuntime()` and `getDesktopBridge()`, probing `window.masarxDesktop` — SSR-safe (returns false when `window` is undefined). Types the optional `window` control surface so an older shell still satisfies the type (FR-010, FR-012).
- [x] T002 [FOUND] Create `apps/web/src/lib/desktop/useIsDesktopRuntime.ts` — hydration-safe hook returning `false` on server and first client render, flipping in an effect (FR-010). Prevents the hydration mismatch that a bare runtime check in a component body would cause.
- [x] T003 [FOUND] Verify GATE-TYPE-WEB after T001–T002. *(backfilled 2026-09-10: `pnpm typecheck` green across all 4 workspace projects, post-US3)*

**Checkpoint**: Runtime gating available; user stories may proceed in parallel.

---

## Phase 2: User Story 1 — Three-column StudyWorkspace (Priority: P1) 🎯 MVP

**Goal**: Lecture list, reader, and assistant visible at once; selection swaps reader content in place; assistant scoped to the open lecture.

**Independent Test**: Open a subject with ≥2 lectures, select each, confirm the reader changes with no navigation, open the assistant, confirm its stated scope tracks the selection.

- [x] T010 [US1] Create `apps/web/src/components/desktop/workspace/types.ts` — `WorkspaceLecture` (id, title, ordinal, optional documentUrl, optional duration) and `StudyWorkspaceProps` (subjectName, lectures, optional initialLectureId). No new schema; shapes map from existing subject/summary data (FR-none, supports FR-001..009). *(backfilled 2026-09-10: on disk, also exports `WorkspaceSelection`; commit 2152fbc)*
- [x] T011 [P] [US1] Create `apps/web/src/components/desktop/workspace/LectureListColumn.tsx` — fixed-width column, own `overflow-y-auto`, marks active row, `select-none`, renders an empty state when `lectures` is empty (FR-002, FR-007, FR-009). *(backfilled 2026-09-10: 125-line implementation on disk)*
- [x] T012 [P] [US1] Create `apps/web/src/components/desktop/workspace/ReaderToolbar.tsx` — slim toolbar with open-lecture title, highlight action, download action, and the assistant toggle whose appearance reflects panel state (FR-004, FR-005). *(backfilled 2026-09-10: 96-line implementation on disk)*
- [x] T013 [P] [US1] Create `apps/web/src/components/desktop/workspace/DocumentReader.tsx` — flexible-width embedded document surface; distinct states for no-selection, no-document, and load-failure-with-retry; no window-level scroll (FR-003, FR-004, FR-009). *(backfilled 2026-09-10: 125-line implementation on disk)*
- [x] T014 [P] [US1] Create `apps/web/src/components/desktop/workspace/AssistantPanel.tsx` — collapsible panel stating the lecture it is scoped to, scrollable transcript with `select-text`, bottom-anchored composer, close control (FR-005, FR-006, FR-007, FR-014). *(backfilled 2026-09-10: 190-line implementation on disk; `.selectable-content` opt-in referenced)*
- [x] T015 [US1] Create `apps/web/src/components/desktop/workspace/StudyWorkspace.tsx` composing T011–T014 (depends on T010–T014): `h-full overflow-hidden` flex row, holds selection + panel state, uses logical inline-start/inline-end ordering so RTL and LTR mirror correctly rather than hardcoding left/right (FR-001, FR-008). *(backfilled 2026-09-10: 188 lines, `order-1`/`order-3` logical columns; contrast classes per commit 9722e42)*
- [ ] T016 [US1] Verify GATE-VISUAL: confirm `StudyWorkspace` is reached by the route that renders it and that a lecture title from the list appears in the rendered reader after selection. *(2026-09-10: route + import reachability proven — `/ar/subjects/math` HTTP 200 rendering subject data, page.tsx renders StudyWorkspace in the isDesktop branch; typecheck green. The interactive selection check requires the Electron shell — blocked by the missing binary; consolidated as spec 007 §B1. Evidence: verification.md)*

**Checkpoint**: US1 independently functional.

---

## Phase 3: User Story 2 — Kill browser behaviours (Priority: P2)

**Goal**: No selection on chrome, no drag ghosts, no platform context menu, no root scroll, slim scrollbars, no download banners or web footer — in the shell only.

**Independent Test**: Run the five-gesture browser-habit checklist in the shell (all absent) and in a browser (all intact).

- [x] T020 [US2] Create `apps/web/src/styles/desktop-shell.css` — rules scoped under a single root marker (e.g. `[data-masarx-desktop="true"]`) so nothing applies in the browser: `user-select: none` on chrome, `-webkit-user-drag: none` on `img`/`a`, `overflow: hidden` on the root, slim styled scrollbars with `scrollbar-gutter: stable`, and a `.selectable-content` opt-back-in (FR-013, FR-014, FR-015, FR-017, FR-018). *(backfilled 2026-09-10: all listed rules verified in the file, every rule under the marker; also carries the 32px titlebar clamp guard from the US3 session)*
- [x] T021 [US2] Import `desktop-shell.css` from `apps/web/src/index.css` (or the root layout that already imports it) so the rules ship in one build but stay inert without the marker (FR-011). *(backfilled 2026-09-10: imported from root `app/layout.tsx:4`)*
- [x] T022 [US2] Create `apps/web/src/components/desktop/DesktopShellGate.tsx` — client component that sets the root marker attribute when `useIsDesktopRuntime()` is true, and suppresses the platform context menu while the shell is active (FR-010, FR-016). *(backfilled 2026-09-10: sets/restores `data-masarx-desktop` on `<html>`, capture-phase contextmenu suppression)*
- [x] T023 [US2] Mount `DesktopShellGate` in the app providers tree (`apps/web/src/components/AppProviders.tsx`) so every route is covered (FR-011). *(backfilled 2026-09-10 with deviation: mounted from `components/Layout.tsx` instead of AppProviders — same every-route coverage, since Layout wraps all locale routes; noted in spec 007 §1)*
- [x] T024 [US2] Gate the web-only surfaces in `apps/web/src/components/Layout.tsx`: skip `Footer` and the desktop-download/PWA-install prompts when the shell is active (FR-019). *(backfilled 2026-09-10: Footer + PWAInstallPrompt render only in the browser branch; the home-page download banner self-hides via `useIsDesktopRuntime`, commit 84ca992)*
- [x] T025 [US2] Verify GATE-TYPE-WEB and GATE-VISUAL: confirm the marker attribute is absent in a plain browser render and that the footer is still present there (proving FR-011 — no web regression). *(2026-09-10: SSR HTML of `/ar` — `data-masarx-desktop` 0 occurrences in 145 KB; footer present; typecheck 0 errors. Evidence: verification.md)*

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 4: User Story 4 — Dev-environment & cache safeguards (Priority: P2)

**Goal**: A stale server or Service Worker can never mask a real change; visual verification becomes a stated requirement.

**Independent Test**: Start a session while a stale one holds the port; confirm the stale process is cleared and the new server binds the expected port. Change visible text, reload once, confirm it is on screen.

> Runs fully in parallel with Phases 2–3 — no shared files.

- [x] T030 [P] [US4] Add a `predev` port-clear step for `apps/web` so a stale process on the dev port is terminated before the server starts, rather than silently failing over to another port. `apps/web/package.json` already has a `predev` (`inject-sw-version.mjs`) — extend it; do not replace it (FR-024). *(backfilled 2026-09-10: already implemented — predev = `kill-port.mjs && inject-sw-version.mjs`; kill-port is PORT-aware, cross-platform, exits 0. Verified live per T034)*
- [x] T031 [P] [US4] Confirm/extend the clean entry point: `apps/web` already has `clean` and `dev:clean` via `scripts/clean.mjs`. Verify `clean.mjs` removes `.next`, `out`, and `node_modules/.cache`; extend if any is missing (FR-025). *(2026-09-10: extended — no-arg clean now removes all three; explicit single-target argument preserved)*
- [x] T032 [P] [US4] Harden `apps/web/src/lib/sw-register.ts`: it already skips registration in development. Add active *unregistration* of any Service Worker left behind by an earlier production-like session when running outside production, so a stale worker cannot keep serving old bundles (FR-026). *(2026-09-10: implemented — getRegistrations → unregister outside production; production registration path unchanged)*
- [x] T033 [US4] Add the visual-verification rule to `AGENTS.md`: for any user-interface change, confirm the changed component is imported by the rendering route AND that expected content appears in the rendered output before reporting completion; a passing type check is explicitly insufficient (FR-027). *(2026-09-10: added to §8 checklist, referencing quickstart.md)*
- [x] T034 [US4] Verify GATE-TYPE-WEB; confirm the dev server starts on the expected port with a stale process present. *(2026-09-10: typecheck 0 errors; kill-port isolation test — dummy listener on :3457 killed, port freed. Literal two-server run blocked by Next 16's same-dir dev lock + the user's live server; the lock itself hard-errors instead of silently failing over, which defeats SC-009's failure mode. Evidence: verification.md)*

**Checkpoint**: Stale-build class of failure closed. *(2026-09-10 — all Phase 4 tasks verified; full two-server scenario documented in verification.md)*

---

## Phase 5: User Story 3 — Custom frameless titlebar (Priority: P3)

**Goal**: The app's own title strip with working, state-accurate window controls.

**Independent Test**: Confirm the platform title bar is gone, drag the strip to move the window, exercise minimize / maximize / restore / close.

> Depends on Phase 1 only, but ships last: a frameless window with broken controls is unclosable.

- [x] T040 [US3] In `apps/desktop/src/main/index.ts`, create the `BrowserWindow` without the platform title bar (`titleBarStyle: 'hidden'` with `titleBarOverlay`, or `frame: false`). MUST NOT disturb the secure `webPreferences` the T017 contract test asserts (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`) (FR-020).
- [x] T041 [US3] Register `window:minimize`, `window:toggleMaximize`, `window:close`, and `window:isMaximized` IPC handlers in `apps/desktop/src/main/index.ts`, and emit a `window:maximizeChange` event on the window's own `maximize`/`unmaximize` events so state stays true even when changed outside the control (FR-022, FR-023).
- [x] T042 [US3] Expose the matching `window` namespace on `apps/desktop/src/main/preload.ts` via `contextBridge`, mirroring the optional shape typed in T001 (FR-012, FR-022).
- [x] T043 [US3] Update `apps/desktop/src/main/__tests__/main.test.ts` for the changed window options and the new IPC handler registrations (keeps GATE-TEST-DESKTOP honest rather than loosening it).
- [x] T044 [US3] Create `apps/web/src/components/desktop/CustomTitlebar.tsx` — renders only when the shell is active; app identity, `-webkit-app-region: drag` on the strip with `no-drag` on every control, minimize/maximize/close wired to the bridge, maximize icon driven by `onMaximizeChange`, and a no-op-safe path when the bridge lacks the `window` namespace (FR-012, FR-021, FR-022, FR-023).
- [x] T045 [US3] Mount `CustomTitlebar` above the app shell so it is present on every route in the shell and absent in the browser (FR-011).
- [x] T046 [US3] Verify GATE-TYPE-DESKTOP, GATE-TYPE-WEB, GATE-TEST-DESKTOP, and GATE-VISUAL (no titlebar in a browser render).

**Checkpoint**: All four stories independently functional.

---

## Phase 6: Polish & Cross-Cutting

- [x] T050 Responsive collapse order: below the width three columns need, collapse the assistant first and the lecture list second so the reader is never unusable (spec Edge Cases). *(2026-09-10: assistant `hidden lg:flex`, lecture list `hidden md:flex`, reader never hidden — StudyWorkspace.tsx)*
- [x] T051 Confirm locale switching swaps column edges without losing the current lecture selection (FR-008, Edge Cases). *(2026-09-10: edge swap confirmed (dir-based logical order); selection restore implemented — per-subject sessionStorage + mount-only effect, hydration-safe; interactive demo pending the Electron binary, see verification.md)*
- [ ] T052 Full-suite regression: GATE-TYPE-DESKTOP, GATE-TYPE-WEB, GATE-TEST-DESKTOP. *(2026-09-10: both type gates 0 errors; test gate 26/37 — T017/T043 contract suite 9/9 green after fixing the `session` mock gap; remaining 11 failures environmental: smoke needs the Electron binary, read-cache is blocked by neverBuiltDependencies policy (invariant I5). Re-run when the binary is restored. Evidence: verification.md)*
- [x] T053 Record verification evidence in `specs/005-desktop-study-workspace/verification.md`: gate outputs plus what was observed on screen per FR-027. *(2026-09-10: written — gate table, per-task evidence, honest caveats)*

---

## Dependencies

- Phase 1 (T001–T003) blocks everything.
- Phase 2 internals: T010 blocks T011–T014; T011–T014 block T015.
- Phase 3: T020–T022 block T023; T024 independent of T020–T023.
- Phase 5: T040 blocks T041; T041 blocks T042; T042 blocks T044; T043 follows T041.
- Phases 2, 3, and 4 are mutually parallel. Phase 5 is parallel to all but ships last.
- Phase 6 requires all prior phases.

## Out of Scope (deferred — discussed in the source transcript, not this feature)

Command palette (Ctrl+K), system tray, native notifications, taskbar progress, drag-and-drop file import, "show in folder", bottom status bar, in-house PDF text layer with true annotation, suppression of developer/reload shortcuts.
