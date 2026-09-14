# Tasks: 006-admin-dashboard-shell

> Gates for every task: `pnpm typecheck` · `pnpm lint` (ratchet 52) · web vitest 20/20 · no NEW hardcoded-Arabic hits (baseline 276) · ar/en parity via shared registry types. Hard boundary: never touch `apps/web/src/components/desktop/**`, `apps/web/src/styles/desktop-shell.css`, desktop runtime gates.

## 1. Port

- [x] 1.1 Cherry-pick `feat/admin-shell` (`6efc325`) onto `feat/admin-dashboard-redesign`; resolve conflicts (page.tsx, AdminAnalyticsPage.tsx, Layout.tsx, index.css, tailwind.config.js, adminDashboard.json ×2) — main's i18n wins, branch's shell wiring wins — commit `64bec08`
- [x] 1.2 Verify: typecheck, lint, vitest, manual render of admin-dashboard under shell + public page unaffected
- [x] 1.3 Rename to brief contract: `AdminDashboardShell→AdminLayout`, `AdminSidebar→Sidebar`, `MobileDrawer→MobileNav` (update imports; keep AdminShellProvider/navigation/storage names) — commit `6549a8a`

## 2. IA restructure + Summaries retirement

- [x] 2.1 `lib/admin-shell/navigation.ts` groups → Overview & Analytics / Academic Content (Subjects & Lectures, Courses & Enrollments, Quizzes, News) / Moderation & System (Appeals, Page Management, ZANE placeholder) / Utilities
- [x] 2.2 Courses & Enrollments: one nav item → segmented Courses|Enrollments toggle view (doctor-gated) — `components/admin/CoursesEnrollmentsView.tsx`
- [x] 2.3 Remove summaries plumbing from `admin-dashboard/page.tsx` (hook, memo, handlers, case, modals); landing tab → `overview`
- [x] 2.4 Slim `useAdminFilters`: drop summaries input + `filteredSummaries`; keep appeals join read-only
- [x] 2.5 Retire to `.trash/` (mirrored paths): `components/SummariesTab.tsx`, `components/admin/AdminDashboardTabs.tsx`. **Correction:** `EditSummaryModal.tsx` was retired then restored — public `HomeClient.tsx` imports it (shared component, footprint table amended)
- [x] 2.6 Remove dead `adminDashboard` summaries keys (ar+en symmetric)
- [x] 2.7 Verify: typecheck (dangling imports fail), public home summaries section still works, appeals with summary context render — commit `319b009`

## 3. i18n contract (before delegate dispatch)

- [x] 3.1 Add ar+en keys: filterBar.*, trends.*, notifications.*, shell.{language, roleAdmin, roleDoctor, roleStudentAdmin}, tabs.{coursesEnrollments, zane, zaneSoon}, kpi.totalNews — commit `ec15042`
- [x] 3.2 Offload decision: written inline — key set too small (~25 keys) to justify a delegate round-trip; opencode last known billing-blocked. Surfaced in final report
- [x] 3.3 Registry parity verified via typecheck (shared ar/en type guards)

## 4. Delegate delta (gemini-3.8-flash-high via agy-delegate)

- [x] 4.1 Authorize: `trustedWorkspaces` entry + scoped `permissions.allow` write_file/replace rules added to `~/.gemini/antigravity-cli/settings.json` (lines shown to user before edit)
- [x] 4.2 Brief `context_output/briefs/admin-redesign-delta.txt`: goal, file map, conventions (RTL logical props, dark mode, ax tokens, zIndex), key contract, gates, report contract, never-commit, hard boundary
- [x] 4.3 Dispatch `relay.mjs --model gemini-3.8-flash-high --effort high` (background)
- [x] 4.4 Scope delivered: Topbar logo/notifications/profile · sidebar bottom utilities (language, theme, profile pill from session user, back-to-portal, sign-out) · `FilterBottomSheet` (trigger + portal sheet + pills) · `StatCard` + `PageHeader` · Overview 2×2/4-col grid with client-side micro-trend badges (neutral fallback, no RPC changes) · ≥44px targets · zero horizontal overflow @380px · framer-motion + reduced-motion — dispatch required 3 attempts: (1) `command(*)` denial → no-shell delta brief, (2) `write_file` glob denial (issue #614: globs unsupported in write rules) → **literal directory rules** `write_file(C:\…\masarx_next)`, (3) success
- [x] 4.5 Orchestrator review: diff vs brief verified per file; gates re-run; clean-code + thermo-nuclear checklists applied (verdict: approve — KpiCard→StatCard dedup, pure `calculateMicroTrends`, canonical helpers reused, no casts/sprawl); 5 review fixes (unused imports, duplicate import, `KpiChip`→`StatCardBadge` typing, `useCallback` for exhaustive-deps) folded into commit `866247f`

## 5. Verification & report

- [ ] 5.1 Browser probe 380/768/1280 × ar/en × dark/light (drawer trap, sheet swipe, sidebar persistence, grid, ZANE disabled, public unchanged); screenshots → `context_output/`; **blocked on one manual admin login** (all admin routes behind Supabase auth — prior shell pass hit the same wall, HTTP 307)
- [ ] 5.2 Final report: delegate decisions surfaced, retired files list, public-summaries follow-up flagged; branch left unmerged
