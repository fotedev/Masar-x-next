# Tasks: 006-admin-dashboard-shell

> Gates for every task: `pnpm typecheck` · `pnpm lint` (ratchet 52) · web vitest 20/20 · no NEW hardcoded-Arabic hits (baseline 276) · ar/en parity via shared registry types. Hard boundary: never touch `apps/web/src/components/desktop/**`, `apps/web/src/styles/desktop-shell.css`, desktop runtime gates.

## 1. Port

- [ ] 1.1 Cherry-pick `feat/admin-shell` (`6efc325`) onto `feat/admin-dashboard-redesign`; resolve conflicts (page.tsx, AdminAnalyticsPage.tsx, Layout.tsx, index.css, tailwind.config.js, adminDashboard.json ×2) — main's i18n wins, branch's shell wiring wins
- [ ] 1.2 Verify: typecheck, lint, vitest, manual render of admin-dashboard under shell + public page unaffected
- [ ] 1.3 Rename to brief contract: `AdminDashboardShell→AdminLayout`, `AdminSidebar→Sidebar`, `MobileDrawer→MobileNav` (update imports; keep AdminShellProvider/navigation/storage names)

## 2. IA restructure + Summaries retirement

- [ ] 2.1 `lib/admin-shell/navigation.ts` groups → Overview & Analytics / Academic Content (Subjects & Lectures, Courses & Enrollments, Quizzes, News) / Moderation & System (Appeals, Page Management, ZANE placeholder) / Utilities
- [ ] 2.2 Courses & Enrollments: one nav item → segmented Courses|Enrollments toggle view (doctor-gated)
- [ ] 2.3 Remove summaries plumbing from `admin-dashboard/page.tsx` (hook, memo, handlers, case, modals); landing tab → `overview`
- [ ] 2.4 Slim `useAdminFilters`: drop summaries input + `filteredSummaries`; keep appeals join read-only
- [ ] 2.5 Retire to `.trash/` (mirrored paths): `components/SummariesTab.tsx`, `components/EditSummaryModal.tsx`, `components/admin/AdminDashboardTabs.tsx`
- [ ] 2.6 Remove dead `adminDashboard` summaries keys (ar+en symmetric)
- [ ] 2.7 Verify: typecheck (dangling imports fail), public home summaries section still works, appeals with summary context render

## 3. i18n contract (before delegate dispatch)

- [ ] 3.1 Add ar+en keys: sidebar utilities (profile role, back-to-portal, sign-out confirm), filter sheet (trigger, title, apply, clear-all, active pills), ZANE (label, comingSoon), trends (up/down/flat, vsPrevious), courses/enrollments segmented labels, notifications (empty)
- [ ] 3.2 Offload attempt: opencode `muse-spark-1.3` for JSON authoring (parallel); fallback inline (memory: billing-blocked)
- [ ] 3.3 Verify registry parity passes; commit

## 4. Delegate delta (gemini-3.8-flash-high via agy-delegate)

- [ ] 4.1 Authorize: add `trustedWorkspaces` entry + scoped `permissions.allow` write_file rule to `~/.gemini/antigravity-cli/settings.json` (show user exact lines)
- [ ] 4.2 Brief `context_output/briefs/admin-redesign-delta.txt`: goal, file map, conventions (RTL logical props, dark mode, ax tokens, zIndex), key contract, screenshots + DESIGN-HANDOFF.md refs, gates, report contract, never-commit, hard boundary
- [ ] 4.3 Dispatch `relay.mjs --brief … --cd <repo> --model gemini-3.8-flash-high --effort high` (background); wait for `result.json`
- [ ] 4.4 Scope: Topbar logo/notifications/profile · sidebar bottom utilities (language, theme, profile pill from session user, back-to-portal, sign-out) · `FilterBottomSheet` (trigger + portal sheet + pills) · `StatCard` + `PageHeader` · Overview 2×2/4-col grid with client-side micro-trend badges (neutral fallback, no RPC changes) · ≥44px targets · zero horizontal overflow @380px · framer-motion + reduced-motion
- [ ] 4.5 Orchestrator review: diff vs brief (`touchedFiles`), re-run gates, clean-code + thermo-nuclear-code-quality-review, `--resume-last` rework loop, atomic commits

## 5. Verification & report

- [ ] 5.1 Browser probe 380/768/1280 × ar/en × dark/light (drawer trap, sheet swipe, sidebar persistence, grid, ZANE disabled, public unchanged); screenshots → `context_output/`; needs one manual admin login
- [ ] 5.2 Final report: delegate decisions surfaced, retired files list, public-summaries follow-up flagged; branch left unmerged
