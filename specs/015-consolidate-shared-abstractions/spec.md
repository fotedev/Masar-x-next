# Feature Specification: Consolidate Cross-Surface Abstractions

**Feature Branch**: `[015-consolidate-shared-abstractions]`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "Consolidate cross-surface TypeScript abstractions: promote the MasarxDesktopApi preload type and the Smart Paste Canvas attachment helpers into packages/shared so web/desktop/mobile stop duplicating them."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Prevent silent desktop IPC drift (Priority: P1)

A desktop developer adds a new channel (e.g. `bridge.updates.onInstallProgress`) in `apps/desktop/src/main/preload.ts`. Today, `apps/web/src/lib/desktop/runtime.ts` has its own redeclaration of the bridge shape that doesn't auto-track this change; the renderer crashes on first use because the new method is missing. After this feature, the bridge shape lives in `packages/shared` and is consumed by both sides — adding a channel updates both at once.

**Why this priority**: A real incident already occurred (the `updates.onError` toast crash, documented in `apps/desktop/src/main/preload.ts:62-65`). Any future channel addition risks the same crash silently; this is the highest-risk duplicate in the codebase and the cheapest to fix.

**Independent Test**: Add a new method to the shared bridge type; verify both `apps/desktop/src/main/preload.ts` and `apps/web/src/lib/desktop/runtime.ts` pick it up without manual sync; remove it and confirm both sides fail typecheck together.

**Acceptance Scenarios**:

1. **Given** the shared bridge type is consumed by both preload and runtime, **When** a developer adds a new channel to preload, **Then** the corresponding call site in web's renderer typechecks against the new method automatically (no manual runtime.ts sync).
2. **Given** the old duplicate bridge shape in `runtime.ts`, **When** this spec is implemented, **Then** `runtime.ts` imports the type from `packages/shared` and contains ≤10 lines of bridge-shape code (down from ~70).
3. **Given** a regression test asserting the preload API surface matches the shared type literal, **When** the test runs in CI, **Then** any drift between preload `contextBridge.exposeInMainWorld` and the shared `MasarxDesktopBridge` type fails the test before merge.

---

### User Story 2 - Eliminate Smart Paste Canvas cross-surface drift (Priority: P1)

The web chat input and the mobile AI Assistant screen both paste rich-text into a long prompt. Today each has its own ~95-LOC copy of the "Smart Paste Canvas" logic with four shared constants (`PASTE_CHAR_THRESHOLD`, `PASTE_LINE_THRESHOLD`, `AI_PROMPT_MAX_CHARS`, attachment block format). Bumping `AI_PROMPT_MAX_CHARS` in one and forgetting the other would silently change behaviour on one platform only.

**Why this priority**: Both files are byte-identical-by-convention (one even has a comment "Byte-identical format to the web helper" — `apps/mobile/src/lib/paste-attachments.ts:82-83`). The drift risk is the same class as the IPC bridge: parallel maintenance, no shared source of truth.

**Independent Test**: Change the shared `AI_PROMPT_MAX_CHARS` constant in `packages/shared/src/ai/paste-attachments.ts`; verify both web and mobile code paths pick up the new value, and a unit test on the shared helper confirms the threshold change is honoured by both consumers.

**Acceptance Scenarios**:

1. **Given** a unified `packages/shared/src/ai/paste-attachments.ts` exporting `PastedAttachment`, the four thresholds, `combinePromptWithAttachments`, `buildAttachmentBlock`, `countLines`, `shouldWrapAsAttachment`, and `formatApproxSize`, **When** the web `ChatInput` and mobile `AIAssistantScreen` import from there, **Then** both surfaces produce identical attachment blocks for the same input.
2. **Given** the mobile-only `extractInserted(prev, next)` helper for `onChangeText` diffing, **When** this is preserved in the shared module with a clear platform note, **Then** web consumers can ignore it via a named export rather than a divergent copy.
3. **Given** the format-size divergence (web uses `TextEncoder` byte count, mobile uses `formatApproxSize` char length because Hermes lacks TextEncoder), **When** this is implemented, **Then** the shared helper auto-detects environment (`TextEncoder` availability) and falls back to char-length on mobile — documented in the helper's JSDoc.

