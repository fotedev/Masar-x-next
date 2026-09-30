# Spec 028 — Desktop Crashpad dumps + file logging (local-only)

**Status:** Approved (owner, 2026-09-29 — plan approval)
**Type:** Feature (owner-directed under MVP Lock — deployment readiness)
**Branch:** feat/028-desktop-crashpad-logs

## Problem

The desktop main process logs only via `console.*` (`[masarx-desktop]` prefix) — invisible in packaged builds — and has no crash reporting at all. Audit R7 (`docs/audits/desktop-app-report-2026-09-08/10-risks-and-debt.md`): "No crash reporting, file logs, or update-failure telemetry — field failures invisible." `docs/desktop-readiness.md` registered this as a deferred owner action. The owner has now decided: **local-only** Crashpad dumps + file logs (remote submission stays a future owner decision).

## Scope

`apps/desktop` main process only:

1. **Crashpad** — `crashReporter.start({ uploadToServer: false })` at boot. Minidumps are kept locally in `userData/crashDumps` (path pinned via `app.setPath('crashDumps', …)` before start). Electron ≥13 on Windows embeds the Crashpad handler in the main executable, so **no packaging change** is needed (`electron-builder.yml` untouched).
2. **File logging** — `electron-log ^5` (imported as `electron-log/main`): file transport at `userData/logs/main.log`, 5 MB size rotation (`.old.log`), `info` level, console transport kept at `info` so the dev terminal output is unchanged in shape. All ~19 `console.*` sites in `src/main/index.ts` + `src/main/updater.ts` move to the logger (scope `masarx-desktop` — messages stay greppable; the eslint `no-console` disables on those lines go away).
3. **Next.js child server output** — `server.ts`'s stdout/stderr pipes (`process.stdout.write('[next-server] …')`) route into the same file under a `next-server` scope (stdout → info, stderr → error). Packaged builds finally record server boot failures.
4. **Process error handlers** — `log.errorHandler.startCatching({ showDialog: false })` (uncaughtException + unhandledRejection → log, no crash dialog), plus app-level `render-process-gone` / `child-process-gone` handlers logging reason + exitCode.
5. **Side effect (accepted)** — `electron-updater` auto-detects electron-log and forwards its own messages to the file.

## Contracts

- **Boot order (diagnostics first, everything else unchanged):** `app.setName('masarx')` (updater.ts module scope, pre-existing) → resolve diagnostics paths from `app.getPath('userData')` → `app.setPath('crashDumps', …)` → `initLogging()` → `crashReporter.start()` → `errorHandler.startCatching()` → `render/child-process-gone` handlers → existing boot (single-instance lock, server, windows). Diagnostics init lives at **module scope of `index.ts`** guarded by the existing `process.versions.electron` check pattern, so it runs in real Electron (including the second-instance path, whose "another instance" warning now lands in the log) and is inert under Vitest/plain Node.
- **Local-only:** `uploadToServer: false`, no `submitURL`, no DSN, no network calls from crash handling. `submitURL` stays out until the owner opens a remote channel.
- **Unconfigured ≠ crash** (mirrors spec 023): file-system logging failures must never take down boot — logging init is wrapped so an unwritable logs dir degrades to console-only.
- **New module** `src/main/logging.ts` owns: path resolution (pure, testable), `initLogging`, `initCrashReporting`, `registerProcessGoneHandlers`, the `next-server` child router, and the shared scoped loggers. `index.ts`/`server.ts`/`updater.ts` import from it; no other new files.
- **Dependency:** `electron-log ^5` added to `apps/desktop` runtime deps (only dep besides `electron-updater`). No build scripts, electron-builder config, or `pnpm-workspace.yaml` changes.

## Non-goals

- No remote submission (Sentry SDK or minidump endpoint) — documented owner decision for later.
- No renderer JS-error capture — the web app's `logger.ts` stays untouched (same guard as spec 023's non-goals); Crashpad still captures true renderer *process* crashes via `render-process-gone` + minidumps.
- No log viewer UI, no log export IPC, no log-retention policy beyond the 5 MB rotation.
- No mac/linux validation (Windows-only pipeline, per spec 014).

## Acceptance

- [x] Gates green: `pnpm --filter desktop typecheck` / `lint` / `test` (existing suites stay green; electron mocks extended, not weakened). *(Re-verified 2026-09-30 on merged main: typecheck + eslint clean, 49/49 unit tests.)*
- [x] `logging.test.ts` covers: path resolution (`logs/`, `crashDumps/` under userData), `crashReporter.start` called with `uploadToServer: false` after `setPath('crashDumps')`, process-gone handlers registered and logging details. *(Verified 2026-09-30 — the suite asserts all of these, including setPath-before-start ordering and the no-`submitURL` local-only contract.)*
- [ ] `logging.test.ts` child-server stdout→info / stderr→error routing assertion — **gap found at closeout 2026-09-30**: the routing is implemented (`src/main/server.ts` pipes via `nextServerLog`) but no test asserts it; every other item of the original box above is covered.
- [x] Smoke suite (real Electron boot) passes with diagnostics wired at module scope. *(Verified 2026-09-30: `MASARX_RUN_SMOKE=1` against a fresh `tsc` build + live dev server — 53/53 including smoke.)*
- [x] Boot log line records both resolved paths (`logs/main.log`, `crashDumps/`) so support can locate artifacts in the field. *(`initDiagnostics` "Diagnostics ready…" line, asserted in `logging.test.ts`.)*
- [x] `docs/desktop-readiness.md` owner-action register updated: crash reporting + file logs implemented locally; remote submission remains an open owner decision. *(Verified 2026-09-30 — R7 entry in the readiness register.)*
