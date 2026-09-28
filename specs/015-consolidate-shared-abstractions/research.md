# Research: Consolidate Cross-Surface Abstractions (Spec 015)

**Generated**: 2026-09-28
**Phase**: 0 (research consolidation)
**Branch**: `015-consolidate-shared-abstractions`

This refactor has zero technical unknowns — every decision is dictated by the existing code shape (already audited in the upstream SubAgent investigation). This research.md therefore documents the **decisions that were made during audit**, not new research.

## Decision 1: How is the IPC bridge type extracted from preload's `contextBridge.exposeInMainWorld` literal?

**Decision**: Move the `api` object literal (or its inferred type) from `apps/desktop/src/main/preload.ts` into `packages/shared/src/types/desktop-bridge.ts`, and have preload import the literal back. The shared file exports `MasarxDesktopBridge = typeof api` and web's `runtime.ts` re-exports it for renderer consumption.

**Rationale**: The preload `api` object literal is already the only authoritative surface — `export type MasarxDesktopApi = typeof api` already exists at `preload.ts:94` but is never imported. Promoting the literal (not just the type) means the runtime value and the TypeScript type cannot drift: changes to the literal propagate to web automatically.

**Alternatives considered**:

- **Type-only extraction** (move `MasarxDesktopBridge` interface, keep `api` literal in preload): rejected — TypeScript-only safety doesn't prevent the gotcha-class bug where preload adds a channel but the interface stays stale. Compile error from a literal-side test is the only durable guarantee.
- **Generate type from a runtime channel-name map**: rejected — over-engineered for one bridge shape; would require a build step that doesn't exist.
- **Use `napi-rs` / ABI bridge to expose preload types at runtime**: rejected — overkill, doesn't solve the problem (which is compile-time drift, not runtime).

## Decision 2: How does the shared Smart Paste Canvas helper detect `TextEncoder` safely on mobile?

**Decision**: At module-load time, detect via `typeof TextEncoder !== 'undefined'`. If absent (Hermes), use a polyfill that counts UTF-16 code units (the same char length used today). Export a `hasTextEncoder: boolean` constant so tests can assert platform-specific behaviour.

**Rationale**: Hermes lacks `TextEncoder` natively as of RN 0.74; the polyfill must be synchronous (called at module evaluation), zero-cost when `TextEncoder` exists, and pure (no globals mutated). The char-length fallback is what the mobile file uses today; promoting it to a named fallback keeps behaviour identical while documenting the divergence.

**Alternatives considered**:

- **`fastestsmallesttextencoderdecoder` polyfill**: rejected — adds a runtime dep, and the char-length fallback is good enough for the use case (size preview, not accurate byte count).
- **Use `Buffer.byteLength` via `Buffer` polyfill**: rejected — RN doesn't have `Buffer` out of the box.
- **Force byte-length everywhere and assume TextEncoder**: rejected — would crash at module load on Hermes.

## Decision 3: Test runner strategy for the new shared module

**Decision**: Add Vitest config to `packages/shared/vitest.config.ts` (currently missing — `packages/shared` has no Vitest at all per the audit; 7 tests live as standalone scripts). Mirror the `apps/web/vitest.config.ts` style.

**Rationale**: The shared module exports pure functions over plain data — the ideal Vitest target. Adding the config is one file, ~10 lines. No native dependencies, no DOM, no async — fast tests.

**Alternatives considered**:

- **Place tests in `apps/web/src/lib/ai/` mirroring the shared module**: rejected — violates the invariant "shared types + Zod in `packages/shared`" (I2 equivalent). The test file belongs with the code.
- **Use Node's built-in `node:test`**: rejected — Vitest is already configured across the monorepo (web + desktop); introducing a second runner adds CI complexity for no gain.
- **Place tests in a new `packages/shared/__tests__/` directory**: rejected — the convention in this repo (apps/web) is co-located `*.test.ts` next to source.

## Decision 4: How to verify the 20 dead exports are truly unused before deletion?

**Decision**: Run a 2-stage grep before deletion:
1. Source-tree grep: `rg -l 'ValidatedCourse|ValidatedCourseWithInstructor|ValidatedNews|ValidatedProfile|ValidatedQuiz|Waitlist' apps/ packages/` — expect zero files.
2. Build-output grep: `rg -l ... apps/*/.next apps/*/dist` — expect zero (catches dynamic imports via barrel re-exports).

The audit already showed zero hits in source. The deletion script in `tasks.md` will re-verify with the same grep before each delete and abort on any positive hit.

**Rationale**: Deleting a symbol that's actually used is the worst possible failure mode. Two greps costs 5 seconds and gives near-absolute confidence.

**Alternatives considered**:

- **Trust the audit blindly**: rejected — the audit is one source; the implementation run is the moment of truth.
- **Use TypeScript's `noUnusedLocals` / `ts-prune`**: rejected — neither detects exports that are imported but transitively dead; they only detect local variables.

## Decision 5: Branch and ownership boundary

**Decision**: This is a **web-owned** implementation per the standing memory rule (web owns `apps/web/**` + `packages/shared/**`). Desktop owns `apps/desktop/**`. The single desktop-side change — replacing the inline `api` literal with an import from `packages/shared` — must be reviewed by the desktop agent per the IPC-contract handshake rule. No new branch merge to `apps/desktop` is initiated by this plan; desktop agent picks up its half via the `kanban` flow when the web side lands.

**Rationale**: Standing memory documents this exact boundary. The spec checklist explicitly calls out the dual-review requirement.

**Alternatives considered**:

- **Single agent owns both sides**: rejected — violates the multi-agent ownership convention.
- **Do desktop-side change last, after web lands**: rejected — would leave the bridge broken mid-merge window if the renderer pulls the new shared type before preload imports it.

## Outstanding NEEDS CLARIFICATION

**None.** All decisions are derivable from existing code + standing memory. The spec author used informed defaults per the SpecKit guidelines.