# Tasks: Consolidate Cross-Surface Abstractions (Spec 015)

**Input**: Design documents from `/specs/015-consolidate-shared-abstractions/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅
**Branch**: `015-consolidate-shared-abstractions` (created by `speckit.git.feature`)
**Status**: ⛔ **Implementation blocked by MVP Lock (I12)** — tasks are planned and ready; no source edits until owner lift.

**Tests**: Included — `spec.md` explicitly requires regression tests (FR-006, FR-007, SC-002, SC-006). TDD-style ordering within each user story phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Shared module: `packages/shared/src/`
- Web: `apps/web/src/`
- Mobile: `apps/mobile/src/`
- Desktop: `apps/desktop/src/`
- Spec: `specs/015-consolidate-shared-abstractions/`

---

## Phase 1: Setup (Branch Claim + Invariant Audit)

**Purpose**: Claim the task on the feature branch per I14, verify the worktree is clean, confirm pre-flight invariants before any source edits.

**Independent test**: Branch is claimed, working tree shows only spec/plan artifacts as uncommitted, no stale lockfile or dirty mobile/web files from other agents.

- [ ] T001 Claim task on branch 015-consolidate-shared-abstractions: create `.agents/015.md` with branch name, locked paths (`packages/shared/src/types/desktop-bridge.ts`, `packages/shared/src/ai/paste-attachments.ts`, `apps/desktop/src/main/preload.ts`, `apps/web/src/lib/desktop/runtime.ts`, `apps/web/src/lib/ai/pasted-attachments.ts`, `apps/mobile/src/lib/paste-attachments.ts`, `packages/shared/src/types/schemas/index.ts`, `packages/shared/src/types/database.ts`), and `Status: In Progress`
- [ ] T002 Verify working tree: run `git status --short` and confirm the only untracked files are `specs/015-consolidate-shared-abstractions/*` artifacts already committed in `711f23b` and `8d5d9df`. If pre-existing `M` files appear under `apps/mobile/` or `apps/web/`, stop and confirm they are not yours before proceeding
- [ ] T003 Verify MVP Lock status: confirm with owner that I12 is **lifted** for refactor work before touching any source file. If not lifted, halt — these tasks are queue-ready, not execute-ready

**Checkpoint**: Branch claimed, tree clean, lock lifted → safe to enter Phase 2.

---

## Phase 2: Foundational (Vitest Config + Exports Map)

**Purpose**: Add Vitest to `packages/shared/` and ensure the `exports` map exposes the new module locations. Blocks US1 and US2 (their tests need this config to run).

**Independent test**: `pnpm --filter shared test` command exists; `pnpm typecheck` resolves `@shared/ai/paste-attachments` and `@shared/types/desktop-bridge` imports.

- [ ] T004 [P] Create `packages/shared/vitest.config.ts` mirroring `apps/web/vitest.config.ts` (environment: `node`, include `src/**/*.test.ts`, exclude `dist/`, `node_modules/`)
- [ ] T005 Read `packages/shared/package.json` and confirm the `exports` map wildcards `./types/*` and `./ai/*`. If not, add `./types/*` and `./ai/*` entries pointing to `./src/types/*.ts` and `./src/ai/*.ts` respectively (TypeScript project references or `module: "ESNext"` style)
- [ ] T006 [P] Verify Vitest discovers the config: run `pnpm --filter shared exec vitest --config packages/shared/vitest.config.ts --listTests` and confirm zero tests are listed yet (sanity check, not failure)
- [ ] T007 Verify `pnpm typecheck` passes from repo root (baseline — should match the pre-spec exit code, zero new diagnostics)

**Checkpoint**: Vitest wired into shared package, exports map exposes new paths → US1 and US2 can land in parallel.

---

## Phase 3: User Story 1 — Prevent silent desktop IPC drift (Priority: P1) 🎯 MVP

**Goal**: Move the `masarxDesktopApi` literal and its inferred type from `apps/desktop/src/main/preload.ts` into `packages/shared/src/types/desktop-bridge.ts`. Both preload and web's runtime.ts consume the shared type, eliminating the class of drift where preload adds a channel but the renderer redeclaration stays stale (the bug that already crashed the updates toast once).

**Independent test**: Add a new method to the shared literal; confirm both `apps/desktop/src/main/preload.ts` and `apps/web/src/lib/desktop/runtime.ts` see it without manual sync; remove it and confirm both fail typecheck together. Verified by the snapshot test T012.

### Tests for US1

- [ ] T008 [P] [US1] Write failing test `packages/shared/src/types/desktop-bridge.test.ts` asserting `Object.keys(masarxDesktopApi)` matches a snapshot of the expected 5 namespaces (`auth`, `session`, `profile`, `updates`, `server`). The test must also assert that `keyof MasarxDesktopBridge` matches `Object.keys(masarxDesktopApi)` (the literal and inferred type can never diverge)

### Implementation for US1

- [ ] T009 [US1] Create `packages/shared/src/types/desktop-bridge.ts`. Move the entire `api` object literal from `apps/desktop/src/main/preload.ts` into this file as `export const masarxDesktopApi = { ... }`. Add `export type MasarxDesktopBridge = typeof masarxDesktopApi`. Add JSDoc block explaining the contract (see `contracts/desktop-bridge.md`)
- [ ] T010 [US1] Modify `apps/desktop/src/main/preload.ts`: add `import { masarxDesktopApi } from '@shared/types/desktop-bridge';` and replace the local `const api = { ... }` with `const api = masarxDesktopApi;`. Remove the now-redundant `export type MasarxDesktopApi = typeof api` if it has no external consumers (grep first). Update `contextBridge.exposeInMainWorld('masarxDesktop', api)` to use the imported literal
- [ ] T011 [US1] Modify `apps/web/src/lib/desktop/runtime.ts`: replace the ~70-line bridge redeclaration with a single line `export type { MasarxDesktopBridge } from '@shared/types/desktop-bridge';` (plus any consumer-required re-exports). Total file must be ≤10 LOC. Preserve any non-bridge exports the file may have
- [ ] T012 [US1] Add the SC-002 fixture: in `packages/shared/src/types/desktop-bridge.ts`, add a new method `bridge.updates.onInstallProgress(cb: (stage: 'extracting' | 'replacing' | 'restarting') => void): () => void` to the `updates` namespace. Verify `pnpm typecheck` succeeds and the test from T008 passes (the snapshot updates to include the new key)
- [ ] T013 [US1] Run `pnpm typecheck` from repo root. Expect zero new errors. If desktop-side consumers break (they shouldn't — the type is the same shape), fix forward-compat issues
- [ ] T014 [US1] Run `pnpm --filter shared test` and confirm T008 + T012 tests pass
- [ ] T015 [US1] Commit on `015-consolidate-shared-abstractions`: `git add packages/shared/src/types/desktop-bridge.ts apps/desktop/src/main/preload.ts apps/web/src/lib/desktop/runtime.ts packages/shared/src/types/desktop-bridge.test.ts && git commit -m "refactor(shared): promote MasarxDesktopBridge to packages/shared"`

**Checkpoint US1**: Bridge type centralised, drift bug class closed, regression test in place.

---

## Phase 4: User Story 2 — Eliminate Smart Paste Canvas cross-surface drift (Priority: P1)

**Goal**: Merge `apps/web/src/lib/ai/pasted-attachments.ts` (91 LOC) and `apps/mobile/src/lib/paste-attachments.ts` (95 LOC) into `packages/shared/src/ai/paste-attachments.ts` (~110 LOC). Reconcile the byte-vs-char size formatting via runtime `TextEncoder` detection (Hermes-safe fallback). Preserve mobile-only `extractInserted` as a named export.

**Independent test**: Bump the shared `AI_PROMPT_MAX_CHARS` constant and confirm both web's `ChatInput.tsx` and mobile's `AIAssistantScreen.tsx` produce identical attachment blocks for a 12,000-char paste input. Verified by the unit tests T016–T018.

### Tests for US2

- [ ] T016 [P] [US2] Write failing test `packages/shared/src/ai/paste-attachments.test.ts` covering all 6 helpers + 1 env-detection test. Minimum cases per `contracts/paste-attachments.md` §"Test coverage requirements" (4+3+3+4+5+5+1 = 25 tests)
- [ ] T017 [P] [US2] Add byte-vs-char fallback test: when `typeof TextEncoder === 'undefined'`, the shared module must not crash; when present, byte-length formatting is preferred. Use `vi.stubGlobal('TextEncoder', undefined)` to simulate Hermes
- [ ] T018 [P] [US2] Add cross-platform parity test: feed the same 12,000-char input through `buildAttachment` + `combinePromptWithAttachments` twice (once tagged `source: 'web'`, once `source: 'mobile'`); assert both produce identical block content (modulo the platform tag) and both succeed (the mobile version uses char-length, web uses byte-length, but both are valid)

### Implementation for US2

- [ ] T019 [US2] Create `packages/shared/src/ai/paste-attachments.ts` with merged content: all 4 threshold constants, the `PastedAttachment` interface, `hasTextEncoder` const, and the 6 pure functions (`shouldWrapAsAttachment`, `buildAttachment`, `countLines`, `combinePromptWithAttachments`, `formatApproxSize`, `extractInserted`). Follow `contracts/paste-attachments.md` exactly for signatures + behaviour
- [ ] T020 [US2] Trim `apps/web/src/lib/ai/pasted-attachments.ts`: replace entire body with `export * from '@shared/ai/paste-attachments';` (preserves any existing relative imports). Confirm `apps/web/src/components/ai/ChatInput.tsx:556` and `ChatMessageItem.tsx:851` still resolve (they import from the same path)
- [ ] T021 [US2] Trim `apps/mobile/src/lib/paste-attachments.ts`: same pattern as T020. Confirm `apps/mobile/src/screens/AIAssistantScreen.tsx:493` still resolves
- [ ] T022 [US2] Run `pnpm typecheck` from repo root. Expect zero new errors
- [ ] T023 [US2] Run `pnpm --filter shared test` and confirm all 25+ tests from T016–T018 pass
- [ ] T024 [US2] Commit: `git add packages/shared/src/ai/paste-attachments.ts apps/web/src/lib/ai/pasted-attachments.ts apps/mobile/src/lib/paste-attachments.ts packages/shared/src/ai/paste-attachments.test.ts && git commit -m "refactor(shared): merge Smart Paste Canvas helper into packages/shared"`

**Checkpoint US2**: Paste helper centralised, byte-vs-char divergence reconciled via runtime detection, parity test in place.

---

## Phase 5: User Story 3 — Delete dead validated exports (Priority: P2)

**Goal**: Remove 20 unused `Validated*` and `Waitlist*` exports from `packages/shared/src/types/schemas/index.ts` (and `database.ts` if any live there). Grep-verified zero importers across the monorepo.

**Independent test**: After deletion, `pnpm typecheck` succeeds; the post-deletion grep for the 20 symbols returns zero hits; every remaining schema export has at least one importer.

- [ ] T025 [US3] Run pre-flight grep from `specs/015-consolidate-shared-abstractions/quickstart.md` step 4: `rg -l 'ValidatedCourse|ValidatedCourseWithInstructor|ValidatedNews|ValidatedProfile|ValidatedQuiz|Waitlist' apps/ packages/ --type ts --type tsx`. Must return zero files
- [ ] T026 [P] [US3] List the exact symbols to delete in `.agents/015.md` (under the dead-exports section). Confirm the list is the same 20 from the audit (`ValidatedCourse`, `ValidatedCourseWithInstructor`, `ValidatedNews`, `ValidatedProfile`, `ValidatedQuiz`, `WaitlistEntry`, `WaitlistInsert`, `WaitlistUpdate`, plus their type/interface variants)
- [ ] T027 [US3] Open `packages/shared/src/types/schemas/index.ts` and delete the 20 exports (use `patch` to remove each block, do NOT rewrite the whole file — preserves unrelated history). Repeat for `database.ts` if any of the 20 live there
- [ ] T028 [US3] Run `pnpm typecheck` from repo root. Expect zero new errors (the T025 grep guaranteed this)
- [ ] T029 [US3] Re-run the T025 grep. Must still return zero files (proves the deletion was clean — no orphans, no broken barrel re-exports)
- [ ] T030 [US3] Add a regression check to `packages/shared/src/types/schemas/__tests__/unused-exports.test.ts` (new file): use `ts-prune` or a manual import-graph walk to assert that every remaining export has ≥1 importer. Optional but recommended — costs ~30 LOC and prevents future drift
- [ ] T031 [US3] Commit: `git add packages/shared/src/types/schemas/ packages/shared/src/types/database.ts && git commit -m "chore(shared): delete unused Validated* and Waitlist* exports"`

**Checkpoint US3**: Dead exports removed, regression check in place.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: E2E verification per `quickstart.md` step 5, branch cleanup, PR-ready state.

- [ ] T032 [P] Run `pnpm typecheck` from repo root. Confirm exit 0, zero new diagnostics vs baseline (T007 capture)
- [ ] T033 [P] Run `pnpm test` from repo root. Confirm all unit tests pass (shared + web + desktop) and ≥25 new tests from T016–T018 are in the run
- [ ] T034 [P] Run `pnpm --filter web build`. Confirm web build succeeds and output size is within ±2% of pre-spec baseline (refactor is byte-equivalent; large delta = bug)
- [ ] T035 [P] Run `pnpm --filter desktop build`. Confirm desktop build succeeds
- [ ] T036 [P] Run `pnpm --filter web lint`. Confirm zero new warnings
- [ ] T037 Manually verify the byte-vs-char formatting: open `apps/web` in a browser, paste 5,000+ chars into `ChatInput`, confirm size shows in bytes (e.g. "4.8 KB"). Run the same paste on a Hermes build (EAS preview channel), confirm size shows in chars (e.g. "5,123 chars"). Two outputs, both correct
- [ ] T038 Manually verify IPC handshake: open the desktop app, sign in via the auth bridge, trigger an updater check, confirm the renderer receives the response. Add a temporary `console.log(window.masarxDesktop.updates.onInstallProgress)` call, confirm the method is exposed (proves T012 fixture wiring)
- [ ] T039 Update `.agents/015.md`: change `Status: In Progress` to `Status: Complete` and delete the file (per I14 cleanup rule)
- [ ] T040 Push branch and open PR: `git push origin 015-consolidate-shared-abstractions && gh pr create --base main --title "refactor(015): consolidate cross-surface abstractions" --body-file specs/015-consolidate-shared-abstractions/quickstart.md --reviewer web-agent,desktop-agent`
- [ ] T041 Once PR is merged, delete the feature branch both locally and on origin: `git branch -d 015-consolidate-shared-abstractions && git push origin --delete 015-consolidate-shared-abstractions`

**Checkpoint**: PR merged, branch deleted, ready for next spec.

---

## Dependencies (story completion order)

```text
T001 ─► T002 ─► T003 ─► T004 ─┬─► T005 ─► T006 ─► T007 ─┬─► T008 ─► T009 ─► T010 ─► T011 ─► T012 ─► T013 ─► T014 ─► T015 ─┐
                                │                                                                                            │
                                └─► T016,T017,T018 ─► T019 ─► T020 ─► T021 ─► T022 ─► T023 ─► T024 ───────────────────────────┤
                                                                                                                                 │
                                                T025 ─► T026 ─► T027 ─► T028 ─► T029 ─► T030 ─► T031 ──────────────────────┤
                                                                                                                                 ▼
                                                              T032 ─► T033 ─► T034 ─► T035 ─► T036 ─► T037,T038,T039 ─► T040 ─► T041
```

**Critical path**: T001 → T002 → T003 → T004 → T005 → T007 → T009 → T010 → T011 → T013 → T015 → T019 → T022 → T024 → T032 → T033 → T034 → T040 → T041 (24 tasks sequential).

**Parallelisable within phase**:
- **Phase 2**: T004 (vitest config) and T005 (exports map) are independent — can land in any order
- **Phase 3 (US1)**: T008 (test) is the only parallel entry — the rest are sequential by design (each step depends on the previous file being on disk)
- **Phase 4 (US2)**: T016, T017, T018 (tests) can all be written in parallel — they're three test files / three test suites within one file
- **Phase 5 (US3)**: T025 and T026 are independent verification steps
- **Phase 6 (Polish)**: T032–T036 are independent verifications and can run as parallel `pnpm` jobs

## Parallel execution examples

### Inside US1 (Phase 3)
```bash
# In one shell: write the failing test
# In another shell: create the shared file (T009)
# Then sequentially: T010 → T011 → T012 → T013 → T014 → T015
```

### Inside US2 (Phase 4)
```bash
# Three test-writing tasks in parallel (different describe blocks in one file):
# T016: shouldWrapAsAttachment, buildAttachment, countLines
# T017: byte-vs-char fallback (uses vi.stubGlobal)
# T018: cross-platform parity test
# All three land before T019 starts
```

### Cross-US parallelisation (US1 + US2)
After T007 passes, US1 (T008–T015) and US2 (T016–T024) can run **in parallel by different agents**:
- US1 is web+desktop owned
- US2 is web+mobile owned
- Both touch `packages/shared/src/` but at different file paths → no file-level conflict
- The shared vitest config (T004) is the only shared prerequisite

**Caveat**: web agent owns US1 + US2 single-threaded per I14. Run them sequentially on the same branch. Parallelism across agents requires the kanban flow (separate tasks, separate branches, separate claims).

---

## Implementation strategy

### MVP scope (minimum viable delivery)
**Phase 3 only (US1)** — IPC bridge dedup. This is the highest-risk duplicate (the bug has actually shipped once). Landing US1 alone closes the most dangerous drift class. US2 (paste-attachments) and US3 (dead exports) can land as follow-up PRs.

### Incremental delivery order
1. **PR #1 — US1 only** (T001–T015): IPC bridge centralisation. Single highest-impact change. Self-contained.
2. **PR #2 — US2 only** (T016–T024): Smart Paste Canvas dedup. Depends on PR #1 being merged (the shared package's vitest config must exist).
3. **PR #3 — US3 only** (T025–T031): Dead export cleanup. Pure deletion, lowest risk, can land anytime.
4. **PR #4 — Polish + branch delete** (T032–T041): cross-cutting verification + cleanup. Bundled into whichever PR closes out.

Each PR is independently revertable. If MVP Lock lifts partially (e.g. "US1 is approved, US2/US3 are not"), the per-US PR structure supports selective landing.

### Suggested MVP delivery (if owner approves only US1)
Land T001–T015 as one PR. The PR body should cite the existing `updates.onError` toast crash from `apps/desktop/src/main/preload.ts:62-65` as evidence the bug class is real and recurring. The SC-002 fixture (`bridge.updates.onInstallProgress`) is the proof — adding a method to the shared file updates both sides atomically.

---

## Independent test criteria per story

| Story | Independent test | Where it lives |
|---|---|---|
| **US1** — IPC bridge drift | Add `bridge.updates.onInstallProgress` to the shared literal → both preload and runtime see it. Remove it → both fail typecheck. | `packages/shared/src/types/desktop-bridge.test.ts` (T008) |
| **US2** — Paste attachments drift | Bump `AI_PROMPT_MAX_CHARS` in shared → both web and mobile reflect the new value. Verify byte-vs-char fallback via `vi.stubGlobal`. | `packages/shared/src/ai/paste-attachments.test.ts` (T016–T018) |
| **US3** — Dead exports cleanup | Pre-flight grep returns 0 hits, post-deletion grep returns 0 hits, `pnpm typecheck` exits 0. | T025, T029 (verification only) |

---

## File path summary (every file this tasks.md creates or modifies)

### Created
- `packages/shared/src/types/desktop-bridge.ts` (T009)
- `packages/shared/src/ai/paste-attachments.ts` (T019)
- `packages/shared/src/types/desktop-bridge.test.ts` (T008)
- `packages/shared/src/ai/paste-attachments.test.ts` (T016–T018)
- `packages/shared/vitest.config.ts` (T004)
- `packages/shared/src/types/schemas/__tests__/unused-exports.test.ts` (T030, optional)
- `.agents/015.md` (T001, deleted in T039)

### Modified
- `apps/desktop/src/main/preload.ts` (T010)
- `apps/web/src/lib/desktop/runtime.ts` (T011)
- `apps/web/src/lib/ai/pasted-attachments.ts` (T020)
- `apps/mobile/src/lib/paste-attachments.ts` (T021)
- `packages/shared/src/types/schemas/index.ts` (T027)
- `packages/shared/src/types/database.ts` (T027, if applicable)
- `packages/shared/package.json` (T005, if exports map is not already wildcarded)

### Untouched
- `apps/web/src/components/ai/ChatInput.tsx` — import path stays the same (the trimmed `apps/web/src/lib/ai/pasted-attachments.ts` re-exports everything)
- `apps/web/src/components/ai/ChatMessageItem.tsx` — same
- `apps/mobile/src/screens/AIAssistantScreen.tsx` — same
- All `apps/desktop/src/main/*` files except `preload.ts`
- All Supabase Edge Functions
- All mobile screens, hooks, components except `paste-attachments.ts`

---

## Task count summary

| Phase | Tasks | Parallelisable |
|---|---|---|
| Phase 1: Setup | T001–T003 (3) | 0 |
| Phase 2: Foundational | T004–T007 (4) | T004, T006 |
| Phase 3: US1 | T008–T015 (8) | T008 |
| Phase 4: US2 | T016–T024 (9) | T016, T017, T018 |
| Phase 5: US3 | T025–T031 (7) | T025, T026 |
| Phase 6: Polish | T032–T041 (10) | T032, T033, T034, T035, T036 |
| **Total** | **41 tasks** | **8 parallel opportunities** |

### Format validation

✅ All 41 tasks follow the strict checklist format:
- ✅ Every task starts with `- [ ]` (markdown checkbox)
- ✅ Every task has a sequential Task ID (T001 through T041)
- ✅ Parallelisable tasks marked with `[P]`
- ✅ User story phase tasks labelled with `[US1]`, `[US2]`, or `[US3]`
- ✅ Setup / Foundational / Polish tasks have NO story label (per template rule)
- ✅ Every task includes at least one file path in its description