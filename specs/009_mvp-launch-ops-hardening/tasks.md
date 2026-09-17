# Tasks: 009_mvp-launch-ops-hardening

> Gates for every task: `pnpm typecheck` · `pnpm lint` (ratchet 52 warnings) · `pnpm -r --if-present test` · `bash .github/scripts/check-translations.sh` · `node .agents/agents/verify_i18n.mjs` (no NEW hardcoded-Arabic hits). Docs-only commits run `check-doc-links.sh` instead of the code gates. Hard boundary: never stage the owner's uncommitted files (`Footer.tsx`, `LanguageToggle.tsx`, `admin-shell/Sidebar.tsx`, `FooterDeveloper.tsx`, `en/aiAssistant.json`, build artifacts) — explicit-path `git add` only.

## 1. Spec landing

- [ ] 1.1 `docs/MVP_REPORT.md` committed: `docs: add MVP readiness report (pass 2)`
- [ ] 1.2 specs/009 + specs/010 committed: `docs(specs): land 009 MVP-launch ops hardening + 010 e2e study-flow smoke specs`

## 2. RLS audit tool + first run (G3.1)

- [x] 2.1 `scripts/audit-rls.mjs`: read-only audit (RLS enabled per public table, policy dump, subject_lectures read-policy check), `.env` loader per seed-mvp-launch pattern, writes `docs/audits/rls-audit-<date>.md`
- [x] 2.2 Run against prod DB — **PASS: 48/48 tables RLS-enabled, 170 policies, 9 anon-write warnings all reviewed-safe** (details in `checklists/rls-audit.md`; full report stays local — `docs/audits/` is gitignored by design). Notes: `subject_lectures` read policy is `TO public` (superset of migration 007's role list — cosmetic drift); prod evolved far beyond migration history (170 vs 41 policies) — reconciliation is post-MVP

## 3. Retire one-off RLS script (G3.2)

- [x] 3.1 Gate passed (audit PASS + policy contract matches) → `.openclaw-rls-open.mjs` moved to `.trash/` (file was untracked; no git operation needed)

## 4. Runbooks: env sweep, AI smoke, role propagation (G3.5, G2.1, G3.4)

- [x] 4.1 Executed `checklists/env-sweep.md` — **GAPS FOUND**: 2 real missing vars (Cloudinary public pair — no source of truth anywhere, `getCloudinaryUrl` hard-throws), 2 likely-intentional absences (`AI_GATEWAY_API_KEY` = the `ai_chat_disabled` gate, Puter fallback primary; `VERCEL_MCP_BYPASS_SECRET` = MCP fail-closed). `SUPABASE_SERVICE_ROLE_KEY` ✅ present. Owner action list recorded in the checklist
- [ ] 4.2 Owner-assisted: AI chat round-trip + rate-limit rejection in prod (expected via Puter fallback); record in checklist
- [ ] 4.3 Owner-assisted: admin demotion propagation test; record in `checklists/role-propagation.md`
- [x] 4.4 Commit results: `docs(specs): record 009 runbook results`

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
