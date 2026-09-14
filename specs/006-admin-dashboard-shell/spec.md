# Feature Specification: Admin Dashboard Shell & IA Restructure (incl. Summaries Retirement)

**Feature Branch**: `feat/admin-dashboard-redesign`

**Created**: 2026-09-14

**Status**: Approved (plan mode — user ratified base strategy, IA tree, agy authorization on 2026-09-14)

**Input**: User brief "Admin Dashboard UI/UX Redesign & Layout Refactoring (Desktop + Mobile Responsive)" with screenshots (`sandbox/admin-screenshots/`, 2026-09-14), plus a follow-up Arabic directive: the standalone Summaries feature is retired from the admin dashboard ("لا أريد ميزة الملخصات") — its content belongs inside Subjects/Lectures as attachments; the sidebar IA follows an explicit user-provided tree.

## Context & Problem Statement

The admin dashboard (`apps/web/src/app/[locale]/admin-dashboard/`) renders inside the public marketing chrome: fixed 72px public header on top, `max-w-7xl` column, and the full public footer below (`components/Layout.tsx` has no admin isolation on `main`). Navigation is dual: the public navbar plus a horizontally scrolling `AdminDashboardTabs` strip that truncates at 380px to single letters ('S', 'N', 'A'). The "Global Filter" card (three stacked native `<select>`s) consumes >40% of the mobile viewport, its dropdowns collide with the action bar, and the standalone `AdminAnalyticsPage` is a self-styled page with no trend signals. Screenshots confirm the Summaries tab renders a permanently empty state ("No summaries…") — a legacy of the platform's original summary-upload concept, now visual debt on a platform whose content model is subjects → lectures → attached content, quizzes, and the ZANE assistant.

A prior shell rework exists on branch `feat/admin-shell` (commit `6efc325`): a complete collapsible sidebar shell (264px expanded / 72px rail), mobile drawer with focus trap + scroll lock, topbar, ⌘K palette, overview KPI tab, RTL logical properties, WCAG AA contrast — verified by typecheck + contrast audit, never merged, now ~46 commits behind `main`. This spec ports that work onto current `main` and completes the delta the user's brief adds.

**Hard boundary (parallel desktop agent, US3/US4)**: no file under `apps/web/src/components/desktop/**`, `apps/web/src/styles/desktop-shell.css`, or desktop runtime gates may be created, modified, or moved by this spec.

## Summaries Footprint Analysis (admin retirement scope)

Disposition of every admin-side reference to summaries. Public surfaces are **out of scope** and only flagged.

| Reference | Admin? | Disposition |
|---|---|---|
| `components/SummariesTab.tsx` (186 lines) | Admin-only (imported solely by `admin-dashboard/page.tsx`) | **Retire → `.trash/`** |
| `components/EditSummaryModal.tsx` (124) | Admin-only (sole consumer is `admin-dashboard/page.tsx`) | **Retire → `.trash/`** |
| `components/admin/AdminDashboardTabs.tsx` (123) | Admin-only; superseded by sidebar | **Retire → `.trash/`** |
| `useSummaries` hook | Shared — public `HomeClient.tsx`/`SummariesSection.tsx` consume it | **Keep** (public home still lists summaries) |
| `useAdminFilters.filteredSummaries` | Admin | **Adapt**: drop summaries input + `filteredSummaries`; keep year/dept/subject filtering for News/Quizzes/Appeals (appeals `content_id` join to summaries retained read-only so appeal context still renders) |
| `admin-dashboard/page.tsx` summaries plumbing (`MemoizedSummariesTab`, `handleUpdateSummaryStatus`, `handleEditSummary`/`handleSaveSummary`, `EditSummaryModal`, `case "summaries"`, default tab, loading gate) | Admin | **Remove** |
| `adminDashboard.json` `tabs.summaries` + summaries-specific keys | Admin | **Remove** (ar + en, parity enforced by shared registry types) |
| `AdminAnalyticsPage` "Top Content Types" copy | Admin | **Adapt** (merge into Overview & Analytics view; neutral copy) |
| `summaries` DB table + rows | Data | **Untouched** — no migration, no destructive change |
| Public: `summaries/[summaryId]`, `edit-summary`, `components/summaries/*`, `home/SummariesSection`, `course/CourseSummariesSection`, subject lecture content tabs, quizzes/AI/sitemap references, `summaries` namespace | Public | **Flag as follow-up** product decision (public display remains; admin can no longer manage it) |

## User Scenarios & Testing

### User Story 1 — Admin has its own responsive shell (Priority: P1)

An admin opens any admin view. On desktop (≥1024px) they see a collapsible left sidebar (264px expanded / 72px icon rail), a fixed top header, and a scrollable canvas — no public navbar, no marketing footer, no PWA/notification prompts. On mobile (<1024px) they see a compact top bar and open a dedicated admin drawer for navigation. The public site renders exactly as before.