---

### User Story 3 - Delete dead validated exports from packages/shared (Priority: P2)

`packages/shared/src/types/schemas/index.ts` and `database.ts` contain 20 exports with zero importers anywhere in the repo — primarily the `ValidatedCourse / ValidatedCourseWithInstructor / ValidatedNews / ValidatedProfile / ValidatedQuiz / Waitlist*` family generated for spec 018 and never wired. Leaving them in place adds maintenance burden and confuses future readers.

**Why this priority**: Pure deletion with no behaviour change. Frees the schema namespace for what this refactor needs (a single source-of-truth bridge type). P2 because it doesn't fix a bug, just removes dead code.

**Independent Test**: Run a grep across `apps/` and `packages/` for each of the 20 symbols; confirm zero imports; delete them; rerun `pnpm typecheck` to confirm no broken references.

**Acceptance Scenarios**:

1. **Given** a verified list of 20 unused exports, **When** they are removed from `packages/shared/src/types/schemas/index.ts` and `database.ts`, **Then** `pnpm typecheck` succeeds with no new errors.
2. **Given** the remaining schema exports after deletion, **When** a developer searches the codebase, **Then** every exported symbol has at least one importer (proves the namespace is clean).

---

### Edge Cases

- **What happens if the desktop preload adds a channel that the runtime doesn't know about yet, mid-merge?** The shared type makes this a compile error rather than a runtime crash — by design.
- **What happens if a third platform is added (e.g. CLI tool) that imports the shared bridge type?** The shared type is platform-agnostic (`MasarxDesktopBridge` is a plain TypeScript interface). New importers just consume it.
- **What happens if `TextEncoder` is polyfilled on mobile by a future Hermes update?** The shared helper's environment-detection branch will automatically prefer byte-length formatting — no code change needed.
- **What happens if the AI prompt format changes (e.g. switching from JSON blocks to YAML)?** Today this requires updating two files in lock-step; after this spec, only `packages/shared/src/ai/paste-attachments.ts` changes.
- **What happens if a developer on web-only doesn't want mobile's `extractInserted` helper in their tree?** It's a named export — bundlers with dead-code elimination (Turbopack default in Next 16, Metro default in RN) drop unreferenced exports, so unused helpers cost zero bundle bytes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a single source-of-truth `MasarxDesktopBridge` type in `packages/shared/src/types/desktop-bridge.ts` consumed by both `apps/desktop/src/main/preload.ts` and `apps/web/src/lib/desktop/runtime.ts`.
- **FR-002**: System MUST provide a single `packages/shared/src/ai/paste-attachments.ts` module exporting all four threshold constants, the attachment data type, `combinePromptWithAttachments`, `buildAttachmentBlock`, `countLines`, `shouldWrapAsAttachment`, and `formatApproxSize` for both web and mobile consumers.
- **FR-003**: `apps/web/src/lib/desktop/runtime.ts` MUST reduce to ≤10 lines of bridge-shape code (import + re-export only), down from ~70 lines.
- **FR-004**: `apps/web/src/components/ai/ChatInput.tsx` and `apps/mobile/src/screens/AIAssistantScreen.tsx` MUST import Smart Paste Canvas helpers from `packages/shared/src/ai/paste-attachments.ts` instead of from local copies.
- **FR-005**: System MUST delete the 20 unused `Validated*` and `Waitlist*` exports from `packages/shared/src/types/schemas/` with zero importers across the monorepo.
- **FR-006**: System MUST include a regression test asserting the shape of `MasarxDesktopBridge` exactly matches the channel names exposed by `contextBridge.exposeInMainWorld('masarxDesktop', api)` in `apps/desktop/src/main/preload.ts`.
- **FR-007**: System MUST include unit tests for the shared Smart Paste Canvas helpers covering threshold transitions, attachment-block format stability, and the byte-vs-char size formatting fallback.
- **FR-008**: System MUST preserve the mobile-only `extractInserted(prev, next)` helper in the shared module (named export, not used by web).
- **FR-009**: System MUST auto-detect `TextEncoder` availability for size formatting — use byte-length when available (web), char-length when not (mobile/Hermes) — and document this in JSDoc.
- **FR-010**: System MUST NOT change any user-visible behaviour, IPC wire format, or stored data format (refactor is strictly internal consolidation).

