# Admin Shell Migration Report

**Task:** port the verified Aurora Admin kit into the Masar X monorepo as an isolated, sidebar-centric admin dashboard shell.
**Target:** `apps/web/src/app/[locale]/admin-dashboard/**` + shared admin layout components.
**Status:** integrated, typecheck clean, tokens audited, desktop boundary intact.

---

## 0. What changed in this revision (fix pass)

The first integration pass shipped a shell that **rendered inside the public chrome** and looked collapsed. Three defects were found and fixed:

| Defect | Fix |
| --- | --- |
| Public `<Header/>` + `<Footer/>` + padded `max-w-7xl` `<main>` wrapped every admin route | Added an `isAdminRoute` branch to `components/Layout.tsx`: `/admin` and `/admin-dashboard` now render a bare `h-dvh w-full overflow-hidden` wrapper with no public chrome, no PWA/notification prompts, no onboarding gate. |
| Shell used `min-h-dvh` + `lg:ps-*` padding inside an `overflow-hidden` parent → content clipped, page looked empty | `AdminDashboardShell` rewritten as a true flex split: `flex h-full w-full overflow-hidden`, sidebar is an in-flow `shrink-0` column, topbar is `shrink-0`, `<main>` is `flex-1 overflow-y-auto` (the only scroll container). |
| `AdminSidebar` was `position: fixed`; `AdminTopbar` was `sticky` | Sidebar → `relative z-40 shrink-0`; Topbar → `shrink-0` row inside the flex column. |

## 1. Added files

### `apps/web/src/components/admin-shell/`

| File | Bytes | Role |
| --- | --- | --- |
| `AdminDashboardShell.tsx` | 3966 | Composition root: SkipLink → desktop sidebar → mobile drawer → topbar → `<main>`. Renders *inside* the existing server auth guard. |
| `AdminOverviewTab.tsx` | 8230 | Admin landing view: 4 KPI stat cards + 2 structured data tables bound to live hook data. |
| `AdminDataTable.tsx` | 6046 | Reusable accessible table: sr-only caption, `scope="col"` headers, search toolbar, "Add New" action, status badges, row actions, empty state. |
| `AdminShellProvider.tsx` | 5771 | `useReducer` store for collapsed / expandedGroups / mobileOpen / hydrated; SSR-safe hydration from localStorage `ax.sidebar`. |
| `AdminSidebar.tsx` | 5396 | Nav rail. `desktop` = in-flow column (264px / 72px rail); `mobile` = drawer content with close button. |
| `SidebarGroup.tsx` | 3836 | Collapsible group: `aria-expanded` + `aria-controls`, CSS grid-rows collapse, chevron rotation, auto-expand for the active view, `doctorOnly` filtering. |
| `AdminSidebarItem.tsx` | 4034 | One nav entry (`<button>` — views are state-driven, not URL-driven). `aria-current="page"`, start-side active indicator, 44px target, sr-only label + rail dot when collapsed. |
| `NavTooltip.tsx` | 4909 | Portaled rail tooltip. 300ms hover intent, instant on `:focus-visible`, `role="tooltip"` + `aria-hidden`, never `title`; hides on scroll/resize. |
| `MobileDrawer.tsx` | 3134 | Off-canvas drawer: `role="dialog"` + `aria-modal`, focus trap, Escape, backdrop click, scroll lock; closed = `invisible` + `pointer-events-none` (not tabbable). |
| `AdminTopbar.tsx` | 2365 | Sticky-free header row: hamburger (`aria-controls="ax-mobile-drawer"` + `aria-expanded`), section label, theme toggle. |
| `SkipLink.tsx` | 703 | First focusable element; targets `#ax-main-content`. |

### `apps/web/src/hooks/admin-shell/`

| File | Bytes | Role |
| --- | --- | --- |
| `useFocusTrap.ts` | 2871 | Strict Tab cycling, initial focus, focus restoration. |
| `useScrollLock.ts` | 764 | Body scroll lock with scrollbar-width compensation. |
| `useAdminTheme.ts` | 890 | Thin adapter over the app's existing `@/contexts/ThemeContext`. |

### `apps/web/src/lib/admin-shell/`

| File | Bytes | Role |
| --- | --- | --- |
| `navigation.ts` | 2691 | `AdminTabId` union (incl. `"overview"`), `AdminNavItem` / `AdminNavGroup`, `adminNavGroups`, `allGroupIds`. |
| `storage.ts` | 1152 | Crash-proof, SSR-safe `readJSON` / `writeJSON`. Never throws. |

