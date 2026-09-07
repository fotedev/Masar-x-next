# Feature Specification: Desktop Study Workspace & Native Shell

**Feature Branch**: `005-desktop-study-workspace`

**Created**: 2026-09-04

**Status**: Draft

**Input**: User description: "Transcript-derived. Three concerns raised in `temp-chat.txt`: (1) UI edits appeared to have no effect because a stale Next.js dev server + registered Service Worker kept serving old bundles, and the coding agent declared success on `typecheck` alone without ever looking at the rendered screen; (2) the desktop app 'feels like the website with F11 pressed' — it must feel like a real desktop application the way Discord / Slack / VS Code do; (3) the study screen should be rebuilt as a three-column workspace: a fixed lecture/summary list, a central document reader with its own study toolbar, and a collapsible side-by-side chat with the AI assistant 'Zane' bound to the lecture currently open."

## Clarifications

### Session 2026-09-04

- Q: Where does the desktop UI code live, given `apps/desktop` has no React renderer? → A: In `apps/web`, gated at runtime. The Electron `BrowserWindow` loads the Next.js app served out of `apps/web` (`apps/desktop/src/main/server.ts`), so there is no second renderer bundle to put components in. Desktop-only surfaces are therefore selected at runtime by probing `window.masarxDesktop` (installed by `preload.ts`), and `apps/desktop` owns only what genuinely belongs to the shell: window flags, native window-control IPC, and menus.
- Q: Is the PDF reader an in-house renderer or an embedded frame? → A: An embedded frame for this feature. Highlighting is scoped to text-layer content the platform already owns (summaries), not to arbitrary pixels inside a third-party PDF binary. A full in-house PDF text layer is explicitly out of scope and deferred.
- Q: Does the assistant column sit on the left or the right? → A: Layout is direction-relative, not side-absolute. In Arabic (RTL) the lecture list sits at the inline start (visually right) and the assistant at the inline end (visually left); in English (LTR) the mirror image. The transcript's "right/left" wording describes the Arabic case only, and hardcoding physical sides would break the English locale.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Study a lecture and ask the assistant about it, side by side (Priority: P1)

A student opens a subject in the desktop app. The lectures and summaries for that subject appear in a fixed list along one edge of the window. Selecting a lecture renders it immediately in the centre of the same window — no page navigation, no back button, no browser tab. The student opens the assistant panel and asks a question about the material currently on screen; the assistant already knows which lecture is open, so the student never has to describe or re-upload it. The student switches to the next lecture and the assistant follows the change.

**Why this priority**: This is the entire reason a student would choose the desktop app over the website. It removes the tab-switching that the transcript identifies as the core friction ("تحل أزمة التنقل بين التبويبات"), and it is the one story that delivers standalone value even if nothing else in this feature ships.

**Independent Test**: Launch the desktop app, open a subject with at least two lectures, select each in turn, confirm the reader content changes without a navigation event, open the assistant panel, and confirm the panel states which lecture it is scoped to and that this text tracks the selection.

**Acceptance Scenarios**:

1. **Given** a subject with lectures is open, **When** the workspace loads, **Then** the lecture list, a reader area, and an assistant toggle are all visible simultaneously in one window without scrolling the window itself
2. **Given** the workspace is open, **When** the student selects a different lecture from the list, **Then** the reader replaces its content in place, the selected row is visually marked as active, and no page navigation or full reload occurs
3. **Given** a lecture is open and the assistant panel is closed, **When** the student activates the assistant toggle, **Then** the assistant panel opens alongside the reader — the reader stays visible and narrows rather than being covered or replaced
4. **Given** the assistant panel is open, **When** the student selects a different lecture, **Then** the assistant's stated context updates to the newly selected lecture
5. **Given** the assistant panel is open, **When** the student closes it, **Then** the reader expands to reclaim the freed width and the toggle returns to its inactive state
6. **Given** no lecture has been selected yet, **When** the workspace loads with an empty selection, **Then** the reader shows an explicit invitation to pick a lecture rather than an empty frame or an error
7. **Given** the interface is displayed in Arabic, **When** the workspace renders, **Then** the lecture list occupies the inline-start edge and the assistant the inline-end edge; **And** in English the arrangement is mirrored

---

