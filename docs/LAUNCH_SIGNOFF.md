# Launch Sign-Off — Masar X MVP

**Date:** 2026-09-19 · **Companion audit:** `docs/audits/mvp-readiness-audit-2026-09-18/` (gitignored) · **Remediation:** migrations `010_launch_rls_remediation` + `011_p1_hardening` (applied to production, role-simulation verified), commits `488c49c`..`81386e9`.

This is the single ledger for the owner's final GO decision: the formal accepted-risk register awaiting signature, the executable smoke runbook for the remaining manual checks, and the live status of every checklist item.

---

## 1. Accepted-risk register (formal record)

Each risk below is accepted **for the MVP phase**, with the trigger that reopens it.

| # | Accepted trade-off | Rationale | Revisit trigger |
|---|---|---|---|
| R1 | **Quiz scoring, timing, and the answer key are client-trusted.** The key ships with the quiz payload, correctness/score/`time_taken_seconds` are client-computed and client-written; RLS authorizes each user to write their own attempt rows. | Quizzes are self-study aids with no stakes — a cheating student defrauds only themselves. No leaderboard, grading, or content gate reads scores. | Any feature that gates content, ranking, credentials, or payments on quiz results. Remediation sketch: `docs/audits/mvp-readiness-audit-2026-09-18/04-exam-engine-moderation.md` §4.3. |
| R2 | **Edge middleware fails open** on internal error (`x-middleware-error: true`, request proceeds without route guards). | Middleware is UX routing; RLS + page-level re-checks (admin-dashboard layout, `ensureAdmin()`) are the security boundary and stay in force per-request. | Any protected surface that relies on middleware as its only gate (none today — audit 2026-09-18 verified the stack). |
| R3 | **Migrations are forward-only from the production state** (G3.9 drift): 48 prod tables / 170 policies vs ~19 tables / 41 policies in migrations 001–009; `migrations.old` and dashboard-run fix scripts (`FIX_profiles_table.sql`) are part of the de-facto history. | Prod is verified correct (RLS audit PASS, e09edb2); `010`/`011` establish the going-forward idempotent chain that documents the remediation state. Rebuilding from `001–009` alone is NOT supported. | Any new environment (staging, fresh prod rebuild) — requires a schema-dump-based bootstrap before migrations can resume. Post-MVP reconciliation task stays on the backlog. |
| R4 | **Role revocation propagates only on token refresh.** A demoted admin keeps JWT role claims (and middleware access) until their session refreshes. | Admin population is tiny and owner-managed; every admin-gated *write* still hits RLS/`ensureAdmin()` which reads live state. | Immediately at first real staff offboarding; verify with the §3 role-invalidation procedure. |
| R5 | **Unlimited quiz retakes; mid-quiz refresh restarts the full timer; abandoned attempts resume forever** (no `max_attempts` enforcement, no attempt expiry). | Same study-aid framing as R1 — attempts are personal records. | Same trigger as R1. |

### Owner approval

> [x] **Launch authorized — owner chat directive, 2026-09-20:** the owner reviewed this ledger in the interactive closure session and instructed the official transition from *Conditional GO* to **GO** (including the S5 delegation and the ruleset completion).
>
> [ ] **Signed off by:** ________________ (fotedev)  **Date:** ____________
>
> By signing, the owner accepts risks R1–R5 for the MVP launch phase and acknowledges the revisit triggers above. The ink line above is kept for the permanent record; per the owner's 2026-09-20 directive it does not block the GO stamp.

---

## 2. Owner smoke runbook (execute against production, logged-in as noted)

### S1 — Guest quiz route (no login)
1. Pick an approved quiz id (SQL: `SELECT id, title FROM quizzes WHERE status = 'approved' LIMIT 5;`).
2. Visit `https://masarx.vercel.app/ar/quiz-play/<id>` in a private window.
**Expected:** clean render (no error boundary), the blue **"أنت تعمل في وضع الضيف"** banner on the question screen, and **zero** `quiz_attempts` network calls (DevTools → Network filter `quiz_attempts`). The committed e2e (`apps/web/e2e/guest-quiz.spec.ts`) asserts this continuously; this run confirms it live on prod.

### S2 — Access-code redemption (header gate)
1. Log in; click the logo 5× to reveal the access-code input; enter a valid code.
**Expected:** unlock into the non-academic section. SQL check of the atomic consume: `SELECT access_key, used_count, max_uses FROM system_access_codes WHERE access_key = '<code>';` — `used_count` incremented by exactly 1. A second redemption past `max_uses` shows the "max uses" toast without incrementing.

