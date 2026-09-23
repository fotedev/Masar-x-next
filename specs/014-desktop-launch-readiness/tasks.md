# Tasks: 014 — Desktop launch readiness

**Input:** `specs/014-desktop-launch-readiness/spec.md`

## Verification gates (every task)

```bash
PNPM="node C:/Users/FOTE/AppData/Local/node/corepack/v1/pnpm/9.15.4/bin/pnpm.cjs"
```

- GATE-TYPE-DESKTOP: `$PNPM --filter desktop typecheck` → 0 errors
- GATE-TYPE-WEB: `$PNPM --filter web typecheck` → 0 errors
- GATE-TEST-DESKTOP: `$PNPM --filter desktop test` → all pass
- GATE-PACK: `$PNPM --filter desktop exec electron-builder --dir` after `$PNPM --filter web build` → `out/win-unpacked/Masar X.exe` launches (visual check recorded per FR-027)

## Phase 1 — Dead-dep removal (C1)

- [x] R010 Remove `better-sqlite3` + `masarx-shared` from `apps/desktop/package.json`; remove `asarUnpack` from `electron-builder.yml`; remove `electron-builder install-app-deps` step from `.github/workflows/release.yml`; remove `better-sqlite3` from root `pnpm.neverBuiltDependencies`.
- [x] R011 Fix stale comments: `src/main/index.ts:66–71` (deleted `auth:*`/LocalAuthSession block), `src/main/__tests__/main.test.ts:98–103` (deleted `menu.js` refs).
- [x] R012 Gates: `pnpm install`, GATE-TYPE-DESKTOP, GATE-TEST-DESKTOP, GATE-PACK + launch.

## Phase 2 — Electron 32.2.0 → 44.x (C2)

- [x] R020 Resolve latest stable 44.x exact; pin in `apps/desktop/package.json` (I6). Bump `electron-builder` only if packing fails.
- [x] R021 Triage API drift against installed typings; fix compile fallout (`will-navigate` → `will-frame-navigate` only if actually removed).
- [x] R022 Gates: GATE-TYPE ×2, GATE-TEST-DESKTOP, web build, GATE-PACK + packaged launch (titlebar + workspace), local smoke `MASARX_RUN_SMOKE=1`.

## Phase 3 — `masarx://` deep link (C3–C5)

- [x] R030 Create `src/main/deepLink.ts` with `parseDeepLinkUrl(argv): string | null` + unit tests (extraction, non-masarx args, wrong path/host rejection).
- [x] R031 `index.ts`: `setAsDefaultProtocolClient('masarx')` (dev-aware), cold-start argv scan, `second-instance` argv parsing + focus + forward, `open-url` (mac), pending-buffer flushed on `did-finish-load`, forward via `auth:deepLink` IPC.
- [x] R032 `preload.ts`: `auth.onDeepLink(cb): () => void` (+ `app.openExternal(url)` handler in `index.ts`); preload CJS guard stays green.
- [x] R033 `apps/web/src/lib/desktop/runtime.ts`: extend bridge contract with optional `auth.onDeepLink` + `app.openExternal`.
- [x] R034 `AuthContext.tsx`: desktop branch in `signInWithGoogle` (`redirectTo:'masarx://auth/callback'`, `skipBrowserRedirect:true`, PKCE default) + `app.openExternal`; browser path unchanged byte-for-byte.
- [x] R035 `AuthContext` desktop effect: `onDeepLink` → renderer-side URL re-validation → `exchangeCodeForSession(code)`; errors console-only (no new user-facing strings).
- [x] R036 `build/installer.nsh`: implement HKCU `masarx` URL-protocol registration/unregistration; remove placeholder comment.
- [x] R037 Extend `main.test.ts`: cold-start forward + queue flush, second-instance forward + focus, `open-url` forward, `app:openExternal` handler. T017 assertions unchanged.
- [x] R038 Gates: GATE-TYPE ×2, GATE-TEST-DESKTOP, web build, GATE-PACK + launch.

## Phase 4 — Docs, owner register, release prep (C6–C7)

- [x] R040 `docs/desktop-readiness.md`: Supabase redirect allow-list (`masarx://auth/callback`), Authenticode cert + `CSC_LINK` wiring, SmartScreen caveat copy, mac/linux Windows-only-by-design note.
- [x] R041 Sync `docs/agents/references/02-release-pipeline.md` (drop better-sqlite3/install-app-deps, note protocol).
- [x] R042 CHANGELOG: retro `[0.5.9]` + new `[0.6.0]`.
- [ ] R043 Bump `apps/desktop/package.json` + root `package.json` to 0.6.0. **STOP before tag** — hand `git tag v0.6.0 && git push origin v0.6.0` to the owner.
- [ ] R044 Update spec-completion dashboard + memory ledger.
