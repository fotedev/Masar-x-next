# 17 — Desktop (Electron) Cold Start & Runtime

> Subagent auditor #17, 2026-11-02. Domain: apps/desktop main-process startup path. Static analysis only — the app was not launched; measurement plan included below.

## Cold-start sequence (traced)

`process start` → `initDiagnostics()` at module scope (index.ts:22-24) → `startMainProcess()` auto-start (index.ts:448-453) → single-instance lock (index.ts:106) → protocol registration (index.ts:160-170) → **`await startLocalServer()` (index.ts:177): findFreePort (port.ts:17) → sidecar write (port.ts:42) → fs.access (server.ts:78) → spawn child via `ELECTRON_RUN_AS_NODE=1` (server.ts:87-107) → fixed 500 ms early-error wait (server.ts:122-144)** → `app.whenReady()` (index.ts:179) → Menu stripped (index.ts:186) → BrowserWindow created + `show: !isDev` (index.ts:197-225) → `loadURL` un-awaited (index.ts:299) → updater boots immediately at ready (index.ts:413-421, updater.ts:420-424).

## Findings

### [DESKTOP-1] Healthy cold start burns a guaranteed 500 ms fixed wait, and server readiness is never actually verified

- **P1 · Impact H · Effort S** — 25% of the ≤2 s budget is consumed by a sleep that does not even guarantee the server is listening; slow machines additionally pay a 0.5 s-per-retry ladder.
- Evidence: `apps/desktop/src/main/server.ts:122-144` — the early-error promise resolves only via `onError`/`onExit`/`setTimeout(…, 500)`; on a healthy boot the timeout is always the path taken ("500ms is generous: … the listener is up in <50ms", server.ts:137-139 — yet nothing polls the port). Readiness is then left to `did-fail-load` retries of `-102` at 500 ms each (index.ts:270-289). (Coordinator spot-check: the 500ms comment block verified verbatim.)
- Current: spawn → sleep 500 ms → create window → first load may still hit ERR_CONNECTION_REFUSED → up to 3 × 500 ms more.
- Fix: replace the blind timeout with a readiness probe (`net.connect` to the chosen port every ~50 ms, resolve as soon as it accepts, cap ~3 s) — or drop the wait entirely and let the existing did-fail-load retry handle the race. Also enables loadURL first-shot.

### [DESKTOP-2] ~185 MB of non-Windows sharp/@img binaries ship inside the packaged standalone tree

- **P1 · Impact H (install extraction, first-run Defender scan of thousands of files, updater download size; indirect child-server cold-start cost) · Effort S**
- Evidence (measured): `apps/web/.next/standalone` = 248 MB, `standalone/node_modules/@img` = 185 MB; dir listing contains `sharp-libvips-darwin-{x64,arm64}` (19.8/17.8 MB), `sharp-libvips-linux-{ppc64,s390x,riscv64,…}` (14.6–19.1 MB each), `sharp-libvips-linuxmusl-*`, `sharp-freebsd-wasm32`, `sharp-wasm32`, `sharp-webcontainers-wasm32` — only `sharp-win32-x64` is needed by the shipped app (and its DLLs are missing — PKG-1). electron-builder copies the whole tree: `apps/desktop/electron-builder.yml` extraResources `from: "../web/.next/standalone" to: "web"` with `filter: ["**/*"]`. Root cause: `sharp` as a direct dep of apps/web (apps/web/package.json:86) + Next file tracing pulling all optional platform packages.
- Fix: add filter excludes in electron-builder.yml (e.g. `- "!node_modules/@img/sharp-*"` for every non-`win32-x64` package, or enumerate) — keeps sharp functional since `images.unoptimized` is false in production (apps/web/next.config.mjs:58-59, so the runtime image optimizer does use sharp). Verify image rendering after trim. Tree drops ~185 MB → ~10-20 MB. (Coordinate with PKG-1/PKG-2 — one config change.)

### [DESKTOP-3] Window creation is fully serialized behind server spawn — nothing visible until ≥500 ms + Next bind

