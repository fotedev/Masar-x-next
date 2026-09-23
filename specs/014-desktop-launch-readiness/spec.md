# Spec 014 — Desktop launch readiness (Electron 44, `masarx://` OAuth, dead-dep removal)

**Status:** DRAFT 2026-09-23 — awaiting owner approval (I11)
**Input:** Owner directive "make desktop ready" (2026-09-23); `docs/MVP_REPORT.md` post-MVP queue (G5.1 Electron bump, G3.7 signing prep); desktop audit 2026-09-08 items R3/R4/R15; MVP assessment 2026-09-20 deferred ledger.
**MVP-lock:** executes the owner-recorded post-MVP desktop milestone (deployment readiness + login, the two allowed categories; no cosmetic work).
**Scope guard:** Windows-only pipeline stays Windows-only; signing/crash-reporting/mac targets stay documented owner actions (no code).

## 1. Context & problem statement

Desktop v0.5.9 is "shippable, unpolished" (`docs/MVP_REPORT.md`). Three defects stand between it and launch-ready:

1. **Electron 32.2.0 is EOL since 2025-03-04** (audit R3, High). The renderer is Chromium; every student runs an unsupported browser engine inside a login-bearing app. No native modules will remain after §2.1, so the historically painful ABI rebuild reason for staying behind disappears. This also unblocks the Electron Dependabot alert backlog (~63 at last count).
2. **Google sign-in dead-ends in the shell** (audit R4). The renderer is served from `http://127.0.0.1:<random port>` (`port.ts` `findFreePort()`), so `AuthContext.signInWithGoogle` builds `redirectTo: http://127.0.0.1:<port>/ar/auth/callback` — a URL that cannot be allow-listed in Supabase (dynamic port) and would anyway set the session in the *system browser*, not the app. `will-navigate` (`index.ts:255`) correctly reverts any external top-level navigation, so in-shell OAuth cannot work as-is. Only email/password works today.
3. **Dead native weight ships in every installer.** `better-sqlite3 ^11.5.0` has zero imports since `ddb1612` (2026-09-12 deleted the LocalReadCache), yet is still a runtime dependency, `asarUnpack`ed in `electron-builder.yml`, and drives `electron-builder install-app-deps` (Electron-ABI prebuild machinery) in `release.yml`. `masarx-shared` is likewise referenced by nothing under `apps/desktop/src`. Plus stale comments: `index.ts:66–71` describes the deleted `auth:*`/`LocalAuthSession` subsystem; `main.test.ts:98–103` claims `index.ts` imports `./menu.js` (deleted file); `build/installer.nsh` is a placeholder documenting the never-implemented protocol registration.

## 2. Design

### 2.1 Dead-dep removal (atomic commit C1)

- `apps/desktop/package.json`: remove `better-sqlite3` and `masarx-shared` from dependencies.
- `apps/desktop/electron-builder.yml`: remove the `asarUnpack: **/better-sqlite3/**` block (sole entry) and its comments; remove stale `masarx-shared` mentions.
- `.github/workflows/release.yml`: remove the `electron-builder install-app-deps` step (existed solely for the better-sqlite3 Electron-ABI prebuild).
- Root `package.json`: remove `better-sqlite3` from `pnpm.neverBuiltDependencies` (verify the list is otherwise empty before removing the field entirely).
- Fix stale comments in `src/main/index.ts` (T021 block) and `src/main/__tests__/main.test.ts` (menu refs).
- `DesktopShell.tsx`/`DesktopSidebar.tsx` stay untouched (sidebar rail is a recorded future milestone, not readiness scope).

### 2.2 Electron 32.2.0 → 44.x (atomic commit C2)

