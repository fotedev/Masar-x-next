# Quickstart: Consolidate Cross-Surface Abstractions (Spec 015)

**Generated**: 2026-09-28
**Phase**: 1
**Branch**: `015-consolidate-shared-abstractions`

A 30-minute developer guide for executing the consolidation. Each step is small enough to land as one commit.

---

## Pre-flight

```bash
cd "C:/programming/WEB_Development/projects/masarx_next"
git checkout 015-consolidate-shared-abstractions
git status  # confirm clean working tree (the spec commit is already there)
pnpm install  # ensure node_modules matches lockfile
```

---

## Step 1 — Create the shared bridge type (15 min)

1. **Create `packages/shared/src/types/desktop-bridge.ts`**.
2. **Move the `api` object literal** from `apps/desktop/src/main/preload.ts` into the new file as a named export.
   - Add `export const masarxDesktopApi = { auth: {...}, session: {...}, ... }` exactly as it appears in preload today
   - Add `export type MasarxDesktopBridge = typeof masarxDesktopApi`
3. **In `apps/desktop/src/main/preload.ts`**, replace the literal with:
   ```typescript
   import { masarxDesktopApi } from '@shared/types/desktop-bridge';
   const api = masarxDesktopApi;
   ```
   Remove the now-duplicate `export type MasarxDesktopApi = typeof api` (or leave it as a re-export for backward compat — confirm with web agent).

4. **In `apps/web/src/lib/desktop/runtime.ts`**, replace the ~70-line bridge redeclaration with:
   ```typescript
   export type { MasarxDesktopBridge } from '@shared/types/desktop-bridge';
   ```

5. **Verify**:
   ```bash
   pnpm typecheck
   ```
   Expect zero errors.

6. **Commit**:
   ```bash
   git add packages/shared/src/types/desktop-bridge.ts apps/desktop/src/main/preload.ts apps/web/src/lib/desktop/runtime.ts
   git commit -m "refactor(shared): promote MasarxDesktopBridge to packages/shared

   Single source of truth for the desktop IPC surface. Closes the
   drift class where preload adds a channel but runtime.ts stays stale.
   Co-locates the api literal and the inferred type so they cannot
   drift by construction."
   ```

---

## Step 2 — Create the shared paste-attachments helper (20 min)

1. **Create `packages/shared/src/ai/paste-attachments.ts`** by merging `apps/web/src/lib/ai/pasted-attachments.ts` and `apps/mobile/src/lib/paste-attachments.ts`. Reconcile the byte-vs-char size formatting via the `hasTextEncoder` detection pattern (see `contracts/paste-attachments.md`).

2. **In `apps/web/src/lib/ai/pasted-attachments.ts`**, replace the entire body with:
   ```typescript
   export * from '@shared/ai/paste-attachments';
   ```
   (or delete and update the 2 import sites in `apps/web/src/components/ai/ChatInput.tsx` and `ChatMessageItem.tsx` to import from `@shared/ai/paste-attachments` directly).

3. **In `apps/mobile/src/lib/paste-attachments.ts`**, do the same. Update the 1 import site in `apps/mobile/src/screens/AIAssistantScreen.tsx`.

4. **Verify**:
   ```bash
   pnpm typecheck
   pnpm --filter web test  # if web tests are wired up (they're not yet — see Step 4)
   ```

5. **Commit**:
   ```bash
   git add packages/shared/src/ai/paste-attachments.ts apps/web/src/lib/ai/pasted-attachments.ts apps/mobile/src/lib/paste-attachments.ts
   git commit -m "refactor(shared): merge Smart Paste Canvas helper into packages/shared

   ~186 LOC of duplicated TypeScript → ~110 LOC in one shared module.
   Reconciles byte-vs-char size formatting via TextEncoder auto-detect
   (Hermes-safe). Preserves mobile-only extractInserted via named export."
   ```

---

## Step 3 — Add regression tests (15 min)

1. **Create `packages/shared/vitest.config.ts`** mirroring `apps/web/vitest.config.ts` style. Vitest workspace config in root `vitest.config.ts` (if present) may need a single-line addition to register `packages/shared`.

