# Tasks: 009_mvp-launch-ops-hardening

> Gates for every task: `pnpm typecheck` · `pnpm lint` (ratchet 52 warnings) · `pnpm -r --if-present test` · `bash .github/scripts/check-translations.sh` · `node .agents/agents/verify_i18n.mjs` (no NEW hardcoded-Arabic hits). Docs-only commits run `check-doc-links.sh` instead of the code gates. Hard boundary: never stage the owner's uncommitted files (`Footer.tsx`, `LanguageToggle.tsx`, `admin-shell/Sidebar.tsx`, `FooterDeveloper.tsx`, `en/aiAssistant.json`, build artifacts) — explicit-path `git add` only.

## 1. Spec landing

- [ ] 1.1 `docs/MVP_REPORT.md` committed: `docs: add MVP readiness report (pass 2)`
- [ ] 1.2 specs/009 + specs/010 committed: `docs(specs): land 009 MVP-launch ops hardening + 010 e2e study-flow smoke specs`

## 2. RLS audit tool + first run (G3.1)

- [ ] 2.1 `scripts/audit-rls.mjs`: read-only audit (RLS enabled per public table, policy dump, subject_lectures read-policy check), `.env` loader per seed-mvp-launch pattern, writes `docs/audits/rls-audit-<date>.md`
- [ ] 2.2 Run against prod DB; audit doc committed in same commit: `feat(scripts): add read-only RLS audit tool`

## 3. Retire one-off RLS script (G3.2)

- [ ] 3.1 Gated on 2.2 passing + policy text matching migration 007 → `mv .openclaw-rls-open.mjs .trash/` → commit `chore(repo): retire one-off RLS script to .trash/`

## 4. Runbooks: env sweep, AI smoke, role propagation (G3.5, G2.1, G3.4)

- [ ] 4.1 Execute `checklists/env-sweep.md` (vercel env ls diff vs .env.example; record result)
- [ ] 4.2 Owner-assisted: AI chat round-trip + rate-limit rejection in prod (`ai_chat_disabled` confirmed); record in checklist
- [ ] 4.3 Owner-assisted: admin demotion propagation test; record in `checklists/role-propagation.md`
- [ ] 4.4 Commit results: `docs(specs): record 009 runbook results`

## 5. Dependabot (G3.6)

- [ ] 5.1 `.github/dependabot.yml` (npm `/` recursive + github-actions, weekly, reviewer fotedev, minor/patch group) → commit `chore(ci): add dependabot config`

## 6. Route hygiene (G1.4, G1.5)

- [ ] 6.1 `/add`: i18n-router redirect (locale-prefixed target) + loader string from messages (no new keys needed if `common.loading` exists) — verify_i18n count must go DOWN
- [ ] 6.2 `الرئيسية`: grep src+sitemap for references → redirect page to `/home` if referenced, else `.trash/` move (both pre-approved)
- [ ] 6.3 Gates (typecheck/lint/test/translations/verify_i18n) → commit `fix(web): localize /add redirect and retire الرئيسية route`

## 7. Sentry cleanup (G7.1)

- [ ] 7.1 DSN check (env files + vercel env ls); if configured, one test error event confirmed
- [ ] 7.2 Retire `api/sentry-example-api/` → `.trash/` (mirrored path) + git-add deletion → commit `chore(web): retire sentry-example-api route`

## 8. Report pass 3

- [ ] 8.1 Flip G3.1, G3.2, G3.5, G2.1, G3.4, G3.6, G1.4, G1.5, G7.1 states per evidence; changelog row → commit `docs(mvp-report): pass 3`
