# Spec 007 — Tasks

Derived from `sandbox/brainstorm-chat-v1.txt` reconciliation (2026-09-10). Spec 005's own
ledger is authoritative for its task IDs; this list covers the *remaining* work that session
left behind, plus the reconciliation actions already done.

## A. Reconciliation (done 2026-09-10)

- [x] A1 `specs/007-desktop-shell-architecture/spec.md` — transcript reconciled, ADRs recorded
- [x] A2 Backfill `specs/005/tasks.md`: T003, T010–T015, T020–T024 checked with evidence
      notes (files on disk, commits 2152fbc/04053f1/9722e42/84ca992, workspace typecheck
      green 2026-09-10). Verify-gate tasks T016/T025 stay open → task B1.
- [x] A3 Staleness banner on `specs/005/handoff.md` (it predates US3 completion)

## B. Consolidated verification pass (closes spec 005 T016 / T025 / T052 / T053)

- [ ] B1 GATE-VISUAL for US1+US2 in the shell: 3-column workspace on
      `/[locale]/subjects/[subject]` (lecture switch swaps reader in place, assistant scoped),
      no selection/drag-ghost/root-scroll (five-gesture checklist)
- [ ] B2 Browser-regression gate (FR-011): marker attribute absent, Header + Footer present,
      byte-identical browser behavior
- [ ] B3 Full-suite regression: GATE-TYPE-DESKTOP, GATE-TYPE-WEB, GATE-TEST-DESKTOP
- [ ] B4 Record evidence in `specs/005-desktop-study-workspace/verification.md` (gate outputs
      + observed screen per FR-027) — the file spec 005 T053 asks for and no session ever wrote

## C. Spec 005 Phase 4 — dev-environment safeguards (US4, all open)

- [ ] C1 T030 `predev` port-clear step for `apps/web` (extend existing `inject-sw-version.mjs`
      predev; do not replace)
- [ ] C2 T031 Confirm/extend `scripts/clean.mjs` covers `.next`, `out`, `node_modules/.cache`
- [ ] C3 T032 `sw-register.ts`: actively unregister stale Service Workers outside production
- [ ] C4 T033 Add the FR-027 visual-verification rule to `AGENTS.md`
- [ ] C5 T034 Verify stale-port startup binds the expected port

## D. Spec 005 Phase 6 — polish (open)

- [ ] D1 T050 Responsive collapse order (assistant first, lecture list second)
- [ ] D2 T051 Locale switch swaps column edges without losing lecture selection
- [ ] D3 (folded into B3/B4)

## E. New from this reconciliation

- [ ] E1 Headless visual-regression test (from the session's elicitation): Playwright/Puppeteer
      asserting the 3-column geometry + single 32px titlebar + absence of `.z-header` in a
      forced-desktop context — replaces manual CDP/screenshot sessions as the T046 gate
- [ ] E2 Document the HMR-first desktop dev loop (dev server + forced desktop marker; package
      with `electron-builder --dir` only for gates) in `docs/agents/` so agents stop
      repackaging per CSS change
- [ ] E3 Optional: replace the `.z-header` hydration flash-guard with a cleaner mechanism,
      only with before/after flash evidence (until then, keep the rule — see spec §2)
- [ ] E4 After Phase 6: re-run the desktop audit (`docs/audits/desktop-app-report-2026-09-08/`)
      — pre-existing debt: Electron 32 EOL (invariant I6 pins exact; plan the upgrade),
      dead auth/cache subsystems flagged in the audit

## Not doing (recorded decisions)

- ❌ Splitting the monorepo (ADR-2)
- ❌ Creating an "Assistant & Document Sync" US4 — mislabel; panel is US1/T014, real US4 is §C
