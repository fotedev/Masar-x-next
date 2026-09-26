# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Installers, portable builds, and update manifests for each tagged version are published as [GitHub Releases](https://github.com/fotedev/Masar-x-next/releases) on this repository. (Releases ≤ v0.5.x went to the separate public [`fotedev/masarx-releases`](https://github.com/fotedev/masarx-releases/releases) repository, now archived read-only.)

## [0.6.0] - 2026-09-23

### Added

- Web `/downloads` page with platform-aware download links and a smart desktop-app banner
- Download URLs resolved dynamically from the GitHub Releases API instead of hardcoded asset paths
- Desktop: Google sign-in inside the shell via the `masarx://` PKCE deep link — consent completes in the system browser and the OS hands the session back to the app (requires `masarx://auth/callback` in the Supabase redirect allow-list; email/password unaffected)
- Desktop: `masarx://` URL protocol registered by the NSIS installer (HKCU) and at app startup

### Changed

- Desktop: Electron upgraded 32.2.0 → 44.4.5 (exact pin). Electron 32 was EOL since 2025-03; with the native modules gone there is no ABI-pairing risk, and the renderer picks up a supported Chromium
- Desktop: removed the dead `better-sqlite3` native dependency and the unused `masarx-shared` workspace dependency (leftovers of the deleted LocalReadCache/auth subsystems) — smaller installers, no ABI machinery in the release pipeline
- Release pipeline consolidated back into this (now public) repository: `.github/workflows/release.yml` builds and publishes desktop installers directly with the built-in `GITHUB_TOKEN`; the `fotedev/masarx-releases` split, `GH_RELEASES_TOKEN` PAT, and tag-mirror step are retired
- Release builds moved to a public GitHub Actions runner in `fotedev/masarx-releases`; the source-side release workflow is disabled

### Fixed

- Removed temporary diagnostic patches left over from the auth-sync investigation
- Desktop: smoke suite no longer misses the Electron launcher under the hoisted node-linker (the G5.2 environmental failure) — the full suite including the 4 real smoke tests runs locally
- Desktop: study workspace collapses the assistant panel (then the lecture list) when the window narrows, so the reader stays usable at the 800px minimum width

## [0.5.9] - 2026-09-12

### Added

- Desktop study workspace (spec 005): three-column lecture-list / reader / assistant layout, custom frameless titlebar with working window controls and the web chrome (header, footer, download/PWA banners) suppressed inside the shell

### Changed

- Desktop shell hardening: removed the unreachable local auth/cache subsystems (encrypted session storage + SQLite read cache, −998 lines) — the app is online-only by design

## [0.5.8] - 2026-08-25

### Changed

- Desktop installers are now published to the public `fotedev/masarx-releases` repository, enabling anonymous downloads and auto-updates
- Release tags are mirrored to `masarx-releases` before publishing so releases attach correctly
- Updater channel renamed so the feed produces `latest.yml`

### Fixed

- Duplicate release creation caused by both stable and prerelease publish entries being configured

## [0.5.7] - 2026-08-24

### Fixed

- Google OAuth sign-in regressions in production (404 on callback, 500 on login) caused by webpack alias and router handling
- Toolchain drift between local, CI, and Vercel environments; pnpm pinned to `9.15.4` everywhere
- Desktop dependency resolution: exact `electron` pin and workspace-level skip of the `better-sqlite3` postinstall

## [0.5.6] - 2026-08-23

### Added

- First Windows desktop release: Electron main process, local auth session, local read cache, auto-update with rollback, and native menu bar
- Automated release pipeline producing NSIS installer and portable `.exe` artifacts

### Changed

- Build switched to `node-linker=hoisted`, reducing installer size by roughly 88 MB

### Fixed

- Transient Next.js server startup errors now retried at Electron window load
- UTF-8 BOM emitted by Supabase SSR cookies breaking undici (`ByteString` errors causing 500 responses)
- Installer packaging issues: 7z extraction, prebuild hook wiring, and dev-mode updater guard