**Independent Test**: Visit `/[locale]/admin-dashboard` at 1280px and 380px in ar and en; confirm shell chrome, absence of public header/footer, and unchanged public pages.

**Acceptance Scenarios**:

1. **Given** desktop width ≥1024px, **When** an admin view loads, **Then** the sidebar, top header, and canvas are visible and `h-dvh overflow-hidden` governs the frame; only the canvas scrolls
2. **Given** the collapsed sidebar state is toggled, **When** the admin reloads, **Then** the collapsed/expanded state persists (localStorage)
3. **Given** mobile width <1024px, **When** the admin opens the drawer, **Then** it slides from the inline-start edge, traps focus, closes on Escape/backdrop/navigation, and locks body scroll
4. **Given** any admin view in Arabic (RTL), **When** rendered, **Then** the sidebar occupies the inline-start edge and all spacing uses logical properties; mirrored in LTR
5. **Given** an admin view, **When** scrolled to the end, **Then** no marketing footer, PWA install, or notification prompt appears
6. **Given** a public page, **When** rendered, **Then** its chrome and behavior are unchanged

### User Story 2 — Sidebar IA matches the user's tree (Priority: P1)

The sidebar presents: **Overview & Analytics** (landing view for every role) · **Academic Content**: Subjects & Lectures, Courses & Enrollments (doctor-gated, one destination with a segmented Courses|Enrollments toggle), Quizzes, News · **Moderation & System**: Appeals, Page Management (doctor-gated), ZANE AI (disabled, "Coming Soon" badge) · **Bottom utilities**: language switch, theme toggle, admin profile pill (live session user + i18n role label), back-to-portal, sign-out. There is no Summaries item. Role gating matches today: doctor-only destinations hidden for other roles.

**Acceptance Scenarios**:

1. **Given** an admin (non-doctor) signs in, **When** the dashboard loads, **Then** Overview & Analytics is the active landing view and no doctor-only items are visible
2. **Given** a doctor, **When** the sidebar renders, **Then** Courses & Enrollments and Page Management appear, and the Courses & Enrollments view toggles between its two sections without a route change
3. **Given** any role, **When** the sidebar renders, **Then** ZANE AI is visible but disabled with a "Coming Soon" badge and activates nothing
4. **Given** the utilities section, **When** used, **Then** the language switch changes locale in place, the theme toggle flips dark/light, the profile pill shows the signed-in admin's name and localized role, and back-to-portal/sign-out navigate correctly
5. **Given** the sidebar, **When** inspected, **Then** no Summaries entry exists and no summaries view is reachable from admin navigation

### User Story 3 — Summaries retired from admin (Priority: P1)

The admin dashboard no longer loads, filters, renders, or mutates summaries. The `summaries` table, public summaries pages, and `useSummaries` (public home) are untouched. Appeals whose `content_type === "summary"` still render with context.

**Acceptance Scenarios**:

1. **Given** the admin codebase, **When** `pnpm typecheck` runs, **Then** no references to `SummariesTab`, `EditSummaryModal`, or `filteredSummaries` remain
2. **Given** an appeal targeting a summary, **When** the Appeals view renders, **Then** it still displays (context join reads, never writes)
3. **Given** the public home page, **When** rendered, **Then** the Summaries section still works
4. **Given** the database, **When** compared before/after, **Then** summaries rows are unchanged (no migration shipped)

### User Story 4 — Filter ergonomics (Priority: P2)

The three global selects collapse into a compact filter trigger (active-count badge). On mobile, activating it opens a bottom sheet: drag handle, swipe-to-dismiss, the three selects, and active filter pills (tap pill = clear that filter). Desktop keeps a compact inline filter card.

**Acceptance Scenarios**:

1. **Given** mobile 380px, **When** the filter UI renders, **Then** it occupies one compact row (≤56px) instead of >40% of the viewport
2. **Given** the sheet is open, **When** the user swipes it down, **Then** it dismisses; Escape and backdrop also close it
3. **Given** one or more filters active, **When** pills render, **Then** each shows its value and clears on tap; the trigger badge shows the active count
4. **Given** any filter control, **When** measured, **Then** its touch target is ≥44×44px

### User Story 5 — Overview & Analytics with micro-trends (Priority: KPI grid)

The merged Overview & Analytics view renders metric `StatCard`s in a 2×2 grid on mobile / 4-column on desktop (users, visits, clicks, assistant messages) with micro-trend badges derived client-side from data the existing `get_admin_analytics_summary` RPC already returns — a neutral state when no trend is computable. Recent Activity and Top Content sections follow, via `PageHeader` + `StatCard` components. No RPC or schema changes.

