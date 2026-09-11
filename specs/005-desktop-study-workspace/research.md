# Research: Desktop Study Workspace & Native Shell

**Feature**: Desktop Study Workspace & Native Shell
**Date**: 2026-09-10 (retroactive — decisions were made during implementation sessions ending this date)
**Branch**: `005-desktop-study-workspace` (landed on `main`; commits `2152fbc`, `04053f1`, `9722e42`, `84ca992`)

Each decision below records what was chosen, why, and what was rejected. Sources: the feature
spec's clarification sessions, the implementation sessions, and the orchestration transcript
reconciled in `specs/007-desktop-shell-architecture/spec.md`.

---

## D1. Where the desktop UI lives

**Decision**: All React/UI code lives in `apps/web`, selected at runtime; `apps/desktop` owns only window flags, IPC, preload, and menus.

**Rationale**: The Electron `BrowserWindow` loads the Next.js app served out of `apps/web` — there is no second renderer bundle to put components in. A separate renderer would fork the product UI and break constitution IV (web is the source of truth).

**Alternatives considered**: A dedicated Electron renderer bundle (rejected: duplicate UI, type drift); a separate `(desktop)` route group with its own layout (rejected: duplicates route tree for no benefit — one `Layout.tsx` branch covers every route).

## D2. Runtime gating signal

**Decision**: Probe `window.masarxDesktop` (installed by `preload.ts` via `contextBridge`). No user-agent sniffing, no build-time flag.

**Rationale**: One build serves both browser and Electron (FR-011). The bridge is installable *only* by our shell, so it cannot false-positive like UA checks; it also degrades naturally — an older shell without the `window` namespace still truthy-identifies as desktop but yields a typed-optional control surface (FR-012 graceful degradation).

**Alternatives considered**: UA sniffing (rejected: spoofable, and the banner code already showed its fragility); `NEXT_PUBLIC_*` build flag (rejected: two builds → drift, violates the single-build constraint).

## D3. Hydration safety of the gate

**Decision**: `useIsDesktopRuntime()` returns `false` on the server and on first client paint, flipping in a post-mount effect; shell chrome (CustomTitlebar) renders only after the flip.

**Rationale**: SSR HTML and the first client render must match or React logs a hydration mismatch (FR-010). The one-frame browser-chrome flash inside Electron is suppressed by the marker-scoped `.z-header { display: none }` rule — kept deliberately (spec 007 §2), since it is a flash guard, not a layout hack.

**Alternatives considered**: Reading `window.masarxDesktop` during render (rejected: hydration mismatch, server crash risk); a blocking inline script that sets the attribute pre-paint (viable future optimization — spec 007 task E3, requires flash evidence before/after).

## D4. Shell separation: conditional rendering, not CSS overrides

**Decision**: `Layout.tsx` branches on `useIsDesktopRuntime()`: desktop shell = `CustomTitlebar` + `flex h-screen w-screen overflow-hidden` workspace with zero web chrome; browser shell = existing Header/Footer layout untouched. Global CSS may style *within* the `[data-masarx-desktop]` marker but must never mutate root-element layout.

**Rationale**: Earned by two incidents (spec 007 §4): a `body > * { height: 100% }` rule (specificity 0,1,2) stretched the fixed titlebar to 800px because App Router renders React directly into `<body>` (no `#__next`), and a CSS-morph of the web header collapsed into a nav rail that collided with the titlebar and black-screened the workspace. Structural separation eliminated the entire failure class.

**Alternatives considered**: CSS-only adaptation of the web layout (rejected — the incident cause); dedicated desktop route group (see D1).

## D5. Frameless window approach

**Decision**: `frame: false` + application-rendered `CustomTitlebar` + `window:*` IPC handlers (`minimize`, `toggleMaximize`, `close`, `isMaximized`, `maximizeChange` broadcast) exposed through the preload bridge.

