# Performance Baselines

**Spec**: 004-multi-platform-expansion, Tasks T061 / T064 (US6).
**Purpose**: document the reference environments and the recorded baselines so the perf budgets can be reproduced and re-measured over time. Method over vibes: every number here must be reproducible with the tooling and environment documented below - no "feels fine" claims (spec US6 independent-test clause).

## Budgets being tracked

| Budget | Spec | Value | Enforcement |
| --- | --- | --- | --- |
| Desktop cold start | SC-007 / T058 | <= 2 s on the documented reference machine | CI perf check fails on a regression > 20 % |
| Mobile list scroll | SC-008 / T059 | No visible jank during a 500-item scroll; FPS floor captured | Documented here; re-measured per release |
| Mobile data usage | T060 | 10-minute study session <= 50 % of the equivalent mobile-browser session | Documented here |
| Web Lighthouse | SC-009 / T057 | No regression > 5 points vs baseline | `.github/workflows/lighthouse.yml` (repo variables) |

Legend: **[TBD]** = measurement pending - requires the dedicated reference machine/device. Recorded values cite their repo evidence.

## 1. Reference environments

### 1.1 Desktop cold-start machine (T058)
| Property | Value |
| --- | --- |
| Machine (model / CPU / RAM / storage) | **[TBD]** - pin one reference machine and record it here |
| OS | Windows 11 x64 (host of the 2026-08-21 smoke run; exact build **[TBD]**) |
| Runtime versions at last recorded run | Node v24.18.0, pnpm 11.17.0, Electron 32.3.3 (Node 20.18.1, ABI 128) |
| App version | 0.5.6 at the 2026-08-21 smoke run (current: 0.5.9 - **[TBD]** re-measure) |
| Measured cold start | **[TBD]** |

### 1.2 Mid-range Android device (T059 / T060)
| Property | Value |
| --- | --- |
| Device (model, RAM class) | **[TBD]** - pick a mid-range device (~4 GB RAM) and pin it here |
| Android version | **[TBD]** |
| App build | Expo SDK 51 / React Native 0.74.5 - build number **[TBD]** |
| Measured FPS floor (500-item scroll) | **[TBD]** |
| Measured data usage (10-min session) | **[TBD]** |

### 1.3 Network profile
| Property | Value |
| --- | --- |
| Default profile for mobile data tests | Fast 3G throttle (Chrome DevTools preset) - confirm/adjust on the pinned device: **[TBD]** |
| Web Lighthouse runner | GitHub Actions ubuntu-latest runner (see `.github/workflows/lighthouse.yml`) |

### 1.4 Web build environment
| Property | Value |
| --- | --- |
| CI runner | ubuntu-latest, Node 24, pnpm 9 (frozen lockfile) - mirrors `ci.yml` |
| Build command | `pnpm --filter web build` (Next.js standalone output) |

## 2. Measurement methods (spec T058-T060)

| Target | Method | Tooling | Budget |
| --- | --- | --- | --- |
| Desktop cold start (T058) | Launch the packaged app (`release/win-unpacked/` or NSIS install); measure from process start to the local Next server answering + window interactive. The app writes a timestamped `userData/port.json` and serves HTTP 200 on the discovered port - script the stopwatch from `Get-Process` creation time to the first 200. | PowerShell + `Invoke-WebRequest`/`curl`; >= 5 runs, report median | <= 2 s (SC-007); CI check fails on > 20 % regression |
| Mobile list scroll (T059) | Scripted continuous scroll of a 500-item list; capture frame stats and profiler commit timings | `adb shell dumpsys gfxinfo <package>` frame stats and/or React DevTools profiler on a recorded run | No visible jank; document the FPS floor (SC-008) |
| Mobile data usage (T060) | Read the per-app network counter, run a scripted 10-minute study session (browse summaries, one AI chat, one quiz), read the counter again; repeat the same flow in the mobile browser on the same device/network as the reference | `adb shell dumpsys netstats` (delta) or OS per-app data usage | <= 50 % of the mobile-browser session |
| Web Lighthouse (T057) | `.github/workflows/lighthouse.yml`: production build + `next start`, 3 runs against `/`; Performance + Accessibility asserted against baseline repo variables | treosh/lighthouse-ci-action@v12 | No regression > 5 points (SC-009) |

## 3. Recorded data points

| Date | Data point | Value | Source |
| --- | --- | --- | --- |
| 2026-08-21 | NSIS installer size (app 0.5.6) | **184 MB** (`Masar X-0.5.6-x64.exe`); unpacked `release/win-unpacked/` 177 MB | `specs/004-multi-platform-expansion/smoke-test-results.md` section 4.1 (T025 smoke test PASS) |
| 2026-08-21 | Packaged app runtime shape | 5 processes (main / GPU / renderer / utility / spawned server.js via `ELECTRON_RUN_AS_NODE=1`); local Next server answered HTTP 200 (~100 KB HTML) on the discovered port | same, sections 4.2-4.3 |
| 2026-08-21 | Local read cache (better-sqlite3 WAL) | `Cache/cache.db` + `-shm` + `-wal` created on first browse; SQLite 3 magic bytes verified | same, section 4.5 |
| 2026-08-31 | Web production build health | `pnpm --filter web build` clean exit 0; typecheck green | Spec 004 compliance audit (2026-08-31); the 2026-08-21 smoke run also recorded 12 routes built + standalone `server.js` emitted |

## 4. How to add a measurement

1. Run on the reference environment from section 1 (if the environment changes, update section 1 first and note the change in the row you add).
2. Append a row to section 3 with the date, the value, and the evidence path (script output, CI run URL, smoke-test doc section).
3. If a budget changes, update the budget table at the top AND the corresponding CI guard (for SC-009: the `LHCI_BASELINE_*` repository variables consumed by `.github/workflows/lighthouse.yml`).