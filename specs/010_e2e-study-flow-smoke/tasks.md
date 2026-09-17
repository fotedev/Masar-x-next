# Tasks: 010_e2e-study-flow-smoke

> Gates for every task: `pnpm typecheck` · `pnpm lint` (ratchet 52) · `pnpm -r --if-present test`. Hard boundary: test files + config + CI workflow only — zero app-code changes. Never stage the owner's uncommitted files; explicit-path `git add` only.

## 1. Playwright harness (local)

- [ ] 1.1 `@playwright/test` devDependency added to `apps/web`; `playwright.config.ts` (chromium, `--no-proxy-server` launch arg, `E2E_BASE_URL` override, webServer `pnpm dev` with reuseExistingServer, traces on failure)
- [ ] 1.2 `apps/web/e2e/study-flow.spec.ts`: ar/en parametrized — shell assertions (home renders, subjects shell renders, `dir` attribute correct) + data-dependent assertions with soft-skip when no public data reachable
- [ ] 1.3 `test:e2e` script in `apps/web/package.json`
- [ ] 1.4 Local run green (or env-blocked with honest note per live-verification-env memory; one attempt only, then CI-proof) → commit `test(web): add Playwright public happy-path e2e (study flow)`

## 2. CI job

- [ ] 2.1 `e2e` job in `.github/workflows/ci.yml`: build with placeholder envs + public Supabase Variables, `playwright install --with-deps chromium`, `next start`, `test:e2e`, artifact upload on failure
- [ ] 2.2 One-time setup: repo Variables `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public-by-design, NOT Secrets) — via `gh api` or documented 2-minute owner step; job fails fast with clear message if absent
- [ ] 2.3 Job verified green on a PR (this proves build+start+playwright wiring end-to-end)
- [ ] 2.4 Branch ruleset: add `e2e` to required checks (GitHub settings; via API if permitted, else documented for owner) → commit `ci(e2e): run study-flow e2e as CI job`

## 3. Authenticated smoke runbook (owner-assisted, not CI)

- [ ] 3.1 `checklists/authenticated-smoke.md`: login → admin upload → verify public visibility steps + result table → committed with the CI commit or the report commit

## 4. Report

- [ ] 4.1 `docs/MVP_REPORT.md`: G6.1 → done (CI guard live) with commit hash; changelog row