### User Story 2 - The application stops behaving like a web page (Priority: P2)

A student who uses Discord and VS Code launches the desktop app. Nothing about it reads as "a website in a window": text does not turn blue when they double-click a button label, dragging an image does not peel a translucent ghost off the screen, right-clicking does not offer "Reload" or "Inspect", the window itself never scrolls as one long page, and promotional "Download the desktop app" surfaces and the long web footer are simply not there — they are already in the app.

**Why this priority**: This is the complaint that opened the conversation ("بحس اني فاتح الموقع بس دايس f11"). It is a perception problem, so it is broad and shallow: many small removals rather than one feature. It ranks below Story 1 because a workspace that works still delivers value with browser habits intact, whereas polished chrome around the old single-column page does not.

**Independent Test**: In the desktop app, attempt each browser-flavoured gesture (drag-select a label, drag an image, right-click, scroll past the viewport, look for a download banner and the footer) and confirm each is absent — while confirming the same gestures still work normally in the browser build.

**Acceptance Scenarios**:

1. **Given** the desktop app is running, **When** the student drags across interface chrome such as menu labels or buttons, **Then** no text selection highlight appears
2. **Given** the student is reading lecture or summary prose, **When** they drag across that prose, **Then** selection DOES work and the text can be copied — the previous restriction must not extend to study content
3. **Given** the desktop app is running, **When** the student drags an image or a link, **Then** no drag ghost is produced and no navigation is initiated
4. **Given** the desktop app is running, **When** the student right-clicks anywhere, **Then** the browser's own context menu (Back / Reload / Inspect) does not appear
5. **Given** any workspace screen, **When** content exceeds the window height, **Then** the window does not scroll as a whole; only the specific inner pane containing the overflow scrolls, and the shell chrome stays fixed
6. **Given** the desktop app is running, **When** any screen is displayed, **Then** desktop-download promotional surfaces and the long web footer are absent
7. **Given** the same pages are opened in a normal browser, **When** the student uses ordinary browser behaviours, **Then** all of them still work — none of the above suppressions leak into the web experience

---

### User Story 3 - The window is the application's own, not the operating system's default (Priority: P3)

The app presents its own slim title strip carrying the Masar X identity and its own minimize / maximize / close controls, styled with the app. Dragging that strip moves the window; the controls behave exactly as the platform's do, including toggling back out of the maximized state.

**Why this priority**: The most visible single signal of a native app, but purely presentational — and the riskiest to get wrong, since a frameless window with broken controls leaves a user unable to close the app. It ships last, behind working content.

**Independent Test**: Launch the app, confirm the operating system's default title bar is gone and the custom strip is present, drag the strip to move the window, then exercise minimize, maximize, restore, and close.

**Acceptance Scenarios**:

1. **Given** the app launches, **When** the window appears, **Then** the operating system's default title bar is not shown and the application's own title strip is
2. **Given** the custom title strip is visible, **When** the student drags an empty part of it, **Then** the window moves with the pointer
3. **Given** the custom title strip is visible, **When** the student clicks minimize, maximize, or close, **Then** the window performs exactly that action, and the drag behaviour never swallows these clicks
4. **Given** the window is maximized, **When** the student activates the maximize control again, **Then** the window returns to its previous size and the control reflects the changed state
5. **Given** the app is opened in a browser instead, **When** the page renders, **Then** no custom title strip appears

---

### User Story 4 - A UI change is never reported as done unless it is on screen (Priority: P2)

A maintainer or coding agent changes a component. Starting the development environment cannot serve a stale build: any process squatting on the port is cleared first, cached build output is discarded on demand, and no Service Worker is registered outside production, so the change is on screen on the first reload. Before the work is called complete, the rendered page itself is inspected — a passing type check alone is not accepted as evidence.

**Why this priority**: This is the root cause of the incident that started the conversation: correct code was written, reported as done, and the screen never changed. Without it, the other stories can be "delivered" and still appear broken. It sits alongside Story 2 because it protects delivery rather than being something a student sees.

**Independent Test**: With a development server already running, start a second one, confirm the old process is cleared rather than the new one silently failing over to another port. Then modify visible text, reload once, and confirm the new text is on screen with no Service Worker registered.

**Acceptance Scenarios**:

