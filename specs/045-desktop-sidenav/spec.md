# Spec 045 — Desktop Sidenav Rail

> | | |
> |---|---|
> | Branch | `feat/045-desktop-sidenav` |
> | Created | 2026-11-12 |
> | Status | Approved (owner, 2026-11-12 — plan approval in session; owner report "but there's no side menu" on the fixed desktop build) |
> | Type | Product change — reverses one slice of spec 005 FR-019; no new components |
> | Baseline | `main` `53e8c5f` |

## Problem

Spec 005 (US2/US3, FR-019) skipped the entire web nav shell inside the Electron
desktop shell: `Layout.tsx` unmounts `AppNav` when `useIsDesktopRuntime()` is
true, and `desktop-shell.css` carried a belt-and-suspenders `.z-header`
display:none kill-switch. At the time the web chrome was the marketing header.
PR #183 (2026-11-07) replaced that header with the collapsible sidenav rail
(64px↔240px, logo-toggled, no auth gating, zero guest fetches) but kept the
desktop gate untouched — so the packaged desktop app now has **no navigation at
all** beyond the home page's four quick-link cards. The owner reported the
missing side menu on the fixed v0.6.0 build (2026-11-12).

## Decision

Render the existing web sidenav rail inside the desktop shell. Reuse — no new
desktop nav component; the rail is hydration-safe (`ssr:false`), auth-agnostic,
and shares its width with the content through `--sidenav-w`. Footer, PWA
install prompt, and notification prompt **stay desktop-hidden** (unchanged
FR-019 scope); admin routes keep their own full-viewport shell.

## Scope

**In:**

1. `apps/web/src/components/Layout.tsx` — render `AppNav` in desktop mode
   (`{!isAdminRoute && <AppNav />}`); add the `lg:ps-[var(--sidenav-w,4rem)]`
   content offset + padding transition to the desktop root class.
2. `apps/web/src/styles/desktop-shell.css` — remove the obsolete `.z-header`
   display:none kill-switch (its target, the marketing header, was deleted in
   PR #183; the class now belongs to the rail itself). Replace with a
   `top: var(--masarx-titlebar-h)` offset under the desktop marker so the
   fixed rail starts below the 32px drag-region titlebar — otherwise the
   rail's logo button sits under the drag strip and clicks drag the window.
3. `apps/web/e2e/sidenav.spec.ts` — first sidenav coverage in the suite:
   web-mode rail behavior (collapse/expand/persist/below-lg top bar) and a
   desktop-mode simulation via a `window.masarxDesktop` init-script stub
   asserting the rail renders, sits below the titlebar, and web-only chrome
   (Footer) stays hidden.

**Out:**

- A bespoke desktop nav in `CustomTitlebar` (future option, not needed while
  the rail serves both shells).
- Footer/PWA/notification prompts in desktop (still FR-019).
- Admin-route chrome (admin shell owns the viewport, unchanged).

## Constraints

- FR-011 holds: all desktop deltas stay under `[data-masarx-desktop="true"]`;
  a plain browser tab renders byte-for-byte as before.
- The rail's logo toggle must never land in the titlebar drag region
  (`-webkit-app-region: drag` spans the full strip at `z-[9999]`).

## Verification

1. Worktree gates green: typecheck, lint, vitest ×4 (web/shared/desktop/mobile).
2. e2e 15/15 (14 existing + the new sidenav spec).
3. Rebuilt installer from this worktree installed; Playwright against the
   packaged local server (desktop-mode stub + web parity) and computer-use on
   the real Electron window: rail visible below the titlebar, expand/collapse
   works by click (not window drag), content offset follows `--sidenav-w`.