2. **Create `packages/shared/src/types/desktop-bridge.test.ts`** with one snapshot test asserting `Object.keys(masarxDesktopApi)` matches an expected channel list. Add the test method (`bridge.updates.onInstallProgress`) as the SC-002 fixture.

3. **Create `packages/shared/src/ai/paste-attachments.test.ts`** with the 6+ tests listed in `contracts/paste-attachments.md` §"Test coverage requirements". Use `vi.fn()` for the mobile-only `extractInserted` cases.

4. **Verify**:
   ```bash
   pnpm --filter shared test  # or: pnpm test
   ```
   All tests pass, ≥80% line coverage on the shared modules.

5. **Commit**:
   ```bash
   git add packages/shared/vitest.config.ts packages/shared/src/types/desktop-bridge.test.ts packages/shared/src/ai/paste-attachments.test.ts
   git commit -m "test(shared): regression tests for desktop-bridge and paste-attachments

   Closes the drift class by failing the build if preload's api literal
   or the shared paste-attachments helpers diverge from spec."
   ```

---

## Step 4 — Delete the 20 dead exports (10 min)

1. **Pre-flight grep** (must return zero hits for each):
   ```bash
   rg -l 'ValidatedCourse|ValidatedCourseWithInstructor|ValidatedNews|ValidatedProfile|ValidatedQuiz|Waitlist' apps/ packages/ --type ts --type tsx
   ```

2. **Open `packages/shared/src/types/schemas/index.ts`** and remove the unused exports. Open `database.ts` likewise.

3. **Verify**:
   ```bash
   pnpm typecheck
   ```
   Expect zero errors (the grep step guaranteed no live references).

4. **Commit**:
   ```bash
   git add packages/shared/src/types/schemas/
   git commit -m "chore(shared): delete unused Validated* and Waitlist* exports

   20 symbols generated for spec 018 and never wired. Frees the
   schema namespace for the new bridge type added in step 1."
   ```

---

## Step 5 — End-to-end verification

```bash
pnpm typecheck                # zero new errors
pnpm test                     # all unit tests pass
pnpm --filter web build       # web build succeeds
pnpm --filter web lint        # web lint clean
pnpm --filter desktop build   # desktop build succeeds (electron-builder dry-run if no signing)
```

Expected outputs:
- `pnpm typecheck`: exit 0, zero diagnostics (vs the baseline before this spec)
- `pnpm test`: ≥7 new tests pass (6 paste-attachments + 1 bridge snapshot)
- Web build: same artifact size as before (refactor is zero-net-byte)
- Desktop build: same artifact size as before

---

## Step 6 — Open a PR

```bash
git push origin 015-consolidate-shared-abstractions
gh pr create --base main --title "refactor(015): consolidate cross-surface abstractions" --body-file specs/015-consolidate-shared-abstractions/quickstart.md
```

**Reviewers** (per spec checklist Notes section):
- web agent (primary owner of `apps/web/**` + `packages/shared/**`)
- desktop agent (reviewer for the IPC contract handshake — `apps/desktop/src/main/preload.ts` changes)

---

## Rollback

All four commits are independent and revertable individually:
- Step 1 rollback: `git revert <sha>` — restores the inline `api` literal; runtime.ts redeclaration comes back
- Step 2 rollback: restores web/mobile local copies
- Step 3 rollback: removes the new tests (no behaviour change)
- Step 4 rollback: restores the 20 unused exports (they were dead anyway, so this is a no-op at runtime)

A `git revert` of all four in reverse order returns the repo to its pre-spec state.

---

## Troubleshooting

**Symptom: `pnpm typecheck` fails with "Cannot find module '@shared/types/desktop-bridge'"**

Fix: check `packages/shared/package.json` `exports` map includes `./types/*` and `./ai/*`. If not, add them.

**Symptom: Hermes crashes on `TextEncoder` after the merge**

Fix: confirm `hasTextEncoder` detection is at module load (top of file), not inside `buildAttachment`. The detection pattern must short-circuit before any `new TextEncoder(...)` call.

**Symptom: Web build size increased**

This should not happen — dead-code elimination in Turbopack drops unused named exports. If it does, check that `extractInserted` is only imported by mobile (grep for the import).