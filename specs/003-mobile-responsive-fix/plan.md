# Implementation Plan: Mobile Responsive Fix & Design System Alignment

**Branch**: `003-mobile-responsive-fix` | **Date**: 2026-05-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-mobile-responsive-fix/spec.md`

## Summary

Fix 12 categorised failures identified in the impeccable UI/UX audit: safe-area inset coverage on
notched iOS devices, dynamic viewport height for full-screen pages, brittle `calc()`-based flex
grid replaced with CSS Grid, mobile nav drawer invisible in light mode, below-minimum touch
targets, stuck hover states on touch devices, missing `prefers-reduced-motion` support, and tinted
neutral design tokens replacing pure white/black glass variables. All changes are confined to the
UI layer — no new runtime dependencies, no database migrations, no API surface changes.

## Technical Context

**Language/Version**: TypeScript 5.5.3 / Next.js 16.2.1 (App Router)
**Primary Dependencies**: Tailwind CSS 3.4.1, Framer Motion 12.35.0, next-intl 4.8.4, PostCSS 8.4.35
**Storage**: N/A — CSS and component changes only; no data layer touched
**Testing**: Chrome DevTools device emulation (iPhone 12 Pro, Galaxy S21) + manual verification on real devices; no automated test suite added
**Target Platform**: Web — iOS Safari 16+, Chrome Android 80+, Firefox 110+, Safari macOS 15+
**Project Type**: Web application — UI layer (Next.js App Router, React 19, Tailwind CSS)
**Performance Goals**: Zero new CLS events; 60 fps card hover/tap interactions; no horizontal overflow at any viewport 320px–2560px
**Constraints**: No new runtime `npm` packages; RTL (`dir="rtl"`) layout preserved on all modified components; dark mode token parity maintained; no visual regressions on desktop ≥1024px; `font-size: 16px` on inputs preserved (iOS zoom prevention)
**Scale/Scope**: 13 Functional Requirements (FR-001–FR-013) across 8 source files + 1 global CSS file

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: The project constitution (`/.specify/memory/constitution.md`) is unpopulated — the
template placeholders have not been replaced with project-specific principles. No MUST/SHOULD
normative rules are defined. Gate passes by default: there are no constitution rules to violate.

**Post-design re-check**: Same status — no new principles introduced by this plan. When the
constitution is authored in a future session, `003` changes should be reviewed for retroactive
alignment.

**Complexity Tracking**: N/A — no architectural complexity introduced. All changes reduce
fragility (calc() → Grid, transition-all → specific properties, hard-coded colours → tokens).

## Project Structure

### Documentation (this feature)

```text
specs/003-mobile-responsive-fix/
├── plan.md              ← this file
├── research.md          ← Phase 0 decisions
├── data-model.md        ← Phase 1 CSS entity surface
├── quickstart.md        ← Phase 1 test scenarios
├── contracts/
│   └── css-token-surface.md   ← Phase 1 token contract
├── checklists/
│   └── requirements.md  ← already complete ✅
└── tasks.md             ← Phase 2 (speckit.tasks)
```

### Source Code (affected files)

```text
src/
├── index.css                                         ← FR-007, FR-008, FR-010, FR-011
├── components/
│   ├── Header.tsx                                    ← FR-001 (safe-area), FR-013 (max-width unify)
│   ├── Layout.tsx                                    ← FR-002 (dvh), FR-013 (max-width unify)
│   ├── SubjectsGrid.tsx                              ← FR-003 (CSS Grid)
│   ├── HomeClient.tsx                                ← FR-009 (div→button), FR-012 (DashboardStats grid)
│   ├── home/
│   │   ├── SummariesSection.tsx                      ← FR-009 (tokens)
│   │   ├── VideosSection.tsx                         ← FR-009 (tokens)
│   │   └── QuizzesSection.tsx                        ← FR-009 (tokens)
│   ├── header/
│   │   └── MobileNav.tsx                             ← FR-004 (width cap), FR-009 (light mode text)
│   └── Footer.tsx                                    ← FR-013 (max-width unify)
└── app/
    └── [locale]/
        └── ai-assistant/
            └── page.tsx                              ← FR-002, FR-005 (dvh fix)
```

**Structure Decision**: Single Next.js project; UI-only changes. Option 2 (web application)
structure applies. No new directories created in `src/` — all changes are in-place edits to
existing files.

## Implementation Phases

### Phase 1 — P1 Critical: Viewport & Safe-Area (US1, FR-001, FR-002, FR-005)

Fix the two most-visible mobile breakages: header safe-area and AI assistant viewport height.

**Files touched**: `Header.tsx`, `Layout.tsx`, `src/app/[locale]/ai-assistant/page.tsx`

**Acceptance gate**: On notched iOS device (or DevTools iPhone X), header is fully visible below
the notch, AI chat input is not clipped behind browser chrome.

### Phase 2 — P1 Critical: SubjectsGrid CSS Grid (US2, FR-003)

Replace brittle `flex-wrap + calc()` with `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`.

**Files touched**: `SubjectsGrid.tsx`

**Acceptance gate**: Cards align correctly at 320px, 500px, 900px, 1280px viewports with no
horizontal overflow.

### Phase 3 — P2 Polish: MobileNav & Touch (US3, US5, FR-004, FR-007)

Cap drawer width at `w-[min(320px,85vw)]`, fix light-mode text contrast, suppress hover transforms on
touch devices via `@media (hover: hover)` in `index.css`.

**Files touched**: `MobileNav.tsx`, `index.css`

**Acceptance gate**: Drawer closes by tapping backdrop at 320px; no stuck card hover state on
touch device; mobile nav text legible in both light and dark mode.

### Phase 4 — P2 Polish: Layout Alignment & Semantic HTML (US4, FR-009, FR-012, FR-013)

Unify `max-w-[1280px]` across `Layout.tsx`, `Header.tsx`, `Footer.tsx`. Replace `<div onClick>`
action cards with `<button>`. Replace `text-white` primary foreground with `text-primary-foreground`
token where appropriate.

**Files touched**: `Layout.tsx`, `Header.tsx`, `Footer.tsx`, `HomeClient.tsx`,
`SummariesSection.tsx`, `VideosSection.tsx`, `QuizzesSection.tsx`

**Acceptance gate**: On ≥1280px screen, header nav items and page content left-edges align.
All action cards are keyboard-focusable and screen-reader announced as interactive.

### Phase 5 — P2 Polish: Glass Tokens & Tinted Neutrals (US4, FR-008)

Replace `rgba(255,255,255,...)` and `rgba(0,0,0,...)` in glass CSS variables with slate-tinted
equivalents. Replace `.text-gradient-*` usage with solid token colors.

**Files touched**: `index.css`

**Acceptance gate**: Zero instances of pure white/black RGBA in glass variables in `index.css`.

### Phase 6 — P3 Accessibility: Reduced Motion (US6, FR-010, FR-011)

Add `@media (prefers-reduced-motion: reduce)` global CSS block. Add Framer Motion
`useReducedMotion()` checks to `SubjectsGrid`, `SummariesSection`, `VideosSection`,
`QuizzesSection`, `ChatContainer`.

**Files touched**: `index.css`, `SubjectsGrid.tsx`, `SummariesSection.tsx`, `VideosSection.tsx`,
`QuizzesSection.tsx`, `ChatContainer.tsx`

**Acceptance gate**: With OS reduced-motion enabled (or DevTools forced), no Framer Motion
entrance/exit animations play, CSS transitions collapse to 0ms.
