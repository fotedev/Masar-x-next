# Contract: `MasarxDesktopBridge` IPC Surface

**Generated**: 2026-09-28
**Phase**: 1
**Branch**: `015-consolidate-shared-abstractions`
**Source of truth (after refactor)**: `packages/shared/src/types/desktop-bridge.ts`

This is the Electron preload bridge that web's renderer calls. The contract is enforced by the TypeScript compiler after the refactor; before, it was a hand-maintained interface in `runtime.ts` that drifted.

---

## Transport

- **Channel**: `window.masarxDesktop` (exposed via `contextBridge.exposeInMainWorld` in preload)
- **Wire format**: synchronous JS calls (Electron IPC under the hood; renderer-facing is a plain function call)
- **Security boundary**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` (set in `apps/desktop/src/main/index.ts`)
- **Failure mode**: returns rejected Promise on the main-process `ipcMain.handle` error path; renderer catches and surfaces to user via toast

---

## Method groups

### `auth` — authentication session management

| Method | Signature | Returns |
|---|---|---|
| `signIn` | `(email: string, password: string) => Promise<{ ok: true; user: SessionUser } \| { ok: false; error: string }>` | Promise resolving to a discriminated union |
| `signOut` | `() => Promise<void>` | Promise resolving when local + Supabase session cleared |
| `getSession` | `() => Promise<SessionUser \| null>` | Current local-cached session, or null |
| `onAuthChange` | `(cb: (user: SessionUser \| null) => void) => () => void` | Subscribe to auth changes; returns unsubscribe function |

**Example**:
```typescript
const result = await window.masarxDesktop.auth.signIn('[email protected]', 'pw');
if (!result.ok) toast.error(result.error);
```

### `session` — local persistence (key/value)

| Method | Signature | Returns |
|---|---|---|
| `getLocal` | `(key: string) => Promise<string \| null>` | Stored value or null |
| `setLocal` | `(key: string, value: string) => Promise<void>` | Resolves when written |
| `clear` | `() => Promise<void>` | Resolves when all local keys removed |

**Example**:
```typescript
await window.masarxDesktop.session.setLocal('locale', 'ar');
const locale = await window.masarxDesktop.session.getLocal('locale');
```

### `profile` — user profile access

| Method | Signature | Returns |
|---|---|---|
| `getCurrent` | `() => Promise<Profile \| null>` | Current profile (server-fetched) |
| `upsert` | `(profile: Partial<Profile>) => Promise<Profile>` | Returns updated profile |
| `onUpdate` | `(cb: (profile: Profile) => void) => () => void` | Subscribe to profile changes |

### `updates` — auto-update lifecycle

| Method | Signature | Returns |
|---|---|---|
| `checkFor` | `() => Promise<UpdateInfo \| null>` | Available update or null |
| `downloadAndInstall` | `() => Promise<{ ok: true } \| { ok: false; error: string }>` | Discriminated union |
| `onError` | `(cb: (err: Error) => void) => () => void` | Subscribe to update errors |
| `onProgress` | `(cb: (pct: number) => void) => () => void` | Subscribe to download progress (0-100) |
| `onInstallProgress` | `(cb: (stage: 'extracting' \| 'replacing' \| 'restarting') => void) => () => void` | **NEW** — added in the regression-test fixture (US1) |

**Note on `onInstallProgress`**: this method does not exist in production today. It's added to the shared type literal during implementation as the SC-002 fixture ("Adding a new IPC channel requires editing exactly one TypeScript file"). Production preload will export it as a no-op stub initially; a follow-up task can fill in the real implementation.

### `server` — bundled Next.js server lifecycle

| Method | Signature | Returns |
|---|---|---|
| `getPort` | `() => Promise<number>` | Free port the standalone Next server is bound to |
| `getRecoveryPageUrl` | `() => Promise<string>` | URL of the static recovery page (used on `did-fail-load`) |
| `restart` | `() => Promise<void>` | Kill and respawn the bundled server process |

---

## Error envelope (applies to all Promise-returning methods)

```typescript
type BridgeError =
  | { code: 'IPC_HANDLER_NOT_REGISTERED'; message: string }
  | { code: 'IPC_TIMEOUT'; message: string }
  | { code: 'IPC_PERMISSION_DENIED'; message: string }
  | { code: 'IPC_INTERNAL'; message: string; cause?: unknown };
```

Methods that return discriminated unions (`signIn`, `downloadAndInstall`) use `{ ok: false; error: string }` instead. The bridge does **not** re-throw raw `ipcMain` errors to the renderer.

---

## Contract enforcement (after refactor)

| Check | Mechanism | Test |
|---|---|---|
| Shape parity (preload's `api` literal ↔ shared `MasarxDesktopBridge` type) | TypeScript compile + snapshot test on `Object.keys(api)` vs `keyof MasarxDesktopBridge` | `packages/shared/src/types/desktop-bridge.test.ts` |
| No drift on the renderer side (`runtime.ts` ↔ `MasarxDesktopBridge`) | `runtime.ts` becomes a 1-line re-export | `pnpm typecheck` |
| Wire-format stability | Existing E2E tests (`apps/web/tests/e2e/`) cover `signIn`, `setLocal`, `getPort` | Re-run existing Playwright specs — no changes needed |

---

## What this contract is NOT

- **Not a GraphQL schema** — IPC is a method-call surface, not a query surface.
- **Not versioned at the protocol level** — Electron's IPC is in-process; breaking changes are caught at compile time, not runtime.
- **Not exposed to mobile** — `apps/mobile/` does not consume this bridge; it has its own React Native bridge.