- Pin the latest stable 44.x **exact** (resolve via `npm view electron@44 version` at execution; invariant I6 exact pin). Bump `electron-builder` only if packing against 44 fails.
- Triage our full API surface — all of it stable across 33→44: `BrowserWindow` options (`frame:false`, `titleBarStyle:'hidden'`, `titleBarOverlay:false`, `autoHideMenuBar`, secure `webPreferences` incl. `sandbox:true`), `Menu.setApplicationMenu(null)` + `win.setMenu(null)`, `requestSingleInstanceLock`, `setWindowOpenHandler`, `will-navigate` (if removed in the installed line, switch to its documented replacement `will-frame-navigate` — verify from the installed typings, never from memory), `session.setPermissionRequestHandler`, `ipcMain.handle`, `webContents.send`, `shell.openExternal`, `app.getPath`, electron-updater 6.x (no native modules involved).
- `src/main/__tests__/main.test.ts` mocks electron wholesale; fix type-level fallout only if the installed typings change a mocked signature.
- Gates after bump: GATE-TYPE-DESKTOP/WEB, GATE-TEST-DESKTOP, web build, `electron-builder --dir`, **launch the packaged exe** and verify titlebar + workspace render, then local smoke suite (`MASARX_RUN_SMOKE=1` against compiled `dist/`).

### 2.3 Google login via `masarx://` deep link, PKCE (atomic commits C3–C5)

