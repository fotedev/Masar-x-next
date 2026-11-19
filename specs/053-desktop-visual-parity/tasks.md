# Tasks — Spec 053

- [x] T1 `generate-icon.mjs`: default style `squircle` → `transparent` + header comment
- [x] T2 Regenerate `build/icon.ico` + `build/icon-master.png`; commit the regenerated assets (icon.ico tracked + committed; icon-master is gitignored scratch)
- [x] T3 `electron-builder.yml` `win.icon` comment (white squircle → transparent)
- [x] T4 `docs/BRANDING.md` §7.2 desktop regen line (owner decision 2026-11-19)
- [x] T5 `HomeClient.tsx` root div + `home-shell` class
- [x] T6 `desktop-shell.css` `.home-shell` width cap under the desktop marker
- [x] T7 Gates (2026-11-19): icon `--verify-only` ALL CHECKS PASSED (7 frames, 16px probe 57% coverage, 3 hue families); corner-alpha probe on frames = `rgba(0,0,0,0)` (= web icon-512); web tsc + lint (0 errors) + vitest 92 files / 1085 tests green; Playwright probe 1920×1080 — web control: `.home-shell` 1216px @384, hero 493px (unchanged, FR-011); desktop DOM (marker + Layout isDesktop classes): `.home-shell` 1280px centered (margin-inline 280px), hero **493px** (was ≈780px stretched)
- [x] T8 Installer built `out/Masar X-Setup-x64.exe` (120.9 MB, unsigned smoke build); EXE-embedded icon corner-alpha probe = transparent; PR opened with evidence
