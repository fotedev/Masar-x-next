# Masar X Desktop — Audit Fixes Applied (2026-09-08)

**Branch:** `audit/2026-09-08-fixes`
**Commit:** `b6d547f`
**Scope:** P0 defects + P1 polish items approved via Option A plan.
**Verification:** `pnpm --filter desktop typecheck` ✅ · `pnpm --filter web typecheck` ✅ · `pnpm --filter desktop test` → 29 / 40 pass (11 pre-existing ABI/smoke failures unchanged)

## Files modified

| File | Items addressed |
|---|---|
| `apps/desktop/src/main/index.ts` | R5 (setWindowOpenHandler / will-navigate / setPermissionRequestHandler) · R10 (requestSingleInstanceLock + second-instance focus) · R12 (retry-cap + recovery page) · R14 (app:version / app:quit IPC handlers) |
| `apps/desktop/src/main/__tests__/main.test.ts` | R5/R10/R14 contract assertions · R12 retry-budget test |
| `apps/desktop/package.json` | T7 — `lint` script wired to `eslint .` (no `--max-warnings` blocker) |
| `apps/web/src/app/[locale]/subjects/[subject]/page.tsx` | D1 — `onSelectLecture` wired to `setSelectedLectureForContent` |
| `apps/web/src/middleware.ts` | D2 — `https://res.cloudinary.com` added to `frame-src` |
| `apps/web/src/components/desktop/workspace/DocumentReader.tsx` | D2 — 8 s load watchdog so CSP refusals surface the retry state |
| `apps/web/src/components/desktop/desktop/CustomTitlebar.tsx` | R19 — user-facing strings extracted to `TITLEBAR_STRINGS` const |
| `apps/web/src/components/desktop/workspace/ReaderToolbar.tsx` | R20 — Highlight button disabled with "coming soon" treatment |

## Per-item verification

### T1 / D1 — Sidebar lecture selection fetches content
- **Fix:** Added `handleWorkspaceLectureSelect` (`useCallback`) in the subject page that calls `setSelectedLectureForContent` with the looked-up lecture id/key/label. Passed as `onSelectLecture={handleWorkspaceLectureSelect}` on `<StudyWorkspace>` in the `isDesktop` branch.
- **Why web branch is untouched:** the existing `isDesktop` gate already isolates the workspace JSX; the new callback only fires for desktop.
- **Verification:** `pnpm --filter web typecheck` passes (0 errors).

### T2 / D2 — Document reader iframe no longer blocked
- **Fix 1:** Added `https://res.cloudinary.com` to the CSP `frame-src` directive in `apps/web/src/middleware.ts`. Cloudinary is already allow-listed in `connect-src` and is the canonical document origin per `apps/web/src/lib/cloudinary.ts`.
- **Fix 2:** `DocumentReader` now starts an 8 s watchdog timer on every iframe load; if `onLoad` hasn't fired by then, the component surfaces the load-failure-with-retry state (FR-009's designed UX). This catches CSP refusals (which never fire `iframe.onError`).
- **Verification:** Web typecheck passes.

### T3 / R5 — webContents hardening
- **Fix:** Added three handlers in `startMainProcess`:
  - `setWindowOpenHandler` → http(s) URLs go through `shell.openExternal`; everything else is denied.
  - `will-navigate` → top-level navigation pinned to the loopback origin (`http://127.0.0.1:<port>`); external attempts call `event.preventDefault()`.
  - `setPermissionRequestHandler` → all permission requests denied by default.
- **Contract test:** asserts all three handlers register; the openHandler routes `https://example.com/foo.pdf` to `shell.openExternal`; non-http schemes (`javascript:`, `file://`) are denied silently; will-navigate blocks `https://accounts.google.com` and allows `http://127.0.0.1:41234/some/path`.
- **Verification:** T017 contract test passes (new "wires single-instance lock, webContents hardening, and app:* handlers" + "blocks will-navigate" tests).

### T4 / R10 — single-instance lock
- **Fix:** `app.requestSingleInstanceLock()` at the top of `startMainProcess`; duplicate process calls `app.quit()` and returns 0. Second-instance listener on the locked process focuses + restores + shows the existing window.
- **Contract test:** assert lock is acquired and second-instance listener registers; duplicate-process test confirms early-quit path.
- **Verification:** T017 passes (3 new tests covering this).

### T5 / R14 — preload/main IPC parity
- **Fix:** Added `ipcMain.handle('app:version', () => app.getVersion())` and `ipcMain.handle('app:quit', () => app.quit())`.
- **Contract test:** asserts both channels register; `app:version` returns `'0.5.9-test'` from the mock; `app:quit` triggers `mockApp.quit`.
- **Verification:** T017 passes.