### Key Entities *(include if feature involves data)*

- **`MasarxDesktopBridge`**: TypeScript interface describing the five IPC namespaces (`auth`, `session`, `profile`, `updates`, `server`) and their method signatures as exposed by the Electron preload script via `contextBridge`. Lives in `packages/shared/src/types/desktop-bridge.ts`.
- **`PastedAttachment`**: Plain-data interface describing one attachment block produced when pasted text exceeds the threshold (timestamp, original char count, truncated preview, full content). Lives in `packages/shared/src/ai/paste-attachments.ts`.
- **Threshold Constants**: `PASTE_CHAR_THRESHOLD = 4000`, `PASTE_LINE_THRESHOLD = 15`, `AI_PROMPT_MAX_CHARS = 10000` — single set of named exports from the shared module.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Total lines of code across the two affected source files (`apps/web/src/lib/desktop/runtime.ts` + the consolidated helpers) reduces from ~165 LOC to ≤30 LOC, a ≥80% reduction.
- **SC-002**: Adding a new IPC channel requires editing exactly one TypeScript file (preload); the renderer side picks it up automatically. Verified by a sample addition (`bridge.updates.onInstallProgress`) in a regression test fixture.
- **SC-003**: Bumping `AI_PROMPT_MAX_CHARS` requires editing exactly one TypeScript file (`packages/shared/src/ai/paste-attachments.ts`); both web and mobile pick up the new value. Verified by integration test asserting both surfaces produce the same attachment block for a 12,000-char paste.
- **SC-004**: Zero new typecheck or lint errors after the refactor — `pnpm typecheck` returns the same exit code and zero new diagnostics as before.
- **SC-005**: Zero `Validated*` or `Waitlist*` symbols remain in `packages/shared/src/types/schemas/` after the cleanup. Verified by a grep assertion in the regression test fixture.
- **SC-006**: New unit-test coverage in `packages/shared/src/ai/paste-attachments.test.ts` covers all six pure helpers (`combinePromptWithAttachments`, `buildAttachmentBlock`, `countLines`, `shouldWrapAsAttachment`, `formatApproxSize`, `extractInserted`) — at least one test per helper, with ≥80% line coverage on the shared module.

## Assumptions

- **Single ownership rule from `AGENTS.md`** still holds: web owns `apps/web/**` + `packages/shared/**`, desktop owns `apps/desktop/**`. This refactor lives entirely within web's owned surface, but the desktop agent will be pinged for review of the IPC bridge change because it affects both sides (the cross-cutting IPC contract is a handshake).
- **Both web and mobile keep their existing import paths.** The `ChatInput.tsx:556` and `ChatMessageItem.tsx:851` call sites stay; only the underlying implementation moves.
- **The shared package's build target is unchanged.** `packages/shared` already exports TypeScript types and JS modules; no build config change is required.
- **Vitest already supports both web and mobile test runners** (`apps/web/vitest.config.ts` exists). The new shared tests live in `packages/shared/` and run via the existing `pnpm test` script.
- **The byte-vs-char size formatting divergence is intentional and benign.** Documented in JSDoc on `formatApproxSize` so future readers don't "fix" it by forcing byte-length on mobile (which lacks `TextEncoder`).
- **Dead-export deletion is safe.** A grep across `apps/{web,desktop,mobile}` and `packages/` returns zero hits for each of the 20 symbols before deletion (confirmed during the upstream audit).
- **No production behaviour change.** This is a refactor — same prompts, same IPC wire format, same UI flows. Only the internal organisation of code changes.