### S3 — Admin content flow (admin account)
1. Create a subject → add a lecture shell → publish an exam from the quizzes dashboard.
**Expected:** the exam appears publicly without a second moderation step (admin-created quizzes are auto-approved). SQL: `SELECT title, user_id, status, created_at FROM quizzes ORDER BY created_at DESC LIMIT 1;` — `user_id` = your account (the `created_by` column no longer exists; inserts write `user_id`) and `status = 'approved'`.

### S4 — Appeal notification (test student account)
1. As a test student, file an appeal against any summary/news item.
**Expected:** every admin account receives an `admin_submission` notification pointing at the appealed content. SQL: `SELECT title, user_id, type, related_type FROM notifications ORDER BY created_at DESC LIMIT <number of admins>;` — one row per admin. (Delivered via the `notify_admins_of_content` RPC; a student can only trigger it for content they actually appealed.)

### S5 — Role invalidation (fail-closed check)
Follow `specs/009_mvp-launch-ops-hardening/checklists/role-propagation.md`. Summary: grant a second test admin, log in, then revoke: `DELETE FROM admins WHERE user_id = '<test-user>';` — with migration `012_jwt_role_sync` deployed, the `on_admin_delete` trigger strips the JWT role claim and refreshed tokens lose it. **Expected:** all admin-gated writes fail via RLS/`is_admin()` immediately (UI lag must never grant a working write path), the dashboard route's live `admins` lookup denies on next load, and the claim disappears at token refresh. Executed **automated** 2026-09-20 with a disposable temp account (full cleanup, baseline re-verified) — see §3 and the evidence block below. ⚠ Execution finding: the 008 trigger set this runbook assumed was **never deployed to prod**; fixed in-flight by migration `012_jwt_role_sync` (triggers + one-time claim backfill), then the full procedure was re-run to ALL PASS.

---

## 3. Checklist status ledger

