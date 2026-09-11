# Quickstart: Desktop Study Workspace & Native Shell

**Feature**: 005-desktop-study-workspace | **Audience**: developers and agents working on the desktop shell.
Prereqs: Node >= 24, pnpm 9.15.4 (`corepack enable`), `.env.local` filled from `.env.example`,
Electron's postinstall binary present (`apps/desktop/node_modules/electron/cli.js` must exist —
if pnpm blocked the build script, approve it; the smoke suite fails with MODULE_NOT_FOUND without it).

## Fast loop (UI iteration — seconds, not minutes)

```bash
pnpm dev:desktop          # electron . — the shell hosts/serves the web app in-process
```

The Electron main process starts the Next.js server itself (`apps/desktop/src/main/server.ts`),
so there is nothing else to run. UI edits under `apps/web/src` hot-reload in the window.
Iterate here; **do not** repackage per CSS change (spec 007 ADR-3 — 45–90s per pack plus
Windows file locks).

If a stale shell holds the port or caches lie:

```bash
taskkill /F /IM "Masar X.exe" /T & taskkill /F /IM "electron.exe" /T   # Windows zombie hygiene
pnpm --filter web clean && pnpm dev:desktop
```

(US4 will automate the port-clear + clean into `predev`/`dev:clean` — tasks T030–T032.)

## Gate loop (verification & release)

```bash
pnpm typecheck                       # all workspace projects must be green (GATE-TYPE-*)
pnpm --filter desktop test           # Vitest: T017 window contract + T043 IPC tests (GATE-TEST-DESKTOP)

# Package the shell (dir output — no installer) and launch the real thing:
pnpm --filter web build
pnpm --filter desktop exec electron-builder --dir
./apps/desktop/out/win-unpacked/"Masar X.exe"
```

## GATE-VISUAL checklist (FR-027 — typecheck is NOT evidence)

Verify on the **workspace route** (`/[locale]/subjects/[subject]`), never the home page:

1. **Shell chrome (US3)**: exactly one 32px `header.masarx-titlebar` at the top with working
   minimize / maximize / restore / close; no OS titlebar, no File/Edit menu.
2. **No web chrome (US2)**: no web header, footer, download banner, or PWA prompt; right-click
   shows no browser menu; drag-select on chrome does nothing; study prose IS selectable
   (`.selectable-content`); window itself never scrolls.
3. **Workspace (US1)**: three columns visible (list / reader / assistant); selecting a lecture
   swaps the reader in place with no navigation; assistant panel states its lecture scope and
   follows selection; empty states render for no-lectures / no-document / load-failure.
4. **Browser regression (FR-011)**: same routes in a plain browser — `data-masarx-desktop`
   absent, Header/Footer/banner all present, all browser gestures work.

Evidence to record: CDP DOM probes (computed styles, bounding boxes), a Win32 screenshot with
pixel scan, and the route URL — appended to `verification.md` (file to be created, task T053).

## Smoke suite note

`pnpm test` runs only `apps/desktop`'s Vitest suite. It spawns headless Electron
(`--masarx-smoke`, port announced as `MASARX_DESKTOP_PORT=<n>` on stdout) and is skipped under
`CI=true` / `MASARX_SKIP_SMOKE=1`. Known environmental failure: missing
`electron/cli.js` (postinstall never ran) → MODULE_NOT_FOUND before any assertion — fix the
install, not the tests.