- **P2 · Impact M · Effort M**
- Evidence: `apps/desktop/src/main/index.ts:176-179` — `await startLocalServer(...)` precedes `await app.whenReady()` and window creation (index.ts:197). Comment at index.ts:172-175 states the intent ("by the time the window is created the URL is guaranteed reachable" — see DESKTOP-1: it isn't guaranteed).
- Fix: create the window (or a tiny static splash — data-URL, consistent with the existing recovery-page pattern index.ts:46-68) before/parallel to the server spawn, show on `ready-to-show`, then `loadURL` the real app once ready. User-perceived start drops from ~0.6-1 s+ to ~100 ms.

### [DESKTOP-4] Blank default-background window flashes before first paint (no `backgroundColor`, no `ready-to-show` gate)

- **P2 · Impact M · Effort S**
- Evidence: `apps/desktop/src/main/index.ts:197-225` — BrowserWindow options include neither `backgroundColor` nor a `ready-to-show` listener; `show: !isDev` (index.ts:202) means prod shows the frame immediately at construction, while `loadURL` (index.ts:299) completes asynchronously afterwards. The app's dark shell tone is already defined in-code (`#0b1220`, index.ts:52).
- Fix: add `backgroundColor: '#0b1220'` (one line) and optionally gate `show` on `ready-to-show` in prod.

### [DESKTOP-5] Updater fires its first network check — and auto-downloads the full ~184 MB installer — inside the cold-start window

- **P2 · Impact M · Effort S**
- Evidence: `apps/desktop/src/main/index.ts:413-421` calls `bootUpdater` right after window creation; `apps/desktop/src/main/updater.ts:420-424` runs `checkOnStartup()` immediately because `app.isReady()` is already true (the comment at updater.ts:410-414 says "best done when the main window is up" — but "when ready" is not "after first paint"). `updater.ts:148-149` sets `autoDownload = true; autoInstallOnAppQuit = true`, and the feed serves full NSIS installers (`differentialPackage: false`, electron-builder.yml) measured at 184 MB (docs/perf/baselines.md §3, 2026-08-21 row). The check is un-awaited so it does not block the loop, but it competes for disk/CPU/network during first render.
- Fix: defer the first check (e.g. fire on `did-finish-load` + 5-10 s timer, or `setTimeout(checkStartupUpdates, 10_000)` in bootUpdater); keep the IPC-triggered path rate-limited as-is (updater.ts:205-221).

## Healthy areas (verified, no action)

- **Diagnostics boot order**: `initDiagnostics()` at module scope before the single-instance lock is by design (spec 028; index.ts:15-24, logging.ts:26-30) and costs a couple of ms.
- **Single-instance lock runs before expensive setup** (index.ts:102-111) — duplicate processes exit cheaply; second-instance deep-link routing correct (index.ts:134-144).
- **Deep-link registration** (`app.setAsDefaultProtocolClient`, index.ts:160-170): try/catch, HKCU-only, failure non-blocking; NSIS also registers it (electron-builder.yml `include: build/installer.nsh`). Per-launch registry write is negligible.
- **Port sidecar I/O**: `findFreePort` + one small `port.json` write (port.ts:17-49) — microseconds, async, prod-only; matches the documented measurement hook in baselines.md §2.
- **did-fail-load handling**: bounded (3 retries × 500 ms for -102/-105/-107, index.ts:270-293) with a self-contained recovery page (index.ts:46-68) — no infinite retry, no remote resource.
- **Updater dev/portable guard**: `isAutoUpdateEnabled()` skips all updater work in dev and portable builds (updater.ts:97-99, 397-401) — dev cold start unaffected by the network check.
- **Menu stripped before window creation** (index.ts:181-186) — avoids a default menu bar on first paint.
- **Preload**: pure contextBridge wiring, no I/O (preload.ts:28-95); `sandbox: true`, `contextIsolation: true` intact (index.ts:215-224).

## Notes

- **Basis**: static analysis only; no app launched. Measured numbers are on-disk sizes and code-path reading. Electron 44.4.5 confirmed (apps/desktop/package.json:34); plain tsc + electron-builder confirmed (no bundler — `build` script, package.json:17-20).
- **ELECTRON_RUN_AS_NODE child cost**: the 248 MB tree mainly costs install/first-run (extraction + Defender real-time scan) rather than module resolution per se — the @img packages add ~25 stat-able dirs, trivial; the real startup cost is cold FS cache on the standalone tree, which DESKTOP-2 shrinks 10x.
- **Proposed measurement plan for the ≤2 s budget** (currently 100% [TBD] — docs/perf/baselines.md §1.1 has no machine/value; only the 2026-08-21 process-shape observations exist in §3):
  1. **Instrument main.ts** with one-line breadcrumb timings via `desktopLog.info('[cold-start] …')` using a module-level `T0`: after initDiagnostics, after single-instance, after findFreePort, after spawn, after the readiness wait resolves, after `app.whenReady`, after window creation, and on `did-finish-load` as the "interactive" proxy. `main.log` then yields the full waterfall on any machine, including user machines — zero extra tooling.
  2. **Harness** per baselines.md §2: PowerShell stopwatch from `Get-Process MasarX` creation time → first HTTP 200 on the port from `userData/port.json` → `did-finish-load` timestamp from main.log. ≥5 runs, median; report **cold** (first run after reboot — Defender scan dominates) and **warm** separately; the budget is meaningless as one number otherwise.
  3. **CI guard**: pin one runner spec, store the median in baselines.md §3 with evidence path, then wire the ">20% regression fails CI" check the budget table promises. Until the first baseline lands, DESKTOP-1's guaranteed 500 ms means at least a quarter of the budget is provably spent before any work starts.
- Fix-pass merging: DESKTOP-1 is one change (port-poll replaces the blind 500 ms and the retry-ladder dependence); DESKTOP-3 + DESKTOP-4 are one window-lifecycle edit (create early, `backgroundColor`, show on `ready-to-show`).