## 2. Modified files

| File | Change |
| --- | --- |
| `apps/web/src/index.css` | Appended namespaced `--ax-*` token block (`:root` + `html.dark`) and `.ax-*` motion classes. One admin token retuned: light `--ax-border-strong-rgb` 135 146 166 → 133 144 164 for WCAG AA non-text contrast. |
| `apps/web/tailwind.config.js` | Added `colors.ax`, `spacing.ax-sidebar*`, `transitionDuration.ax-*`, `transitionTimingFunction.ax-standard`. |
| `apps/web/src/components/Layout.tsx` | **Admin isolation**: `isAdminRoute` branch renders a bare full-viewport wrapper for `/admin*` — no Header, Footer, PWA prompt, notification prompt, onboarding gate, or max-width padding. |
| `apps/web/src/app/[locale]/admin-dashboard/page.tsx` | Removed legacy `AdminDashboardTabs` import + render; wrapped the tree in `<AdminDashboardShell>`; added the `overview` case rendering `<AdminOverviewTab>`; default tab is now `overview`. |
| `packages/shared/src/messages/ar/adminDashboard.json` | Added `groups.*`, `shell.*`, `kpi.*`, `table.*`, `tabs.overview`. |
| `packages/shared/src/messages/en/adminDashboard.json` | Same, English. |

## 3. Token collision decisions

Every new token is prefixed `--ax-` and every Tailwind key lives under the `ax` namespace.

| Potential collision | Resolution |
| --- | --- |
| shadcn HSL vars (`--background`, `--accent`, `--muted`, `--border`) | Untouched. Admin tokens are RGB triplets under `--ax-*`. |
| `--brand-*` RGB triplets | Untouched. Admin accent is a separate `--ax-accent-rgb`. |
| Tailwind `colors.primary` | Left as-is. Admin uses `ax-primary`. |
| `zIndex.tooltip: 70` / `header: 40` / `sidebar: 45` | **Not** extended. The shell uses literal arbitrary values (`z-[70]`…`z-[90]`) scoped to its own stacking context. |
| `transitionDuration` / `transitionTimingFunction` | These blocks did not exist; added. Nothing pre-existing is replaced. |

**Net effect on existing user-facing styles: none.** The diff is additive.

## 4. RTL adaptations

Arabic is the default locale, so the shell uses logical properties only: `start-0` / `border-e` / `ps-*`; the drawer slides from the inline-start edge (`-translate-x-full` + `rtl:translate-x-full`); the active indicator is `start-0` + `rounded-e-full`; `NavTooltip` reads `document.documentElement.dir`; chevrons carry `rtl:rotate-180`; badges use `ms-auto`, labels `text-start`.

## 5. Theme integration (deliberate deviation)

The sandbox shipped its own `useTheme` that wrote `data-theme` on `<html>`. In Masar X that would be a **second theme system** competing with the existing `ThemeContext`. `useAdminTheme` is instead a pure adapter; no new storage key, no new attribute, no FOUC risk.

## 6. i18n

House rule I3: no hardcoded user-facing strings. Tab labels reuse `adminDashboard.tabs.*`. New key groups added to the **existing** `adminDashboard` namespace (no new namespace, so `MESSAGE_NAMESPACES` and the loader registry are untouched):

- `adminDashboard.groups.{content,learning,insights,system}`
- `adminDashboard.shell.{navigation,mainNavigation,sidebarLabel,openNavigation,closeNavigation,collapseSidebar,expandSidebar,toggleTheme,skipToContent}`
- `adminDashboard.kpi.{totalUsers,activeSummaries,pendingAppeals,quizzesTaken,placeholder}`
- `adminDashboard.table.*` (18 keys: search, addNew, columns, statuses, captions)
- `adminDashboard.tabs.overview`

Both `ar/` and `en/` were patched additively; a verification pass confirmed all pre-existing keys survived.

## 7. Verification evidence

### 7.1 `pnpm --filter web typecheck`

```
> web@0.5.6 typecheck
> tsc -p tsconfig.json --noEmit

TYPECHECK EXIT: 0
```

### 7.2 Tailwind emit audit (standalone CLI)