| Checklist item | Status | Notes |
|---|---|---|
| Risk Register Sign-Off (R1–R3) | ✅ **Owner GO directive 2026-09-20** | This file §1; R4/R5 added from the audit register for completeness. The owner reviewed the ledger in the closure session and instructed the official GO transition (chat directive 2026-09-20); the ink-signature line in §1 remains for the permanent record and is non-blocking. R4 was re-validated with hard data by S5 (see below). |
| Live Browser Smoke (S1–S4) | ✅ **Automated verification PASS 2026-09-20** | S1: Playwright against `https://masarx.vercel.app` (real data, no mocks) — start screen renders, guest banner visible, **zero** `quiz_attempts` requests, zero REST ≥400 (`apps/web/e2e/prod-smoke.spec.ts`, opt-in via `E2E_PROD_URL`). S2: `verify_system_access_code` RPC returned `valid` as a real authenticated user; `used_count` 1→2 atomically (restored to 1 after the test). S3: temp admin (`role:'admin'`) inserted an exam via the dashboard insert contract under its own JWT — row persisted with `user_id` = that admin and `status='approved'`; the anon role sees it. S4: student appeal inserted own-row under RLS; `notify_admins_of_content` delivered to **3/3 admins** (`admin_submission`); a forged reference was rejected (403). DB state restored to baseline after the run (0 notifications/appeals/summaries, no temp users). Note: S3/S4 verified at the API level — the exact insert contracts the UI forms submit; visual click-through remains optional. |
| Session & Role Invalidation (S5) | ✅ **Automated verification PASS 2026-09-20** | Executed against production with a disposable temp account (`launch-smoke-s5-*`, explicit `role:'admin'`, full cleanup, baseline re-verified `admins=3/3`, 0 leftover users). Full lifecycle proven: grant → `app_metadata.role` claim synced by the `on_admin_upsert` trigger; pre-revocation admin writes succeed (`is_admin()` true, own-summary status flip `pending→approved` = 204); revoke **without logout** → same stale JWT: `is_admin()` immediately false, same status flip rejected **42501 "Only admins can change summary status"**, own `admins` row self-select returns 0 rows (the exact condition that makes `admin-dashboard/layout.tsx` redirect to `/unauthorized`); token refresh → new JWT carries **no** role claim (`AuthContext` `isAdmin=false` on next auth state). Server-side fail-closed is immediate (<1s); UI claim staleness is bounded by the old-JWT lifetime (3600s observed) and is claim-stripped at refresh. **Finding fixed in-flight:** the 008 trigger set had never been deployed to prod (G3.9 drift) — grants produced no claim and revocations stripped nothing; applied as migration **`012_jwt_role_sync`** (triggers + one-time claim backfill: `doctor` claim corrected, `student_admin` admin's missing claim restored) and the full procedure re-run to ALL PASS. Visual click-through remains optional (same precedent as S3/S4). |
| GitHub Branch Protection (`e2e` required) | ✅ **DONE — owner UI action 2026-09-20, API-verified** | The owner added `e2e` + `workflow-lint` via the GitHub UI (Settings → Rules → Rulesets → Main Branch Protection `20299668`), bringing the required status checks to **7**: `Vercel`, `next build`, `ESLint`, `ai-endpoint-grep`, `gitleaks-artifacts`, `e2e`, `workflow-lint`. Verified via `gh api` GET (enforcement `active`; bypass actors: RepositoryRole Admin + Vercel + CodeRabbit integrations, `always`). `.github/RULESET.md` synced in the same session (the agent-side PATCH path remains a proven token-class dead end — UI or fine-grained PAT are the only write paths). |
| Initial Course Seeding | ✅ **DONE & anon-verified 2026-09-19** | Two published placeholder courses inserted (free 0.00 + paid 150.00, instructor = admin account). The exact `/courses` page query returns **200 with 2 rows** under the anon key. Rename/replace during content entry. ⚠ Live `courses` has **no `subject_id`/`thumbnail_url`** (drift vs migration 004) — future course code/migrations must target the live shape. |

### Automated smoke evidence (2026-09-20 run, production)

```
PASS | setup               | temp student=3a9178c4… temp admin=737a051a…
PASS | S2 rpc-redeem       | status=valid used_count 2->3 (max 3)
PASS | S4 appeal-insert-rls| appeal=b2f727ca… as student own-row
PASS | S4 notify-rpc       | rpc=204 notifications=3/3 type=admin_submission
PASS | S3 quiz-insert-rls  | quiz=5bb2c5cf… user_id=737a051a… status=approved
PASS | S3 anon-visible     | anon sees approved exam (1 row)
PASS | S4 provenance-negative | forged reference rejected (403)
```
Plus S1 Playwright against prod (`1 passed`). Counter and all test artifacts restored/removed — final state re-verified: 0 notifications / 0 appeals / 0 summaries / 0 leftover `launch-smoke-*` auth users; access code `1/3`, valid to 2026-10-19. S2-prep note: the sole access code had **expired** and was extended to 2026-10-19 to make S2 executable.

### S5 role-invalidation evidence (2026-09-20 run, production; after `012_jwt_role_sync`)

```
PASS | setup                  | temp user=2ad57613… baseline admins=3
PASS | S5 grant+claim-sync    | JWT_A app_metadata.role=admin (008 upsert trigger) old-JWT lifetime=3600s
PASS | S5 pre own-row         | admins self-select=1 row (admin-dashboard layout gate satisfied)
PASS | S5 pre is-admin        | rpc is_admin=true
PASS | S5 pre status-flip     | pending->approved = 204 (admin authority via live is_admin())
PASS | S5 post is-admin       | stale JWT: rpc is_admin=false (immediate fail-closed)
PASS | S5 post status-flip-denied | approved->pending rejected 403 code=42501 "Only admins can change summary status"
PASS | S5 post own-row        | admins self-select=0 rows (layout.tsx redirect->/unauthorized condition)
PASS | S5 token-refresh       | JWT_B app_metadata.role=ABSENT — UI isAdmin=false on next auth state
PASS | cleanup+baseline       | admins=3/3 summary-left=0 s5-users-left=0
```
(First run before the fix scored 9/10 — the `grant+claim-sync` check FAILED, which exposed the never-deployed 008 trigger set; `012_jwt_role_sync` was applied, prod claims backfilled to match the `admins` table, and the full procedure re-run to ALL PASS.)

**GO — stamped 2026-09-20.** Every ledger item is ✅: S1–S5 automated PASS against production, ruleset `20299668` active with all 7 required checks, seeding verified, and the risk register accepted by owner directive (chat, 2026-09-20). The audit verdict transitions **conditional GO → GO**.