**Acceptance Scenarios**:

1. **Given** 380px, **When** the metrics render, **Then** they form a 2×2 grid with no horizontal overflow; at 1280px a 4-column row
2. **Given** period data available, **When** a metric renders, **Then** a micro-trend badge shows direction and delta; otherwise a neutral badge
3. **Given** the RPC returns zeros, **When** the view renders, **Then** empty states are explicit, not mock numbers

### User Story 6 — Topbar completeness (Priority: P3)

The admin topbar carries the Masar X mark, a notifications trigger, and a profile trigger on mobile per the brief; desktop keeps the collapse control and section label. z-index layering stays within the shell's own stacking context.

## Architecture & Design

**Ported from `feat/admin-shell` (cherry-pick `6efc325`)**, then renamed to the brief's component contract: `AdminDashboardShell→AdminLayout`, `AdminSidebar→Sidebar`, `MobileDrawer→MobileNav` (files under `apps/web/src/components/admin-shell/`, hooks under `apps/web/src/hooks/admin-shell/`, nav model `apps/web/src/lib/admin-shell/navigation.ts`). `AdminShellProvider` (useReducer + localStorage `ax.sidebar`) stays internal. `Layout.tsx` gains the `isAdminRoute` branch (bare `h-dvh overflow-hidden` wrapper — no Header/Footer/PWA/onboarding). `AdminCommandPalette` (⌘K) ships as part of the port. `--ax-*` CSS tokens + `.ax-*` motion utilities in `index.css`; `ax` colors/spacing/durations in `tailwind.config.js`.

**Delta (delegated to gemini-3.8-flash-high via agy-delegate)**: `Topbar` completion (logo/notifications/profile), sidebar bottom utilities, `FilterBottomSheet`, `StatCard`, `PageHeader`, Overview & Analytics grid, ZANE placeholder item, IA groups, mobile polish. i18n keys are written (ar+en) **before** dispatch and pinned in the brief; the delegate extends `adminDashboard` namespace only (no new-namespace registration: shared `i18n/index.ts` + web `request.ts` untouched).

**Behavior preservation**: server auth guard in `admin-dashboard/layout.tsx` untouched; client guards untouched; `useAdminFilters` contract shrinks but keeps shape for remaining consumers; appeals join becomes read-only on summaries; role gating preserved; public chrome untouched; `PageTransition` bypassed inside admin via the `isAdminRoute` branch (prevents remount of the shell).

## Test Specification

- **Gates per commit**: `pnpm typecheck`, `pnpm lint` (eslint ratchet 52), web vitest 20/20 (desktop smoke suite excluded — environmentally broken, pre-existing), ar/en message parity (registry types fail the build on drift).
- **i18n**: zero NEW hardcoded-Arabic source hits (baseline 276); retired keys removed symmetrically in ar+en.
- **Unit (vitest, where hooks are testable)**: `useAdminFilters` still defaults `year` from `activeSemester`, filters news/quizzes/appeals, appeals-without-context visible only when no filter is set.
- **Manual/browser probe**: 380/768/1280 × ar/en × dark/light — drawer focus trap + scroll lock, bottom-sheet swipe dismiss, sidebar persistence, 2×2 grid, ZANE disabled state, public pages unchanged.

## Atomic Execution Plan

1. `chore(spec): 006 admin dashboard shell & IA` — this spec.
2. `feat(web): port admin shell from feat/admin-shell` — cherry-pick + conflict resolution (expected: `admin-dashboard/page.tsx`, `AdminAnalyticsPage.tsx`, `Layout.tsx`, `index.css`, `tailwind.config.js`, `adminDashboard.json` ×2). Rule: main's i18n extraction wins, branch's shell wiring wins.
3. `refactor(web): rename admin shell to brief contract` — AdminLayout / Sidebar / MobileNav.
4. `refactor(web): retire admin Summaries tab` — footprint table executed; admin-only files → `.trash/` (mirrored paths); `useAdminFilters` slimmed; landing tab → overview.
5. `i18n(web): adminDashboard shell keys (ar+en)` — utilities, filter sheet, ZANE, trends, segmented labels; dead keys removed.
6. `feat(web): admin shell delta (delegate)` — FilterBottomSheet, StatCard/PageHeader, analytics grid, topbar + utilities polish. Reviewed by orchestrator: diff-vs-brief, gates re-run, clean-code + thermo-nuclear-code-quality-review, `--resume-last` rework loop.
7. Verification pass + final report; branch left unmerged for user review.

## Rollback

Safety tag `pre/admin-redesign-2026-09-14` (pre-work `main`). Per-commit reverts; the shell is also feature-switchable at `page.tsx` level (branch documented rollback B: render legacy content without the shell).