1. **Given** a stale development server is holding the standard port, **When** a new development session is started, **Then** the stale process is terminated first and the new server binds the expected port
2. **Given** cached build output exists, **When** the maintainer starts a clean development session, **Then** the cached output and any stale dependency cache are removed before the server starts
3. **Given** the app is running outside production, **When** the page loads, **Then** no Service Worker is registered and none remains registered from an earlier production-like session
4. **Given** a change to a visible component, **When** the page is reloaded once, **Then** the change is visible without clearing browser storage by hand
5. **Given** a UI task is claimed complete, **When** the completion evidence is reviewed, **Then** it includes confirmation that the component is actually reached by the page that renders it and that the expected content was observed in the rendered output — not merely that a type check passed

---

### Edge Cases

- A subject has no lectures at all: the list shows an empty state, the reader shows its invitation copy, and neither renders a broken frame.
- A lecture has no attached document: the reader states that plainly instead of embedding an empty viewer.
- A lecture document fails to load or is unreachable: the reader surfaces a retry affordance and the rest of the workspace stays usable.
- The window is narrowed below the width that three columns need: the assistant collapses first, the lecture list second, so the reader is never squeezed to unusability.
- The lecture list is long enough to overflow: it scrolls within its own column while the reader and assistant stay put.
- A long assistant conversation overflows: it scrolls within the assistant column only, and the composer stays anchored at the bottom.
- The preload bridge is missing or older than this feature (an outdated shell against a newer web build): the app renders the web layout and remains fully usable rather than crashing on absent window controls.
- The student switches locale while the workspace is open: the columns swap edges without losing the current lecture selection.
- The window is maximized or restored by the operating system rather than by the custom control (a keyboard shortcut, a double-click on the strip): the control's appearance still reflects the true window state.

## Requirements *(mandatory)*

### Functional Requirements

**Workspace layout**

- **FR-001**: The workspace MUST present the lecture/summary list, the document reader, and the assistant panel simultaneously within a single window, with no window-level scrolling.
- **FR-002**: The lecture list MUST occupy a fixed width, scroll independently of every other region, and visually mark the active lecture.
- **FR-003**: Selecting a lecture MUST replace the reader's content in place, without a page navigation or a full document reload.
- **FR-004**: The reader MUST occupy the remaining flexible width and MUST carry a toolbar exposing, at minimum, the title of the open lecture, a highlight action, a download action, and the assistant toggle.
- **FR-005**: The assistant panel MUST be collapsible and expandable by the student, MUST reveal and hide alongside the reader rather than over it, and its state MUST be observable from the toggle's appearance.
- **FR-006**: The assistant panel MUST identify the lecture it is currently scoped to, and that scope MUST update when the selection changes.
- **FR-007**: Each of the three regions MUST confine its own overflow to itself; content in one region MUST never scroll or resize another.
- **FR-008**: The columns' arrangement MUST follow the interface's reading direction, placing the lecture list at the inline start and the assistant at the inline end in both directions.
- **FR-009**: Every region MUST render a purposeful empty or error state — absent lectures, absent document, failed document load — without collapsing the layout.

**Runtime gating**

- **FR-010**: The application MUST determine at runtime whether it is executing inside the desktop shell, and MUST make that determination in a way that does not alter the first rendered output relative to the browser build.
- **FR-011**: When the desktop shell is absent, every behaviour in FR-012 through FR-023 MUST NOT apply, and the browser experience MUST be unchanged.
- **FR-012**: When the shell is present but predates this feature and does not expose window controls, the application MUST degrade to a usable state rather than failing.

**Native feel**

- **FR-013**: In the desktop shell, arbitrary text selection MUST be suppressed across interface chrome.
- **FR-014**: In the desktop shell, text selection MUST remain available within study content — lecture prose, summaries, and assistant replies — and that content MUST remain copyable.
- **FR-015**: In the desktop shell, dragging images and links MUST produce neither a drag ghost nor a navigation.
- **FR-016**: In the desktop shell, the platform's default context menu MUST NOT be presented.
- **FR-017**: In the desktop shell, the root of the application MUST NOT scroll; only designated inner panes MUST scroll.
- **FR-018**: In the desktop shell, scrollbars MUST be presented in a slim, application-styled form rather than the platform default, and MUST NOT cause layout to shift as they appear and disappear.
- **FR-019**: In the desktop shell, promotional desktop-download surfaces and the long web footer MUST NOT be rendered.