**Rationale**: Full control over the strip's content (app identity, RTL layout, state-accurate maximize icon — FR-023 requires reacting to out-of-band maximize events, which needs the `maximize`/`unmaximize` broadcast regardless of approach). The T017 contract test pins the secure `webPreferences` so the change stays auditable.

**Alternatives considered**: `titleBarStyle: 'hidden'` + `titleBarOverlay` (rejected: overlay styling is OS-controlled, weak RTL support, and still shows system-drawn controls on Windows rather than app-styled ones).

## D6. Height-chain strategy in the shell

**Decision**: The flex height chain (`html → body → shell`) is completed by marker-scoped rules in `desktop-shell.css` (`height: 100%; overflow: hidden` on `html[data-masarx-desktop]` and its `body`), plus a hard clamp on the titlebar (`height/max-height: 32px !important; flex: 0 0 32px`) so no future body-level rule can stretch it. Every ancestor of the three columns carries `min-h-0`/`overflow-hidden`.

**Rationale**: In a desktop shell the root genuinely must not scroll (FR-017) — some root height discipline is unavoidable; scoping it under the marker keeps the browser byte-identical (FR-011), and the clamp makes the 800px incident class structurally impossible.

**Alternatives considered**: Tailwind-only `h-dvh` chains with no CSS file (attempted during the session; broke when providers interrupted the flex chain and left the titlebar unclamped); `100vh` units (rejected: mobile-browser URL-bar jump is irrelevant here but `dvh` is the safer modern unit).

## D7. Document reader

**Decision**: Embedded document frame for this feature; highlighting scoped to platform-owned text (summaries); no in-house PDF text layer.

**Rationale**: Spec clarification (2026-09-04) — a full in-house renderer is out of scope and deferred; the reader component (`DocumentReader.tsx`) carries no-selection / no-document / load-failure-with-retry states instead (FR-009).

**Alternatives considered**: In-house PDF text layer (explicitly deferred by the spec); screenshot-canvas annotation (rejected: not text-selectable, violates SC-006 spirit).

## D8. Verification method (agent-observable UI)

**Decision**: GATE-VISUAL per FR-027 — for rendered-output changes, verify via CDP DOM probes (`Runtime.evaluate` computed styles / bounding boxes), Win32 window enumeration, and pixel scans of real screenshots, on the target route (`/[locale]/subjects/[subject]`, never the home page). Typecheck alone is explicitly insufficient.

**Rationale**: Agents cannot "see" the UI; during the session this toolchain is what caught the 800px titlebar (DOM probe) and proved the T046 gate (single 32px titlebar at y=0..31, three columns 288/575/384 px starting y=32, no native chrome, no web navbar). Spec 007 task E1 tracks productizing this into a headless Playwright gate.

**Alternatives considered**: Storybook/visual-diff tooling (not present in repo; heavier than the problem); trusting typecheck (the incident that started this whole feature — FR-027 exists to forbid it).

## D9. Development feedback loop

**Decision**: Iterate against the Next.js dev server with HMR and the desktop marker forced; full `electron-builder --dir` packaging only for gate verification. Windows hygiene: kill `Masar X.exe` / `electron.exe` zombies before rebuilds.

**Rationale**: Repackaging costs 45–90s per iteration and locked binaries on Windows produced silent stale-pack failures that corrupted the agent's feedback loop (spec 007 §5, ADR-3). Spec 007 task E2 documents this loop for agents; spec 005 US4 (T030–T034) adds the port-clear/clean/SW-unregistration safeguards.

**Alternatives considered**: `electron-builder --dir` per change (the slow loop that caused zombie-process confusion); webpack HMR inside Electron dev only (unnecessary — the window loads a URL, so the dev server is already the fast path).

## Open questions carried forward

- Headless visual-regression gate to replace manual CDP/screenshot sessions (spec 007 E1).
- Cleaner hydration-flash guard than the `.z-header` CSS rule (spec 007 E3, evidence-gated).
- Phase 4 US4 safeguards and Phase 6 polish remain open in tasks.md.