Flow: renderer opens the Supabase auth URL in the **system browser** → Google consent → Supabase redirects to `masarx://auth/callback?code=…` → OS launches/focuses Masar X → main forwards the URL to the renderer → renderer `exchangeCodeForSession(code)` (PKCE verifier already stored in the renderer's localStorage by `signInWithOAuth`) → existing `onAuthStateChange(SIGNED_IN)` updates the UI.

**Main process (`apps/desktop/src/main/`):**
- New `deepLink.ts` module: `parseDeepLinkUrl(argv: string[]): string | null` — returns the first arg matching `masarx://auth/callback?…` (validate protocol + host `auth` + path `/callback` via `new URL`), else null. Extracted as a pure module so it is unit-testable (repo lesson: every parser gets a real test).
- `index.ts`: `setAsDefaultProtocolClient('masarx')` (dev-unpackaged registers against `process.execPath` so `pnpm dev` participates; packaged registration also lands via NSIS §2.5). Cold start: after window creation, scan `process.argv`; warm start: `second-instance` handler now parses `(event, argv)` — parse deep link, restore/focus window, forward; macOS parity: `open-url` event → forward.
- Forwarding with a load race guard: if the renderer is not yet loaded, buffer the URL in a `pendingDeepLink` slot; flush once on `did-finish-load`. Forward = `win.webContents.send('auth:deepLink', url)`.

**Preload (`preload.ts`):** new `auth` namespace: `onDeepLink(cb: (url: string) => void): () => void`, mirroring the `onMaximizeChange` subscription pattern. Preload stays CommonJS (`preload-build.test.ts` guard must keep passing).

**Web (`apps/web/src/`):**
- `lib/desktop/runtime.ts`: extend the bridge contract with optional `auth.onDeepLink` and `app.openExternal(url)`.
- `contexts/AuthContext.tsx` `signInWithGoogle`: when `isDesktopRuntime()` (runtime-gated inside the handler, never in render — hydration-safe), call `signInWithOAuth({ provider:'google', options:{ redirectTo:'masarx://auth/callback', skipBrowserRedirect:true, queryParams:{ access_type:'offline', prompt:'consent' } } })`, then `getDesktopBridge()?.app.openExternal(data.url)`. Browser path byte-identical to today.
- `AuthContext` effect (desktop only): subscribe `auth.onDeepLink`; re-validate the URL in the renderer too (protocol/host/path — defense in depth; the raw IPC payload is an untrusted string since any web page can invoke `masarx://` from a browser); `exchangeCodeForSession(code)`; errors log to console only (user retries via the existing Google button — **no new user-facing strings, I3 clean**); success flows through the existing `onAuthStateChange` so zero new UI.

**NSIS (`build/installer.nsh`):** implement the T019.1 prescription — `customInstall` writes `HKCU\Software\Classes\masarx` (`"URL Protocol"=""` + `shell\open\command` = `"$INSTDIR\Masar X.exe" "%1"` — resolve the exact electron-builder define for the executable filename at execution and keep the documented `${PRODUCT_FILENAME}` form if it resolves), `customUnInstall` deletes the key. HKCU (perMachine:false).

**Tests:** unit tests for `parseDeepLinkUrl` (extraction, non-masarx args, wrong path rejection); extend `main.test.ts`: cold-start forward + pending-queue flush on load, `second-instance` argv forward + focus, `open-url` forward, `app:openExternal` handler registration. Contract test T017 assertions (secure webPreferences, loadURL, named export) unchanged.

**Security rationale:** the code in the deep link is useless without the locally-stored PKCE verifier (never leaves the device), and a forged `masarx://` callback without a valid code is ignored — accepted residual risk, documented.

**Owner dependency (blocking full E2E):** Supabase Auth → URL Configuration must allow-list `masarx://auth/callback`. Until the owner adds it, clicking Google in the shell opens the browser and ends on Supabase's redirect error page — expected pre-config behavior, documented in the owner register. Email/password and web Google OAuth are unaffected.

### 2.4 Owner-action register + docs (atomic commit C6)

New `docs/desktop-readiness.md`: (1) Supabase redirect allow-list value `masarx://auth/callback` (action #1); (2) Authenticode/EV cert purchase + `CSC_LINK`/`CSC_KEY_PASSWORD` env wiring (the commented `electron-builder.yml` block is already shaped for it) + `publisherName`; (3) SmartScreen caveat copy for students until signed; (4) mac/linux targets remain unbuilt by design (Windows-only pipeline; `entitlements.mac.plist` deliberately absent). Sync `docs/agents/references/02-release-pipeline.md` (drop install-app-deps/better-sqlite3 mentions, note the protocol). CHANGELOG: retro `[0.5.9]` entry (missing) + `[0.6.0]`.

## 3. Behavior preservation & regression strategy

- Browser rendering is untouched: every change is behind `isDesktopRuntime()` (event-handler-time, hydration-safe) or desktop-side files; `desktop-shell.css` remains fully scoped under the marker (FR-011 regression guard re-verified in spec-005 closure).
- The T017 contract suite (secure webPreferences, loadURL, named export, frameless options) must stay green unmodified except where a test documents the new deep-link surface.
- No DB/migration/RLS changes in this spec. No i18n keys added (3-point registration contract stands ready if that changes).
- `will-navigate` / `setWindowOpenHandler` semantics unchanged; the new `openExternal` bridge call is additive.
- Updater, single-instance focus behavior, recovery page: unchanged (second-instance gains deep-link parsing only).

## 4. Test specification

| Gate | Expectation |
|---|---|
| GATE-TYPE-DESKTOP / GATE-TYPE-WEB | 0 errors |
| GATE-TEST-DESKTOP (`pnpm --filter desktop test`) | all pass, incl. new `deepLink` + forward tests, preload CJS guard |
| Web build + `electron-builder --dir` | succeeds; packaged exe launches |
| Packaged visual check (FR-027 discipline) | single 32px titlebar, workspace renders, no native chrome — screenshot/CDP evidence |
| Local smoke (`MASARX_RUN_SMOKE=1`) | port banner, home renders, `/api/ai-assistant` reachable, no fatal stderr |
| OAuth E2E | pre-allow-list: browser opens, ends at Supabase redirect error (documented); post-allow-list (owner): full round-trip signs the shell in — verified with the owner or deferred with evidence |

## 5. Execution plan (atomic commits, per 11-git-standards)

1. C1 `chore(desktop): drop dead better-sqlite3/masarx-shared deps and stale comments`
2. C2 `chore(desktop): upgrade electron 32.2.0 → 44.x`
3. C3 `feat(desktop): masarx:// deep-link parsing and auth bridge`
4. C4 `feat(auth): Google sign-in via masarx:// deep link in desktop shell`
5. C5 `build(desktop): NSIS masarx:// protocol registration`
6. C6 `docs: desktop readiness owner-action register, release pipeline sync, CHANGELOG 0.5.9/0.6.0`
7. C7 `release: bump version to 0.6.0` — **stop before tag** (owner cuts `v0.6.0`).

Spec-005 closure (ledger truth-sync, T050 responsive collapse, T051–T053 `verification.md`) runs as a separate pre-existing approved-spec workstream before C2.
