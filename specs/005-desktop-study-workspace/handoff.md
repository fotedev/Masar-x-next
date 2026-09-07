# Handoff — `005-desktop-study-workspace` (Updated after T024)

**Repo:** `C:\programming\WEB_Development\projects\masarx_next`
**Feature dir:** `specs/005-desktop-study-workspace/` (`spec.md`, `tasks.md`, `checklists/requirements.md`)
**Active Typecheck Status:** `tsc --noEmit` on `apps/web/tsconfig.json` → **PASS (exit 0, 0 errors, 0 stderr bytes)** — verified this session.

---

### Ground Truth (Verified on Disk)

| Task | Status | Path / Note |
| --- | --- | --- |
| T001 `runtime.ts` | Done | `apps/web/src/lib/desktop/runtime.ts` |
| T002 `useIsDesktopRuntime.ts` | Done | `apps/web/src/lib/desktop/useIsDesktopRuntime.ts` (path is `lib/desktop/`, NOT `hooks/desktop/`) |
| T020 `desktop-shell.css` | Done | defines `--masarx-titlebar-h: 32px`; drag classes `masarx-titlebar` / `masarx-titlebar-nodrag` |
| T021 import from `index.css` | Done | pre-existing `@import "./styles/desktop-shell.css"` at top of `index.css` |
| T022 `DesktopShellGate.tsx` | Done | mounts `data-masarx-desktop="true"`, suppresses `contextmenu` (FR-010, FR-016) |
| T023 mount in AppProviders | Done | `<DesktopShellGate />` + `<CustomTitlebar />` in `apps/web/src/components/AppProviders.tsx` (path is `components/AppProviders.tsx`, NOT `app/[locale]/AppProviders.tsx`) |
| **T044 `CustomTitlebar.tsx`** | **Done (this session)** | `apps/web/src/components/desktop/CustomTitlebar.tsx` — three window buttons, RTL-aware (`pe-1`), drag regions wired via CSS classes, safe-degradation when `window.masarxDesktop.window` is absent (T040 not landed yet) |
| **T024 gate Footer/PWA in Layout** | **Done (this session)** | `apps/web/src/components/Layout.tsx` gates `<Footer />`, `<PWAInstallPrompt />`, `<NotificationPrompt />` with `!isDesktop`. SSR HTML byte-equal to the browser version (FR-011) |
| T025 visual gate | Pending | requires running Electron or `pnpm dev` to confirm visually |
| T033 `AGENTS.md` patch | Blocked | write-protected; ask explicitly before retrying |
| T034 verify port-clear | Pending | — |
| US1 T010–T016 StudyWorkspace | Not Started | `apps/web/src/components/desktop/workspace/` does not exist |
| US3 T040–T043 Electron IPC/preload/main window controls | Not Started | `apps/desktop/src/main/preload.ts` exposes `masarxDesktop.{auth,cache,app,updates}` but **no `window` namespace yet** — `CustomTitlebar` degrades gracefully until then. Main-process handlers live in `apps/desktop/src/main/index.ts` (not `main/server.ts`) |
| Phase 6 T050–T053 | Not Started | no `verification.md` |

---

### Verified Toolchain Workarounds

```bash
# Typecheck gate command (verified this session, exit=0):
cd "C:/programming/WEB_Development/projects/masarx_next/apps/web" \
  && ../../node_modules/typescript/bin/tsc --noEmit

# Result: exit 0, 0 errors, 0 stderr bytes.
# `corepack pnpm` exists on disk (pnpm.cjs is at
#   C:/Users/FOTE/AppData/Local/node/corepack/v1/pnpm/9.15.4/bin/pnpm.cjs),
# but invoking `pnpm` through git-bash fails (corepack wrapper path resolution).
# Workarounds that don't trust `pnpm`:
#   - Direct `tsc --noEmit` on the monorepo install (used above) — REAL gate.
#   - `npm exec -- pnpm --filter web typecheck` returns exit 0 but stdout is empty (unverified).
```

---

### Next-Session Priorities

1. **US1 (T010–T016):** create `apps/web/src/components/desktop/workspace/` with three panes plus the wrapper:
   - `WorkspaceSidebar.tsx` — lectures + summaries list, scroll-isolated
   - `WorkspaceReader.tsx` — PDF/text reader with toolbar
   - `WorkspaceChat.tsx` — Zane assistant side-by-side
   - `StudyWorkspace.tsx` — the three-column composer

   Reuse existing hooks: `useLectureContent`, `ContentItem`, `useAiChat` (Zane on `ai-assistant/page.tsx`).

2. **Route wire-up:** mount `StudyWorkspace` from `apps/web/src/app/[locale]/subjects/[subject]/page.tsx` (and its lecture subroute, which currently re-exports the subject page).

3. **Typecheck after each batch:** run the verified `tsc --noEmit` command above.

4. **Then US3 (T040–T043):** add `window: { minimize, maximize, close, isMaximized, onMaximizeChange }` namespace to `apps/desktop/src/main/preload.ts` (under `masarxDesktop`) + matching `ipcMain.handle` in `apps/desktop/src/main/index.ts` (NOT `main/server.ts` — server.ts is the Next.js dev server only), plus the spec'd tests. Until they land, `CustomTitlebar` buttons remain no-ops (intentional, by design).

5. **Then T025 visual gate + T050–T053 Phase 6 + `verification.md`.**

---

**Out of scope (do not invent):** command palette, tray icon, native notifications, in-house PDF annotator, AGENTS.md changes.
