# Contract: Desktop Bridge — Window Controls (spec 005 US3)

**Parties**: `apps/desktop/src/main/preload.ts` (producer, via `contextBridge`) ↔
`apps/web/src/lib/desktop/runtime.ts` (consumer type) ↔ `apps/web/src/components/desktop/CustomTitlebar.tsx` (caller).
**Versioned by**: this file. Change any signature here *and* in both code locations in the same commit.
**Degradation rule (FR-012)**: the whole `window` namespace is **optional** on the consumer type —
an older shell without it must yield a usable, no-op-safe titlebar, never a crash.

## Detection

```ts
// Producer installs (Electron only):
window.masarxDesktop = { app, auth, cache, updates, window /* spec 005 */ }
// Consumer probe (SSR-safe; false on server and in browsers):
isDesktopRuntime(): boolean          // true iff window.masarxDesktop exists
getDesktopBridge(): MasarxDesktopRuntimeBridge | null
```

`auth` / `cache` / `app` / `updates` namespaces pre-date this feature and are out of scope here.

## `window` namespace (this feature)

| Member | Signature | Main-process channel | Semantics |
|---|---|---|---|
| `minimize` | `(): Promise<void>` | `window:minimize` (`ipcMain.handle`) | minimize the window |
| `toggleMaximize` | `(): Promise<boolean>` | `window:toggleMaximize` | toggle max/restore; resolves to the **new** maximized state |
| `close` | `(): Promise<void>` | `window:close` | close the window |
| `isMaximized` | `(): Promise<boolean>` | `window:isMaximized` | current state, for initial render |
| `onMaximizeChange` | `(cb: (isMaximized: boolean) => void) => () => void` | `window:maximizeStateChanged` (event) | broadcast on the window's own `maximize`/`unmaximize` so the control reflects out-of-band state changes (FR-023); returns a synchronous unsubscribe handle for effect cleanup |

All invokes return promises; callers must tolerate rejection (no-op-safe path when the bridge
lacks the namespace). The unsubscribe handle must be callable synchronously.

## Invariants (asserted by tests)

1. **T017 contract**: adding the namespace MUST NOT disturb the secure `webPreferences` —
   `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` (`apps/desktop/src/main/__tests__/main.test.ts`).
2. **T043 contract**: the four `handle` registrations + the maximize broadcast exist; covered by
   3 dedicated tests (frameless options, IPC registration, maximize broadcast).
3. The renderer never receives anything beyond these functions — no `ipcRenderer` leakage, no
   Node primitives across the bridge (constitution I / platform boundary IV).
