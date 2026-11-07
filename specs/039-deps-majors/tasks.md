# Spec 039 — tasks

Checklist for the four workstreams in [spec.md](./spec.md). Each task lands as its own PR referencing this spec; the repo ruleset (update-branch → all-checks-green → squash) applies to every merge. Do not start a task before the owner approves this spec (I11).

## WS-3 — @types/node alignment (first — zero runtime blast radius)

- [ ] T1.1 Verify the Electron 44.4.5 bundled Node major (built desktop app `process.versions.node` or the Electron releases table) — record it in the PR body.
- [ ] T1.2 `apps/web/package.json`: `@types/node` 25.2.3 → `^24` (match `.nvmrc`/CI node 24).
- [ ] T1.3 `apps/desktop/package.json` + `packages/shared/package.json`: `^22.0.0` → the verified Electron-bundled major (expected to stay 22 — pin deliberately, don't drift).
- [ ] T1.4 Lockfile refresh; grep guard: no manifest pins `@types/node` above its runtime major.
- [ ] T1.5 Gates: `pnpm -r typecheck`, lint, local `pnpm -r test` untouched-green; CI `workspaces` job green.
- [ ] T1.6 Resolve #160 per owner decision (close with rationale / hold comment referencing this spec).

## WS-1 — vitest 2 → 5

- [ ] T2.0 Spike: install vitest 5 + coverage-v8 5.x in a scratch branch; confirm the exact replacement for `environmentMatchGlobs` in `apps/web/vitest.config.ts` and the `server.deps.inline` semantics for `masarx-shared` under vitest 5 — write findings into the PR body before porting configs.
- [ ] T2.1 Port all four vitest configs (`apps/web`, `apps/desktop`, `apps/mobile`, `packages/shared`); preserve `globals: true`, setup file, alias regexes; jsdom routing for `*.test.tsx` via the verified v5 mechanism.
- [ ] T2.2 Bump devDeps in the 4 manifests (vitest + `@vitest/coverage-v8` lockstep, web + desktop) + lockfile; re-check `pnpm-workspace.yaml` `onlyBuiltDependencies` for new postinstall needs.
- [ ] T2.3 Add the environment-routing canary pair: one `.test.tsx` asserting DOM, one `.test.ts` asserting no DOM.
- [ ] T2.4 Pull PR #159's failing `test` job log; fix each failing suite — test-logic edits only where a vitest-5 API genuinely requires it, each justified in the commit message.
- [ ] T2.5 Investigate the PR's `workspaces` failure (parity/`pnpm list -r` guard) and `gitleaks-artifacts` failure — confirm both are lockfile-derivative, not latent.
- [ ] T2.6 Gates: `pnpm -r test` green (~66 files), web `test:coverage` runs, full CI green.

## WS-2 — electron-builder 25 → 26

- [ ] T3.1 Re-verify every 25.x-referencing knob in `apps/desktop/electron-builder.yml` against 26.x release notes: `compression: normal`, `nsis.differentialPackage: false`, static `artifactName`, `publish: github` (channel `latest`), notarize env names (mac block, not built), NSIS `installer.nsh` include, Next standalone `extraResources`. Record the knob-by-knob table in the PR body.
- [ ] T3.2 Bump desktop devDep + lockfile; no other file changes expected.
- [ ] T3.3 Local smoke (no publish): `pnpm --filter desktop run build:installer` → install NSIS artifact on this host → app boots, `masarx://` registered; `build:portable` → exe boots.
- [ ] T3.4 Tag-day plan recorded per owner decision: pre-release tag (`vX.Y.Z-test.N`) validating `release.yml`'s `build:all` publish path (latest.yml + blockmaps) before the next real release.
- [ ] T3.5 Gates: full CI green (PR CI doesn't build installers — the local smoke in T3.3 is the merge gate).

## WS-4 — mobile React 19 (record-only)

- [ ] T4.1 Comment on #157 with the fact base (web already 19.2.4; mobile pinned by RN 0.74.5/Expo SDK 51) and the pointer to a future Expo SDK 52+ upgrade spec.
- [ ] T4.2 Execute owner decision: keep open as tracker, or close with rationale.
- [ ] T4.3 Add the AGENTS.md ledger row for spec 039 (approved/landed state) as part of the final docs PR.