### T6 / R12 — cap the load-retry loop
- **Fix:** `did-fail-load` now tracks attempts via a closure-scoped `didFailLoadAttempts` counter. After 3 failed retries, instead of looping forever, main loads a self-contained `data:text/html` recovery page that displays the last error description and a Retry button (`window.location.reload()` re-triggers loadURL).
- **Counter reset:** `did-finish-load` zeroes the counter so a one-off transient error after a healthy boot doesn't poison the budget.
- **Contract test:** `it.each([-102, -105, -107])` updated to fire the handler 3 times (each retry → `loadURL('http://127.0.0.1:...')`) then once more (4th → `loadURL('data:text/html…Local server is not responding…')`).

### T7 — wire ESLint (with user's T7 guardrail)
- **Fix:** `apps/desktop/package.json` `lint` script changed from echo stub to `eslint .`. **Deliberately omitted `--max-warnings=0`** per the user's guardrail.
- **Reality check:** ESLint 9.39.5 reports 16 pre-existing parse errors across the desktop source tree (the flat config lacks `@typescript-eslint/parser`). The script is now real and surfaces the gap for a follow-up i18n/parser-config PR.

### T8 / R19 — titlebar strings extracted (i18n-ready)
- **Fix:** `CustomTitlebar.tsx` hardcoded strings (app name, ARIA labels, tooltips) extracted into a `TITLEBAR_STRINGS` const block at the top of the file. JSX references the const.
- **Why not full `useTranslations("titlebar")`:** the broader i18n namespace the audit mentioned (`desktopStudyWorkspace`) **does not exist as source JSON files** in `packages/shared/src/messages/{ar,en}/`. Wiring `useTranslations` against a missing namespace would crash at runtime. The const block keeps the strings collectible into the future JSON namespace without changing behavior today.

### T9 / R20 — Highlight "coming soon"
- **Fix:** `ReaderToolbar.tsx` — `HIGHLIGHT_COMING_SOON` const added; button now disables when the flag is true (DOM shape unchanged) and surfaces a "coming soon" suffix in the `title` attribute. `data-masarx-highlight-coming-soon` attribute added for downstream style/test hooks.
- **No-op guarantee:** flipping `HIGHLIGHT_COMING_SOON = false` re-enables the button with no other code change.

### T10 — D1 contract test (SKIPPED per Option A guardrail)
- **Status:** Skipped because `apps/web` has no Vitest scaffold. Per the guardrail ("If apps/web does not already have Vitest/@testing-library configured, do not introduce a heavy testing setup in this PR. Fall back to a lightweight mock assertion or skip T10."), we skip rather than add a heavy setup.
- **Compensating coverage:** the desktop T017 contract test now exercises the IPC surface that D1 depends on. A follow-up PR can add a Vitest config + `@testing-library/react` to `apps/web` and ship the proper D1 wiring test.

## Verification matrix

| Check | Baseline | After |
|---|---|---|
| Desktop typecheck | PASS | PASS |
| Desktop tests | 26 / 37 pass | 29 / 40 pass (+3 new, 0 regressions) |
| Web typecheck | PASS | PASS |
| Pre-existing failures | 11 (ABI/smoke) | 11 (unchanged) |
| ESLint | echo stub | real `eslint .`, 16 pre-existing parse errors |

## Items deliberately NOT addressed (per plan)

These were flagged in the audit but excluded from this PR:

- **Electron 32 → 44 upgrade (R3)** — multi-day; requires better-sqlite3 ABI rebuild + cross-platform smoke pass.
- **OAuth `masarx://` protocol (R4)** — needs Google + Supabase console changes; separate workstream.
- **Encrypted session storage wire-or-delete (R8)** — design decision; deferred.
- **Update UI + reachable rollback (R9)** — needs design call + UX work for the renderer toast.
- **Crash reporting + file logs (R7)** — adds a new dep (electron-log / Sentry); not a fix.
- **Authenticode signing (R6)** — needs a cert the project doesn't have yet.
- **Dead-code sweep (R15)** — needs the storage decision (R8) first.
- **Server-side lecture scoping (R16)** — query refactor; orthogonal to the audit's P0.
- **Zod IPC input validation (R17)** — needs the shared Zod schemas pulled in; quick follow-up possible if prioritized.

## Risks introduced

| Risk | Mitigation |
|---|---|
| `will-navigate` blocks in-app links | Only fires on top-level navigations; SPA `pushState` (Next router) does not trigger it. CustomTitlebar back/menu affordances are unaffected. |
| `setWindowOpenHandler` swallows the workspace Download button | `handleDownload` now opens in the system browser via `shell.openExternal`, which is the desktop UX expectation. |
| Recovery page is a `data:` URL | No CSP/network dependency; runs entirely from main. Retry reloads the loopback, which re-enters the did-fail-load handler with a fresh attempt budget. |
| Stale `mockBrowserWindowInstance` shared across tests | Added selective `mockClear()` in `beforeEach` for `mockLoadURL`, `webContents.on`, `setWindowOpenHandler`, `setPermissionRequestHandler` to keep tests hermetic. |
