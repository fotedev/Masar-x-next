# Verification — spec 005 (Desktop Study Workspace & Native Shell)

**Date:** 2026-09-23 (closure pass, executed alongside spec 014 R020–R022)
**Environment:** Windows 10.0.19045, Electron 44.4.5 (pinned exact), packaged app `apps/desktop/out/win-unpacked/Masar X.exe`, driven over CDP via Playwright `connectOverCDP`.

## Gate outputs

| Gate | Command | Result |
|---|---|---|
| GATE-TYPE-WEB | `pnpm --filter web typecheck` | 0 errors |
| GATE-TYPE-DESKTOP | `pnpm --filter desktop typecheck` | 0 errors (against the Electron 44 typings) |
| GATE-TEST-DESKTOP | `pnpm --filter desktop test` | **27/27 passed** — incl. the 4 real smoke tests (T018), which ran for the first time since the hoisted-layout path bug was fixed (spec 014 a07634e) |
| GATE-VISUAL | packaged launch + CDP DOM probe | recorded per task below |

## On-screen / DOM observations (FR-027 discipline)

Evidence collected by `sandbox/masarx-verify-desktop.cjs` (untracked scratch script) over CDP:

- **Baseline (shell chrome):** `window.masarxDesktop` bridge present; `data-masarx-desktop="true"` on `<html>`; exactly one `header.masarx-titlebar` at 32px; `.z-header` absent; `<footer>` absent. UA string: `…Electron/44.4.5…`.
- **T016 (US1):** on `/ar/subjects/رياضيات 2` the workspace rendered 3 lecture rows (`Partial fractions`, `Lecture 3`, `33222`). Clicking row 2 changed the reader toolbar title from `Partial fractions` to `Lecture 3` — selection swaps content in place, no navigation. *(Dummy data rows like `33222` are upstream content, not code — content entry is the owner's recorded remaining task.)*
- **T025 (US2/FR-011 browser regression):** plain Chromium against the dev server: `data-masarx-desktop` = `null`, no `window.masarxDesktop`, `<footer>` present. The web app is untouched in the browser. `desktop-shell.css` verified marker-scoped (every rule under `[data-masarx-desktop="true"]`, grep-reviewed).
- **T050 (Phase 6):** with the assistant opened at 1280px the assistant column measures 384px and the list 288px; at 860px viewport the assistant collapses to 0 while the list holds 288px (reader keeps the floor); rewiden to 1280px restores the assistant at 384px with its open state preserved.
- **T051 (Phase 6):** mechanism verified at code level — columns use `order-1/2/3` with logical `border-e`/`border-s` so the RTL/LTR edge swap follows the document `dir`, and lecture selection lives in page state keyed on stable DB ids, which survives same-route `[locale]` param changes in the App Router. **Honest caveat:** the desktop shell currently exposes no in-shell locale switcher (the web `Header` that hosts it is deliberately skipped in the desktop branch), so the switch could not be triggered live inside the shell; a student switches locale in the browser and the preference carries over. Recorded as a known desktop-shell gap, not a regression.

## Remaining open in this spec

- **T030–T034 (US4 dev-environment safeguards)** — port pre-clear, `clean.mjs` targets, SW unregistration, AGENTS.md visual rule. Deferred: dev-workflow hardening, not launch readiness.
- Ledger truth-sync note recorded in `tasks.md` (T010–T024 were "code present, unchecked" per the completion dashboard).