**Window chrome**

- **FR-020**: The desktop window MUST be created without the operating system's default title bar.
- **FR-021**: The application MUST provide its own title strip that identifies the application and MUST be draggable to move the window.
- **FR-022**: The title strip MUST provide working minimize, maximize/restore, and close controls; interactive elements within the strip MUST receive their clicks rather than having them consumed by the drag region.
- **FR-023**: The maximize/restore control MUST reflect the window's true state, including changes originating outside the control itself.

**Development-environment safeguards**

- **FR-024**: Starting a development session MUST first clear any process holding the ports the session needs.
- **FR-025**: A clean development entry point MUST be available that removes cached build output and stale dependency caches before starting.
- **FR-026**: A Service Worker MUST NOT be registered outside production, and any Service Worker registered by an earlier production-like session MUST be removed when the application runs outside production.
- **FR-027**: The repository's agent-facing guidance MUST require, for any user-interface change, that the changed component is confirmed to be reachable from the page that renders it and that the expected content is confirmed present in the rendered output before the change is reported complete.

### Key Entities

- **Lecture**: An item of study material belonging to a subject. Carries an identifier, a display title, an ordinal position within the subject, and optionally a document to read and a duration.
- **Subject**: The grouping whose lectures populate the list; carries a display name shown as the workspace heading.
- **Workspace selection**: The transient state of which lecture is open, whether the assistant panel is expanded, and the assistant scope derived from the open lecture. Session-scoped; not persisted by this feature.
- **Assistant conversation**: The exchange between the student and the assistant, bound to the lecture in scope at the time each message is sent.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A student can move from one lecture to another and see its content without any intermediate screen, in a single action.
- **SC-002**: A student can have study material and the assistant's answer about that material visible at the same moment, with zero window or tab switches.
- **SC-003**: Switching the open lecture presents the new content within one second on a machine that meets the app's minimum specification.
- **SC-004**: No action inside the workspace causes the window as a whole to scroll.
- **SC-005**: A reviewer performing the browser-habit checklist — drag-select chrome, drag an image, right-click, scroll past the viewport, look for a download banner or footer — finds zero of the five behaviours present in the desktop app, and all five intact in the browser.
- **SC-006**: Study content remains selectable and copyable in the desktop app in 100% of the places a student reads prose.
- **SC-007**: Every window control in the custom title strip performs its action on first activation, with no dead click regions.
- **SC-008**: Following a change to visible text, a maintainer sees that text after a single reload, without manually clearing browser storage.
- **SC-009**: Starting a development session while a stale one is running succeeds on the expected port on the first attempt.
- **SC-010**: The browser experience shows no visual or behavioural regression attributable to this feature.

## Assumptions

- The Electron window loads the Next.js application served from `apps/web`; there is no separate desktop renderer bundle, so desktop-only user interface code lives in the web application and is selected at runtime. `apps/desktop` owns only shell concerns.
- The preload bridge (`window.masarxDesktop`) is the sole runtime signal distinguishing shell from browser. No user-agent sniffing and no build-time flag is used, since one build serves both.
- The document reader embeds the existing document surface rather than implementing a page renderer. Highlighting applies to platform-owned text content; annotating arbitrary third-party document internals is out of scope and deferred.
- The assistant is the platform's existing assistant ("Zane"); this feature supplies its placement, its collapse behaviour, and the lecture scope it is told about. It does not change how the assistant answers.
- Lectures reach the workspace from the platform's existing subject and summary data; no new storage or schema is introduced.
- Suppressing developer shortcuts and reload keys is deliberately excluded: doing so in a build that is also served to browsers, and during active development, costs more than the perceived polish it buys. The context menu, selection, and drag suppressions cover the visible symptoms.
- Command palette, system tray, native notifications, taskbar progress, drag-and-drop file import, "show in folder", and the bottom status bar are all discussed in the source transcript but are NOT part of this feature. They are follow-on work; this feature covers the three-column workspace, the native-feel pass, the window chrome, and the development safeguards.
- Windows is the reference platform for verification, consistent with the current build targets. Nothing in the design is Windows-specific.
