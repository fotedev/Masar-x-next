# Feature Specification: E2E Study-Flow Smoke (Playwright + CI)

**Feature Branch**: main (atomic commits)
**Created**: 2026-09-17
**Status**: approved (owner-approved plan; this file records it)
**Input**: `docs/MVP_REPORT.md` pass 2 — finding G6.1
**Scope note**: spec number derived from disk (008 exists as a parallel-session draft; 009 = ops hardening companion).

## Context & Problem Statement

CI (ESLint, next build, ai-endpoint-grep, gitleaks, translations, workspace tests) can pass while the runtime study flow is broken: there are zero browser tests in the repo (9 vitest files, all unit-level). Every deploy to the live study flow is unguarded. This matters most right now because content entry (G1.1) is about to put real data behind those routes — the e2e guard should exist *before* that data lands.

Owner decisions (2026-09-17): public happy path only in CI; no authenticated flows, no secrets in CI.

## Architecture & Design

### Harness

- `@playwright/test` devDependency in `apps/web`; `apps/web/playwright.config.ts`:
  - Chromium only; `baseURL` overridable via `E2E_BASE_URL` (defaults `http://localhost:3000`).
  - `use: { ... , launchOptions: { args: ["--no-proxy-server"] } }` — this host's browser-level localhost reachability has failed through proxy paths before (live-verification-env memory).
  - Local runs: `webServer: { command: "pnpm dev", reuseExistingServer: true }`. CI: server started explicitly by the workflow.
  - Traces + screenshots on failure, retained as CI artifacts.
- `apps/web/package.json` gains `"test:e2e": "playwright test"`.

### Test spec — `apps/web/e2e/study-flow.spec.ts`

Two assertion layers:

1. **Shell assertions (always run, CI + local):** locale-parametrized (ar/en):
   - `/` renders the localized home (header/nav visible, `<html dir>` correct per locale).
   - `/subjects` renders the page shell with the localized heading and does not error — either subject cards or the empty state is acceptable.
2. **Data-dependent assertions (run when the anon Supabase env resolves real data, soft-skip otherwise):**
   - At least one subject card is rendered → click it → subject detail renders.
   - First available lecture/summary opens and renders content (public read).
   Soft-skip mechanism: probe the subjects container for cards; if none, `test.skip()` with reason "no public data reachable" — so a CI run without backend variables still passes shell assertions instead of failing spuriously.

### CI environment reality (important design constraint)

`NEXT_PUBLIC_*` values are inlined at **build** time. The Supabase URL and anon key are publishable-by-design (client scope, already public in the deployed bundle) but must not be hardcoded in `ci.yml` (gitleaks-artifacts scans built artifacts and flags Supabase JWT patterns). Therefore:

- The `e2e` CI job builds with `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` read from **GitHub Actions repository Variables** (not Secrets — they are not secrets). One-time setup via `gh api` or repo settings; the job fails fast with a clear message if the variables are absent.
- All other envs stay placeholders exactly like the `next-build` job.

### CI job — `.github/workflows/ci.yml` new `e2e` job

Checkout → pnpm/Node setup → install (neverBuiltDependencies convention unchanged) → `next build` (placeholder envs + the two public Variables) → `npx playwright install --with-deps chromium` → `next start &` → `pnpm --filter web test:e2e` (E2E_BASE_URL=http://localhost:3000) → upload trace/screenshot artifacts on failure. Intended as a required check (branch ruleset update — GitHub settings action, documented for the owner if API access is unavailable).

## Behavior Preservation & Regression Strategy

- Test-only + CI wiring; zero application code changes.
- The specs assert routes and shells that exist today; a failure caused by an unrelated route change is the guard working as intended.
- Authenticated smoke (login → admin upload → public visibility) is deliberately NOT automated (no secrets in CI, per owner): it lives in `checklists/authenticated-smoke.md` as an owner-assisted runbook.

## Test Specification

- Local gate: `pnpm --filter web test:e2e` green against a running dev server (data-dependent steps either pass against real data or soft-skip cleanly).
- CI gate: `e2e` job green on a PR touching `.github/workflows/ci.yml` (proves the job wiring, build, and artifact upload).
- Existing gates unchanged: typecheck, lint (ratchet 52), vitest suites, translations check.

## Atomic Execution Plan

1. (specs landing — see 009 task 1.2)
2. `test(web): add Playwright public happy-path e2e (study flow)` — devDep, config, spec; green locally
3. `ci(e2e): run study-flow e2e as CI job` — ci.yml job + artifact upload; verified green on a PR
4. `docs(mvp-report): flip G6.1 to done (CI guard live)` — folded into 009 task 8.1 if phases land together
