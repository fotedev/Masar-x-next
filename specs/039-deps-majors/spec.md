# Spec 039 — dependency majors triage: vitest 5, electron-builder 26, @types/node alignment, mobile-React tracker

| Field | Value |
|---|---|
| Status | **Draft — awaiting owner approval** |
| Type | Dependency/runtime upgrades (I11 trigger class: runtime/environment upgrade) |
| Origin | Four dependabot MAJOR PRs parked since 2026-10-18 under the "majors need a dedicated spec, never auto-close" rule: #157 (react 19), #158 (electron-builder 26), #159 (vitest 5), #160 (@types/node 26). Triaged 2026-11-07 against live code + each PR's CI runs. |
| Governs | #158, #159, #160 (re-scoped), #157 (record-only). Execution of each workstream happens in its own PR referencing this spec. |

## 1. Context & problem statement

The repo has four open major-bump PRs that regular CI can't decide: three are not simple version bumps (one targets the wrong assumption, one is blocked by a framework pairing, one moves types ahead of every runtime), and one is a real migration. Merging any of them blind either breaks CI (#159, #157) or leaves an untested release path (#158). This spec records the verified fact base and the workstreams, so each bump lands as a reviewed, gated change instead of a parked guess.

**Live state verified 2026-11-07** (code read at main `eb0277f`; CI = each PR's latest check runs):

| PR | Bump | PR CI | Reality |
|---|---|---|---|
| #159 | vitest 2.1.8 → 5.1.0 | ❌ 5 jobs fail (`test`, `e2e`, `next build`, `workspaces`, `gitleaks-artifacts`) | Real migration — see WS-1 |
| #158 | electron-builder 25.1.8 → 26.18.0 | ✅ all green | Risk lives only on the tag-triggered release path — see WS-2 |
| #160 | @types/node 22.20.5 → 26.6.6 | ✅ all green | Types would run **ahead of every runtime** — see WS-3 |
| #157 | react 18.2.0 → 19.2.4 | ❌ `mobile` job fails | Targets `apps/mobile` only (web is already react 19.2.4 + next 16.4.3); RN 0.74.5 / Expo SDK ~51 hard-require React 18.2.0 — see WS-4 |

## 2. Architecture & design (per workstream)

### WS-1 — vitest 2 → 5 (#159) — DO

- **Scope**: 4 vitest configs (root-level per workspace: `apps/web`, `apps/desktop`, `apps/mobile`, `packages/shared` — no root vitest workspace file), ~66 test files (web 34, mobile 16, shared 10, desktop 7), devDeps in all four manifests.
- **Mandatory migration**: `environmentMatchGlobs` in `apps/web/vitest.config.ts` is **removed in vitest 3+** — the `*.test.tsx → jsdom` routing (9 jsdom suites vs 24 node suites in web) must move to the vitest-5 mechanism (per-file environment / projects). Exact replacement API is verified with a spike at execution start against the installed vitest 5 — not assumed from memory.
- **Lockstep**: `@vitest/coverage-v8` 2.1.9 (web + desktop) bumps to 5.x in the same change; `pnpm-workspace.yaml` `onlyBuiltDependencies` re-checked for any new vitest-native postinstall.
- **Preserve**: `globals: true`; setup file `apps/web/src/test/setup.ts` (`@testing-library/jest-dom/vitest` subpath import — v6-safe form); `server.deps.inline: ['masarx-shared']` semantics for the workspace-linked raw-TS package (config comments already flag this as fragile under 2.x — re-verified under 5); alias regex arrays for `masarx-shared/*` and `@/`.
- **Watch items**: web devDeps `vite ^8.3.5` + `@vitejs/plugin-react ^6.1.2` (plugin-react is not imported by any vitest config today — confirm nothing else consumes it before touching); vitest 5's bundled vite vs the pinned vite 8.
- **Known failures to fix**: the 5 failing PR-#159 CI jobs — the `test` job's failing suites are pulled from the job log at execution start and define the fix list; `workspaces` failure (parity/`pnpm list -r` guard) re-checked after the lockfile settles.

### WS-2 — electron-builder 25 → 26 (#158) — DO, gated on a local build smoke

- **Scope**: `apps/desktop/electron-builder.yml` + desktop devDep only. **No app code changes** — Electron stays pinned exact 44.4.5 (I6), zero native modules (`npmRebuild: false` since better-sqlite3 removal).
- **Only exercised path**: PR CI never builds installers; the real consumer is `release.yml` (tag `v*`, windows-latest, node 24) → `pnpm --filter desktop run build:all` → NSIS + portable targets, GitHub Release publish, `latest.yml` + blockmaps for electron-updater. Config comments reference 25.x behavior (compression values, notarize env vars, NSIS description field) — each knob re-verified against 26.x release notes at execution: `compression: normal`, `nsis.differentialPackage: false`, static `artifactName` (no `${version}` — keeps `/releases/latest/download/<name>` URLs stable), `publish: github` channel `latest`, `masarx://` protocol via `build/installer.nsh`, and the Next standalone `extraResources` packaging.
- **Merge gate (no publish)**: local Windows smoke on the branch — `pnpm --filter desktop run build:installer` and `build:portable` (both carry `--publish never`); install the NSIS artifact, boot the app, verify `masarx://` registration. Tag-day behavior (build:all publish path) cannot be dry-run without publishing; first tagged release after the merge starts with a pre-release tag (`vX.Y.Z-test.N`) unless the owner accepts the risk — owner decision recorded at spec approval.

### WS-3 — @types/node alignment (re-scope of #160) — DO as alignment, not as 26

- **Fact base**: no `engines` field anywhere; de-facto runtime = node 24 (`.nvmrc` = 24, all CI jobs node 24); Electron 44.4.5 bundles its own Node (bundled major verified at execution from the built app's `process.versions.node` — not assumed). Current types: web **25.2.3 exact** (already ahead of its runtime — inconsistency), desktop + shared `^22.0.0` (lockfile 22.20.5).
- **Change**: web → `^24` (match `.nvmrc`/CI); desktop + shared → the Electron-bundled Node major (expected to stay 22 — verified, then pinned accordingly). PR #160 (types 26) moves types ahead of **every** runtime in the repo — recommended outcome is close, or hold until runtimes reach 26; owner decision at approval, executed as its own alignment PR regardless.

### WS-4 — mobile React 19 (#157) — RECORD-ONLY, blocked

- Web is already fully on react 19.2.4 / react-dom 19.2.4 / @types/react ^19 — #157's diff touches `apps/mobile` only, where react 18.2.0 exact sits beside `react-native 0.74.5` + `expo ~51.0.28` (Expo SDK 51 pairs React 18.2.0). Bumping react alone breaks the RN pairing (PR CI `mobile` job red).
- React 19 on mobile arrives with the Expo SDK 52+ / RN 0.76+ generation — its own future spec (mobile runtime upgrade, same I11 trigger class). **No code in this spec.** Recommendation: keep #157 open as the tracker (dependabot keeps it current), or close with rationale pointing at the future spec — owner call at approval.

## 3. Behavior preservation & regression strategy

- Runtime behavior is untouched by WS-2/WS-3 (packaging metadata + type-only). WS-1 changes test infrastructure only — **no test logic edits** except where a suite legitimately needs a vitest-5 API adjustment, and every such edit is justified in its commit message (reviewable diff rule).
- Isolation: each workstream is its own PR, merged sequentially (ruleset update-branch → green → squash) so CI signal stays attributable. Recommended order: WS-3 (types, zero runtime) → WS-1 (vitest) → WS-2 (electron-builder).
- Rollback: each PR reverts independently; nothing crosses workstream boundaries.

## 4. Test specification

- **WS-1**: `pnpm -r test` green across all 4 workspaces on node 24; `test:coverage` still runs in web (+ desktop); environment-routing canary — one `.test.tsx` asserts DOM availability, one `.test.ts` asserts its absence, proving the jsdom/node split survived the `environmentMatchGlobs` migration.
- **WS-2**: NSIS artifact installs and boots on this host (Windows 10 x64); portable exe boots; `masarx://` protocol registered after install; CI `build:all` on the first post-merge tag produces `latest.yml` + blockmaps (checked in the release run).
- **WS-3**: `pnpm -r typecheck` green; CI `workspaces` parity job green; grep guard confirms no manifest pins `@types/node` above its matching runtime major.

## 5. Atomic execution plan

| # | Commit | Workstream | Gates |
|---|---|---|---|
| T1 | `chore(deps): align @types/node to runtimes (web 24, desktop/shared = Electron-bundled Node)` | WS-3 | typecheck + lint + CI `workspaces` |
| T2a | `chore(deps): vitest 5 + coverage lockstep + config migration` (configs + 4 manifests + lockfile) | WS-1 | typecheck + `pnpm -r test` + CI `test` |
| T2b | `test: adapt suites to vitest 5` (only suites that genuinely need it; each fix justified in-message) | WS-1 | `pnpm -r test` + full CI |
| T3 | `chore(desktop): electron-builder 26 (knobs re-verified, local installer smoke)` | WS-2 | local build:installer/build:portable smoke + full CI |
| T4 | `docs(specs): record #157 mobile-React tracker decision` (+ ledger row for this spec) | WS-4 | docs-lint |

Out of scope: mobile Expo SDK upgrade (future spec), any Electron version change (I6 exact pin — separate owner decision), dependabot minor/patch auto-flow (unchanged).

**Open decisions for the owner at approval**: (a) #160 — close vs hold until runtime 26; (b) #157 — keep as tracker vs close with rationale; (c) WS-2 tag-day — pre-release-tag test vs accept first-tag risk.
