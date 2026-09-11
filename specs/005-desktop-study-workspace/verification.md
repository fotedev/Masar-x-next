# Verification Evidence — 005-desktop-study-workspace

**Recorded**: 2026-09-10 (evening session — `/speckit.implement` run)
**Environment**: Windows, user's dev server live on :3000 (PID 9804, untouched); Electron
binary absent from `apps/desktop/node_modules` (postinstall never materialized — documented
blocker); `better-sqlite3` never-built by root `pnpm.neverBuiltDependencies` (invariant I5).

## Gate results

| Gate | Result | Evidence |
|---|---|---|
| GATE-TYPE-DESKTOP | ✅ 0 errors | `pnpm --filter desktop typecheck` (tsc --noEmit) — clean, 2026-09-10 ~21:56 |
| GATE-TYPE-WEB | ✅ 0 errors | `npx tsc -p tsconfig.json --noEmit` — TOTAL_ERRORS: 0 (includes T030–T032/T050/T051 changes). Note: one transient error appeared mid-run (`admin-dashboard/page.tsx:253` "overview" ∉ AdminTabId) from a **concurrent parallel session** editing the new admin-shell at 21:55; it was gone on the immediate re-run. Not attributable to this change set. |
| GATE-TEST-DESKTOP | ⚠️ partial | 26/37 pass. **T017/T043 contract suite (`main.test.ts`): 9/9 green** — the gate this feature's tasks pin. 11 failures, all environmental: (a) `smoke.test.ts` — Electron binary missing (`node_modules/electron/cli.js` + `install.js` absent; fix: reinstall with pnpm when the dev server is idle); (b) `read-cache.test.ts` — `better_sqlite3.node` never built, blocked **by policy** (`neverBuiltDependencies`, invariant I5). |
| GATE-VISUAL (browser side) | ✅ for T025 | SSR HTML of `/ar` from the live dev server: `data-masarx-desktop` **0 occurrences** in 145,691 bytes; footer present (3 `<footer` nodes, "جميع الحقوق" copyright ×2). FR-011/SC-010 browser-side holds. |
| GATE-VISUAL (shell side) | ⏳ pending | Requires the Electron shell — blocked by the missing binary. Interactive checks (lecture-select swaps reader in place, assistant scope tracking, five-gesture US2 checklist) remain open as tasks T016 / spec 007 §B1. Route-level static evidence: `/ar/subjects/math` → HTTP 200 (141 KB) rendering subject data ("رياضيات"); `page.tsx` imports and renders `StudyWorkspace` in the `isDesktop` branch. |

## What this session implemented (task-level evidence)

- **T030** ✅ — already implemented, ledger backfilled: `apps/web` `predev` = `kill-port.mjs && inject-sw-version.mjs`; `kill-port.mjs` is PORT-aware (`PORT` env or arg, default 3000), cross-platform, exits 0.
- **T031** ✅ — `clean.mjs` extended: no-arg now removes **.next + out + node_modules/.cache** (FR-025); explicit single-target argument still honored; consumers (`clean`, `dev:clean`) unaffected.
- **T032** ✅ — `sw-register.ts`: outside production it now **actively unregisters** any existing service workers (FR-026) instead of only skipping registration; production path unchanged.
- **T033** ✅ — FR-027 visual-verification rule added to `AGENTS.md` §8 checklist ("typecheck is explicitly NOT sufficient").
- **T034** ✅ — FR-024 mechanism verified live: dummy listener on :3457 → `node scripts/kill-port.mjs 3457` → `[kill-port] freed port 3457 (PID 7464)`, port free after. Literal two-dev-server reproduction impossible this session: Next 16 enforces a same-dir dev lock (it hard-errors rather than silently failing over — which itself defeats SC-009's failure mode) and the user's server occupied the project lock. Also fixed the test mock for the new `session.defaultSession.webRequest` CSP hook (restores T017 contract suite to 9/9 — mock surface follows production imports, no assertion loosened).
- **T050** ✅ — `StudyWorkspace.tsx` collapse order implemented: assistant column `hidden lg:flex` (first to go below 1024px), lecture list `hidden md:flex` (second, below 768px); reader never hidden (spec Edge Case).
- **T051** ✅ — locale switch previously **lost** the open lecture (selection was local state only; the page passes no `onSelectLecture`, and a locale switch remounts the route). Fixed: per-subject `sessionStorage` key `masarx_ws_selection_<subject>`, restored in a mount-only effect (hydration-safe — first render still matches SSR), host `initialLectureId` always wins. Column-edge swap itself was already correct (dir-based logical `order-*`, FR-008).
- **T053** ✅ — this file.
- **T052** ⏳ — type gates green; test gate partial per the GATE-TEST-DESKTOP row. Re-run after the Electron binary is restored for a full green.

## Honest caveats

1. Shell-side GATE-VISUAL has never been re-run since the original T046 session — do the
   interactive pass (spec 007 §B1) when the binary is back.
2. T051's restore is code-reviewed and typechecked but not interactively demonstrated (same
   binary blocker).
3. A parallel session is actively editing `apps/web/src/app/[locale]/admin-dashboard/` and a
   new `admin-shell` module (mtimes 21:55) — this evidence file's numbers describe the tree as
   of ~21:56 and may drift underneath concurrent work.
