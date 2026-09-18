# Tasks: 010_e2e-study-flow-smoke

> Gates for every task: `pnpm typecheck` · `pnpm lint` (ratchet 52) · `pnpm -r --if-present test`. Hard boundary: test files + config + CI workflow only — zero app-code changes. Never stage the owner's uncommitted files; explicit-path `git add` only.

## 1. Playwright harness (local)

- [x] 1.1 `@playwright/test` devDep + `playwright.config.ts` (chromium, `--no-proxy-server` launch arg — this fixed this host's headless-localhost blocker, `E2E_BASE_URL` override, webServer `pnpm dev` reuseExistingServer, traces on failure) → `c245170`
- [x] 1.2 `apps/web/e2e/study-flow.spec.ts`: ar/en parametrized — shell assertions (home 200 + `html[dir]` + main visible + no error boundary; subjects h1) + data-dependent subject-detail step with `expect.poll` soft-skip → `c245170`
- [x] 1.3 `test:e2e` script in `apps/web/package.json` → `c245170`
- [x] 1.4 Local run: **5 passed / 1 skipped** (ar data-step skipped — no dev data reachable in that window; en clicked through subject detail) → `c245170`

## 2. CI job

- [x] 2.1 `e2e` job in `.github/workflows/ci.yml`: fail-fast var check, build with placeholders + public Supabase Variables, `playwright install --with-deps chromium`, `next start` + curl wait loop, `test:e2e`, artifact upload on failure → `08a0a65`
- [x] 2.2 Repo Variables `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` set via `gh api` (values from local `.env`, never printed; public-by-design, Variables not Secrets) — verified present 2026-09-17
- [ ] 2.3 Job verified green on a PR (first PR after landing)
- [x] 2.4 Ruleset: PATCH returned 404 (token lacks ruleset write) → documented for owner in `.github/RULESET.md` (which was itself stale — synced to the 5 live checks); owner adds `e2e` after first report → `08a0a65`

## 3. Authenticated smoke runbook (owner-assisted, not CI)

- [x] 3.1 `checklists/authenticated-smoke.md` landed with the spec (`03cb100`); execution pending owner (and blocked on the Cloudinary env decision — env-sweep checklist)

## 4. Report

- [x] 4.1 G6.1 → done with commit hashes + pending-owner notes (first CI run, required-check promotion); changelog pass 3