```
pnpm --filter web exec tailwindcss -c tailwind.config.js -i src/index.css -o <out> --minify
emitted: 162311 chars — all referenced ax utilities present
```

`ps-ax-sidebar` / `bg-ax-surface-hover` / `ring-ax-accent` appear behind variants and are emitted as `.lg\:…`, `.hover\:…`, `.focus\:…` — confirmed by selector inspection.

A first pass of this audit **caught a real defect**: `transitionDuration` / `transitionTimingFunction` were absent from `tailwind.config.js`, so `duration-ax-base` and `ease-ax-standard` were not generated. Both blocks were added.

### 7.3 Dev-server smoke test

Live `next dev` (Next.js 16.2.1, webpack), `:3000`:

```
/ar/login              HTTP 200
/ar/admin-dashboard    HTTP 307   (auth guard intact)
/en/admin-dashboard    HTTP 307
no compile errors in the dev log
```

The 307 to `/login` is the *desired* result: the server-side Supabase guard runs before the shell renders, proving the import did not break the route.

### 7.4 Contrast audit

Computed from the shipped `--ax-*` triplets in `apps/web/src/index.css` (WCAG 2.x relative luminance):

- **28/28 pairs meet WCAG AA** across light and dark.
- One real defect was found and fixed: light `--ax-border-strong-rgb` (135 146 166) reached 3.14:1 on white surface but only 2.93:1 on the canvas fill — below the 3:1 non-text minimum. Retuned to the minimal darkening that clears both: `133 144 164` → 3.22:1 / 3.00:1.
- Dark mode was already compliant (3.37:1 / 3.69:1) and is unchanged.

### 7.5 Boundary audit

```
git status --short -- apps/web/src/components/desktop apps/web/src/styles/desktop-shell.css
  M apps/web/src/components/desktop/workspace/StudyWorkspace.tsx   <- concurrent agent, NOT this task
```

No file under `apps/web/src/components/desktop/**` or `apps/web/src/styles/desktop-shell.css` was created, modified, or deleted by this task. The one `M` entry is a change made by the other agent working on the desktop shell.

## 8. Legacy-feature gap list

| Item | Status |
| --- | --- |
| `AdminDashboardTabs.tsx` | **Now unused.** File retained on disk (superseded by the sidebar). Safe to delete once signed off. |
| `AdminDashboardHeader` filter card | Kept as page content, rendered *inside* the shell. |
| KPI `totalUsers` | Renders an em dash: there is no client-accessible profile-count hook. `summaries`, `appeals`, `quizzes` counts are live. |
| Badge live counts | `AdminSidebarItem` accepts a `badges` prop; `page.tsx` does not pass live data yet. Structural only. |
| Screenshots | **Not achievable.** No browser automation is available and every admin route is behind Supabase auth. Evidence is HTTP status + emitted CSS + compiled-chunk + typecheck output. |

## 9. Rollback

### Option A — working-tree revert (no commits made)

```bash
cd C:/programming/WEB_Development/projects/masarx_next
git checkout -- \
  'apps/web/src/app/[locale]/admin-dashboard/page.tsx' \
  apps/web/src/components/Layout.tsx \
  apps/web/src/index.css \
  apps/web/tailwind.config.js \
  packages/shared/src/messages/ar/adminDashboard.json \
  packages/shared/src/messages/en/adminDashboard.json
rm -rf apps/web/src/components/admin-shell \
       apps/web/src/hooks/admin-shell \
       apps/web/src/lib/admin-shell \
       docs/admin-shell-migration.md
```

### Option B — disable the shell without reverting

In `page.tsx`, replace the `<AdminDashboardShell …>` open/close tags with the original plain `<div>`, restore the `AdminDashboardTabs` import + render, and drop the `AdminOverviewTab` case. Shell files can stay on disk unused.

### Not affected by rollback

i18n keys are additive (inert). The `--ax-*` CSS block and the `ax` Tailwind namespace are inert until referenced.

## 10. Assumptions

1. The legacy admin dashboard selects views through React state (`activeTab`), not URLs — so sidebar entries are `<button>`s, not `<Link>`s.
2. The server-side auth/role guard in `admin-dashboard/layout.tsx` stays authoritative; the shell is presentation-only.
3. No destructive git operations were performed (house rule I8). The working tree already contained a concurrent agent's changes; this task added no branch switch, no commit, and no deletion.

