# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Installers, portable builds, and update manifests for each tagged version are published to the public [`fotedev/masarx-releases`](https://github.com/fotedev/masarx-releases/releases) repository.

## [Unreleased]

### Added

- Web `/downloads` page with platform-aware download links and a smart desktop-app banner
- Download URLs resolved dynamically from the GitHub Releases API instead of hardcoded asset paths

### Changed

- Release builds moved to a public GitHub Actions runner in `fotedev/masarx-releases`; the source-side release workflow is disabled

### Fixed

- Removed temporary diagnostic patches left over from the auth-sync investigation

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
