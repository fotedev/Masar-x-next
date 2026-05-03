# Tasks: Mobile Responsive Fix & Design System Alignment

**Branch**: `003-mobile-responsive-fix`
**Input**: `specs/003-mobile-responsive-fix/` — plan.md, spec.md, research.md, data-model.md, contracts/css-token-surface.md
**Stack**: TypeScript 5.5.3 / Next.js 16.2.1, Tailwind CSS 3.4.1, Framer Motion 12.35.0
**Total Tasks**: 32 (T001–T032) | **No automated tests** (manual verification via quickstart.md)

## Format: `- [ ] TXXX [P?] [USN?] Description with exact file path`

- **[P]**: Can run in parallel — task touches a different file than all concurrent sibling tasks in the same phase
- **[USN]**: Links task to a User Story — required in all US phases; omitted in Setup / Foundational / Polish phases
- Tasks touching the **same file** are always **sequential** (no [P])
- No test tasks (not requested in spec)

---

## Phase 1 — Setup

**Purpose**: Establish a clean baseline before any changes are made. Both tasks must pass before Phase 2 begins.

- [ ] T001 Run `pnpm build` to confirm zero pre-existing TypeScript errors and lint warnings; record any baseline output before making any changes
- [ ] T002 Open `src/app/layout.tsx` and confirm the `<meta name="viewport">` `content` attribute is missing `viewport-fit=cover` — document the exact current attribute value as the audit baseline

**Checkpoint**: Baseline verified — no pre-existing errors to confuse with regressions introduced by this branch

---

## Phase 2 — Foundational (blocks US1)

**Purpose**: The single meta-tag addition that enables `env(safe-area-inset-*)` to return non-zero values on notched devices. Without this, all Phase 3 safe-area padding is silently a no-op.

**⚠️ CRITICAL**: Phase 3 (US1) MUST NOT begin until this phase is complete and verified in DevTools → Elements → `<meta name="viewport">`.

- [ ] T003 Add `viewport-fit=cover` to the `content` attribute of `<meta name="viewport">` so `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` return real device inset values on notched iOS/Android devices in `src/app/layout.tsx`

**Checkpoint**: DevTools → Elements → `<meta name="viewport">` shows `viewport-fit=cover` — `env()` now returns real pixel inset values on notched devices

---

## Phase 3 — User Story 1: Safe-Area & Viewport Height on Notched Devices (Priority: P1) 🎯 MVP

**Goal**: The header never overlaps the system status bar or Dynamic Island; all full-height pages use `h-dvh` so no content is clipped behind browser chrome; the AI chat input is always fully visible.

**Independent Test**: DevTools → Device Toolbar → iPhone 12 Pro, Portrait. Verify: (1) the MasarX logo and hamburger button are fully visible below the notch area; (2) computed `padding-top` on the Layout content wrapper equals approximately 116–131px (72px + ~44–59px safe-area inset); (3) navigating to `/ai-assistant` shows no outer page scrollbar alongside the inner chat-container scroll (double-scroll eliminated). See quickstart.md Scenario 1.

- [ ] T004 [P] [US1] Move `pt-[env(safe-area-inset-top)]` from the inner container `<div>` to the root `<header>` element itself so the header background fills the notch area; upgrade the hamburger `<button>` from `w-[40px] h-[40px]` to `w-11 h-11` (44 px minimum WCAG touch target) in `src/components/Header.tsx`
- [ ] T005 [P] [US1] Update the Layout content wrapper padding from `pt-[72px]` → `pt-[calc(72px+env(safe-area-inset-top))]` and change `min-h-screen` → `min-h-dvh` so the page fills the dynamic viewport height on browsers with collapsing toolbars in `src/components/Layout.tsx`
- [ ] T006 [P] [US1] Replace all mixed `h-screen` / `h-[100dvh]` height classes with the Tailwind 3.4 built-in `h-dvh` on the page wrapper and chat window container; resolve the double-scroll caused by the Layout `pt` offset conflicting with the chat container height declaration in `src/app/[locale]/ai-assistant/page.tsx`
- [ ] T007 [P] [US1] Add `pb-[max(1.5rem,env(safe-area-inset-bottom))]` to the MobileNav drawer's inner content wrapper `<div>` so the bottom nav items are never hidden behind the iOS home indicator bar in `src/components/header/MobileNav.tsx`

**Checkpoint**: US1 fully functional — safe-area header, `h-dvh` pages, and AI chat double-scroll resolved; all three acceptance scenarios in quickstart.md Scenario 1 pass

---

## Phase 4 — User Story 2: SubjectsGrid Cards Layout Correctly on All Viewports (Priority: P1) 🎯 MVP

**Goal**: Subject cards display in a proper CSS Grid at any viewport from 320px to 2560px — no horizontal overflow, no misaligned columns, and the skeleton loading state matches the live grid column count exactly to prevent CLS.

**Independent Test**: DevTools → 320px → subjects page shows exactly 2 columns with `gap-4`; set to 640px → 3 columns; set to 1024px → 4 columns. Throttle network to Slow 3G → navigate to subjects → skeleton cards render in the same 2-column grid as the loaded cards (no layout shift). Zero horizontal scrollbar at any width. See quickstart.md Scenario 2.

- [ ] T008 [P] [US2] Replace the `flex flex-wrap justify-center gap-4 sm:gap-6` container and `w-full sm:w-[calc(50%-12px)] md:w-[calc(33.333%-16px)] lg:w-[calc(25%-18px)]` per-card width expressions with `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6` on the container and `w-full` (no `calc()`) on each card element on the live card section in `src/components/SubjectsGrid.tsx`
- [ ] T009 [US2] Update the skeleton loading card container to the identical `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6` pattern and `w-full` per-skeleton-card so skeleton and live card column counts always match and no Cumulative Layout Shift occurs when data loads in `src/components/SubjectsGrid.tsx`

**Checkpoint**: US2 fully functional — CSS Grid responsive at all widths, skeleton matches live grid; quickstart.md Scenario 2 passes at all 6 test viewports

---

## Phase 5 — User Story 3: Mobile Navigation Drawer Dismissable on Narrow Screens (Priority: P2)

**Goal**: The drawer is capped at `min(320px, 85vw)` ensuring a minimum 48px tappable backdrop at 320px; nav items are fully legible in light mode; the inner div's now-redundant duplicate safe-area padding is removed.

**Independent Test**: DevTools → 320px viewport → tap hamburger → drawer panel width is ≤272px, leaving ≥48px visible backdrop; tap the visible backdrop → drawer closes. Toggle to light mode → all nav items show dark text on white/slate background (no white-on-white). See quickstart.md Scenario 3.

- [ ] T010 [US3] Replace `w-[280px] sm:w-[320px]` with the single responsive expression `w-[min(320px,85vw)]` on the drawer panel element, guaranteeing at least 48px of tappable backdrop area at the narrowest supported 320px viewport in `src/components/header/MobileNav.tsx`
- [ ] T011 [US3] Replace light-mode-invisible nav item Tailwind classes per data-model.md Entity 2 nav item table: `text-[#a1a1aa]` → `text-slate-600 dark:text-[#a1a1aa]`; `hover:text-white` → `hover:text-slate-900 dark:hover:text-white`; `hover:bg-[rgba(255,255,255,0.08)]` → `hover:bg-slate-100 dark:hover:bg-white/8`; active `text-white bg-[rgba(255,255,255,0.12)]` → `text-slate-900 dark:text-white bg-slate-100 dark:bg-white/12` in `src/components/header/MobileNav.tsx`
- [ ] T012 [P] [US3] Remove the now-redundant `pt-[env(safe-area-inset-top)]` Tailwind class from the inner container `<div>` inside `<header>` — this padding was relocated to the `<header>` element itself in T004 and must not remain on the inner div or it will double-apply the inset in `src/components/Header.tsx`

**Checkpoint**: US3 fully functional — drawer closes via backdrop tap at 320px, nav items legible in both light and dark mode, duplicate padding removed; quickstart.md Scenario 3 passes

---

## Phase 6 — User Story 4: Consistent Design Tokens Replace Hard-Coded Colors (Priority: P2)

**Goal**: Glass CSS variables use brand-tinted slate neutrals instead of pure white/black; all three layout containers share `max-w-7xl`; interactive action cards are semantic `<button>` elements with focus rings; `transition-all` is replaced with targeted property lists across all in-scope files.

**Independent Test**: (1) DevTools → 1440px → inspect computed `max-width` on header inner div, `<main>`, and footer inner div → all report 1280px. (2) Tab through the home page — 5 action cards each receive a visible focus ring (`focus-visible:ring-2`). (3) DevTools → Styles on a `.modern-card` → `--glass-bg` in `:root` shows `rgba(248, 250, 252, 0.8)` not `rgba(255, 255, 255, 0.8)`. See quickstart.md Scenarios 5, 6, and 9.

- [ ] T013 [US4] Replace all pure `rgba(255,255,255,...)` and `rgba(0,0,0,...)` values in `--glass-bg`, `--glass-border`, and `--card-shadow` CSS custom properties inside the `:root` and `.dark` blocks with slate/navy-tinted equivalents per data-model.md Entity 2 glass token table (e.g., `rgba(248,250,252,0.8)`, `rgba(241,245,249,0.5)`, `rgba(2,6,23,0.2)`) in `src/index.css`
- [ ] T014 [P] [US4] Change the inner container `<div>` max-width from the arbitrary value `max-w-[1280px]` to the semantic Tailwind token `max-w-7xl` (same computed 1280px) to align with the unified layout contract in `src/components/Header.tsx`
- [ ] T015 [P] [US4] Change the inner container `<div>` max-width from `max-w-[1400px]` → `max-w-7xl` to unify footer alignment with the header and main content in `src/components/Footer.tsx`
- [ ] T016 [P] [US4] Change the `<main>` element max-width from `max-w-[1600px]` → `max-w-7xl` so the main content left and right edges align with the header and footer in `src/components/Layout.tsx`
- [ ] T017 [US4] [FR-012] Add `sm:grid-cols-2` breakpoint to the DashboardStats grid container to prevent cramped 4-column layout on tablets in `src/components/HomeClient.tsx`
- [ ] T018 [US4] Convert all 5 `<div onClick={...}>` interactive elements — the ZANE AI card and the Subjects, Quizzes, News, and Profile action cards — to `<button type="button">` with `focus-visible:ring-2 focus-visible:ring-brand-blue/30` focus styles for keyboard navigation and correct screen-reader role announcement in `src/components/HomeClient.tsx`
- [ ] T019 [US4] Replace `transition-all duration-500` on the ZANE AI card and `transition-all` (without explicit duration) on the four action cards with `transition-[colors,transform,box-shadow] duration-300` to eliminate costly all-property transitions in `src/components/HomeClient.tsx`
- [ ] T020 [P] [US4] Replace `transition-all duration-300` on card elements with `transition-[colors,transform,box-shadow,border-color] duration-300` per research.md Decision 8 replacement pattern in `src/components/home/SummariesSection.tsx`
- [ ] T021 [P] [US4] Replace `transition-all duration-300` on card elements with `transition-[colors,transform,box-shadow,border-color] duration-300` per research.md Decision 8 replacement pattern in `src/components/home/VideosSection.tsx`
- [ ] T022 [P] [US4] Replace `transition-all duration-300` on card elements with `transition-[colors,transform,box-shadow,border-color] duration-300` per research.md Decision 8 replacement pattern in `src/components/home/QuizzesSection.tsx`

**Checkpoint**: US4 fully functional — max-width unified at 1280px, action cards keyboard-accessible with focus rings, glass tokens tinted, `transition-all` eliminated in all 9 in-scope files; quickstart.md Scenarios 5, 6, and 9 pass

---

## Phase 7 — User Story 5: Cards Don't Stick in Hovered State on Touch Devices (Priority: P2)

**Goal**: The `.modern-card`, `.btn-primary`, and `.btn-secondary` `translateY` hover transforms fire only on devices where hover is the primary input mechanism — preventing the persistent lifted-card visual glitch on touchscreens while preserving hover affordances on desktop.

**Independent Test**: DevTools → Device Toolbar → any mobile device (forces `hover: none`). Navigate to subjects page. Tap a card — it returns immediately to resting position with no persistent lift. Exit Device Toolbar → hover a card with mouse → card lifts `translateY(-4px)` and border turns brand-blue as expected. See quickstart.md Scenario 4.

- [ ] T023 [US5] Wrap the `.modern-card:hover`, `.btn-primary:hover`, and `.btn-secondary:hover` `transform`, `box-shadow`, and `border-color` declarations inside `@media (hover: hover) { }` so hover transforms are suppressed entirely on touch-primary devices per research.md Decision 6 and contracts/css-token-surface.md Hover Transform Scope contract in `src/index.css`

**Checkpoint**: US5 fully functional — touch devices show no stuck-hover state; desktop hover lift and border transition still work correctly; quickstart.md Scenario 4 passes both steps

---

## Phase 8 — User Story 6: Motion Respects User Preferences (Priority: P3)

**Goal**: When `prefers-reduced-motion: reduce` is active, all CSS transitions collapse to 0.01ms and all Framer Motion stagger / `whileHover` / entrance animations are fully suppressed across the 5 animated components — CSS layer and Framer Motion layer covered independently.

**Independent Test**: DevTools → Rendering panel → Emulate `prefers-reduced-motion: reduce`. Navigate to `/subjects` — cards appear instantly with no stagger. Navigate to `/` — summary, video, and quiz cards appear without delay. Navigate to `/ai-assistant` — no NeuralEnergyEntity motion or stagger on initial render. In Console: `getComputedStyle(document.body).transitionDuration` returns `"0.01ms"`. See quickstart.md Scenario 7.

- [ ] T024 [US6] Add a global `@media (prefers-reduced-motion: reduce)` block at the **end** of the file targeting `*, *::before, *::after` with `animation-duration: 0.01ms !important`, `animation-iteration-count: 1 !important`, `transition-duration: 0.01ms !important`, and `scroll-behavior: auto !important` per research.md Decision 7 Layer 1 in `src/index.css`
- [ ] T025 [P] [US6] Import `useReducedMotion` from `framer-motion`; when `shouldReduceMotion` is `true` pass a no-stagger `containerVariants` (no `staggerChildren`) and empty static `itemVariants` so all card entrance animations are instant in `src/components/SubjectsGrid.tsx`
- [ ] T026 [P] [US6] Import `useReducedMotion` from `framer-motion`; when `shouldReduceMotion` is `true` pass no-stagger container variants and omit the `whileHover` prop on card `motion.*` elements so no entrance or hover motion plays in `src/components/home/SummariesSection.tsx`
- [ ] T027 [P] [US6] Import `useReducedMotion` from `framer-motion`; when `shouldReduceMotion` is `true` pass no-stagger container variants and omit the `whileHover` prop on card `motion.*` elements so no entrance or hover motion plays in `src/components/home/VideosSection.tsx`
- [ ] T028 [P] [US6] Import `useReducedMotion` from `framer-motion`; when `shouldReduceMotion` is `true` pass no-stagger container variants and omit the `whileHover` prop on card `motion.*` elements so no entrance or hover motion plays in `src/components/home/QuizzesSection.tsx`
- [ ] T029 [P] [US6] Import `useReducedMotion` from `framer-motion`; when `shouldReduceMotion` is `true` disable the stagger entrance animation and suppress any NeuralEnergyEntity or other `motion.*` animations on initial chat state render in `src/components/ai/ChatContainer.tsx`

**Checkpoint**: US6 fully functional — CSS transitions collapse to 0.01ms, all 5 Framer Motion components suppress stagger and hover motion; quickstart.md Scenario 7 passes all 5 steps

---

## Phase 9 — Polish & Cross-Cutting Verification

**Purpose**: End-to-end manual verification pass covering all 9 quickstart scenarios, RTL layout integrity, and a clean final build. All prior phases must be complete.

- [ ] T030 Run all 9 quickstart.md verification scenarios against `pnpm dev` on both desktop (1440px) and mobile (375px, 320px) viewports; log a pass/fail result for each numbered scenario before proceeding to T031 and T032
- [ ] T031 [P] Navigate to the `/ar` locale routes (Arabic RTL) and verify layout integrity — the MobileNav drawer slides from the correct end (right) edge, card grids mirror correctly, no text truncation in RTL mode, and the safe-area padding direction is unaffected by `dir="rtl"`
- [ ] T032 Run `pnpm build` and confirm zero new TypeScript compilation errors and zero new ESLint warnings were introduced; compare output against the T001 baseline to distinguish regressions from pre-existing issues

**Checkpoint**: Branch ready for PR — all 9 quickstart scenarios pass, RTL layout unaffected, build clean

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 — Setup
  └─ no dependencies — start immediately

Phase 2 — Foundational
  └─ depends on: Phase 1 complete (T001 clean baseline, T002 audit logged)
  └─ BLOCKS: Phase 3 — env() returns 0 without viewport-fit=cover; safe-area changes are silently inert

Phase 3 — US1  ─┐
Phase 4 — US2  ─┤  all depend on: Phase 2 complete
Phase 5 — US3  ─┤  US2–US5–US6 phases can be worked in parallel by separate developers
Phase 6 — US4  ─┤  single-developer flow: P1 first (US1, US2) then P2 (US3–US5) then P3 (US6)
Phase 7 — US5  ─┤
Phase 8 — US6  ─┘

Phase 9 — Polish
  └─ depends on: all user story phases complete
```

### Task-Level Dependencies

| Task | Depends On | Reason |
|------|-----------|--------|
| T002 | T001 | Audit after confirming baseline is clean |
| T003 | T002 | Confirm absence of `viewport-fit=cover` before adding it |
| T004–T007 | T003 | `env()` must return real pixel values for safe-area padding to be meaningful |
| T009 | T008 | Skeleton must match the new live grid pattern — both edits in the same file |
| T011 | T010 | Drawer width cap (T010) and text color fix (T011) apply to elements on the same component — apply in order |
| T012 | T004 | Removes the padding that T004 relocated from the inner `<div>` to the `<header>` element |
| T018 | T017 | Must add DashboardStats breakpoint (T017) before converting div→button (T018) — same file |
| T019 | T018 | Must convert `<div>` → `<button>` before adjusting its transition classes — same file |
| T025–T029 | T024 | Framer Motion hooks complement the CSS global block — CSS layer should be in place first |
| T032 | T030, T031 | Final build gate runs only after all manual verification scenarios pass |

---

## Parallel Execution Examples

### Phase 3 — US1 (4 tasks, 4 different files — launch simultaneously)

```
T004 → src/components/Header.tsx
         Move safe-area padding to <header>; hamburger w-[40px] → w-11

T005 → src/components/Layout.tsx
         pt-[72px] → pt-[calc(72px+env(...))]; min-h-screen → min-h-dvh

T006 → src/app/[locale]/ai-assistant/page.tsx
         h-screen/h-[100dvh] → h-dvh; eliminate double-scroll

T007 → src/components/header/MobileNav.tsx
         Add pb-[max(1.5rem,env(safe-area-inset-bottom))] to content wrapper
```

### Phase 5 — US3 (T010 + T011 sequential; T012 parallel on different file)

```
Sequential pair (same file):      Parallel with the pair (different file):
  T010 → MobileNav.tsx              T012 → Header.tsx
  T011 → MobileNav.tsx                   Remove leftover inner-div padding
```

### Phase 6 — US4 (mixed: anchor → parallel batches → sequential pair → parallel batch)

```
Step 1 — Anchor (CSS tokens, no concurrent sibling):
  T013 → src/index.css
           Replace pure rgba(255,255,255,...) / rgba(0,0,0,...) in glass vars

Step 2 — Batch B: parallel (3 different files):
  T014 → src/components/Header.tsx     max-w-[1280px] → max-w-7xl
  T015 → src/components/Footer.tsx     max-w-[1400px] → max-w-7xl
  T016 → src/components/Layout.tsx     max-w-[1600px] → max-w-7xl

Step 3 — Sequential trio (same file, in order):
  T017 → src/components/HomeClient.tsx    DashboardStats sm:grid-cols-2 breakpoint
  T018 → src/components/HomeClient.tsx    <div onClick> → <button type="button">
  T019 → src/components/HomeClient.tsx    transition-all → specific property list

Step 4 — Batch C: parallel (3 different files):
  T020 → src/components/home/SummariesSection.tsx   transition-all → targeted
  T021 → src/components/home/VideosSection.tsx       transition-all → targeted
  T022 → src/components/home/QuizzesSection.tsx      transition-all → targeted
```

### Phase 8 — US6 (T024 first, then T025–T029 all parallel)

```
Step 1 — CSS layer (sequential anchor):
  T024 → src/index.css
           @media (prefers-reduced-motion: reduce) global block

Step 2 — Framer Motion layer (5 different files, launch simultaneously):
  T025 → src/components/SubjectsGrid.tsx
  T026 → src/components/home/SummariesSection.tsx
  T027 → src/components/home/VideosSection.tsx
  T028 → src/components/home/QuizzesSection.tsx
  T029 → src/components/ai/ChatContainer.tsx
```

---

## Implementation Strategy

### MVP First — P1 Stories Only (US1 + US2)

Deliver the two highest-impact fixes before touching any P2/P3 work:

1. Complete Phase 1 — Setup (T001, T002)
2. Complete Phase 2 — Foundational (T003) — **critical gate, do not skip**
3. Complete Phase 3 — US1 in parallel (T004, T005, T006, T007)
4. **STOP and VALIDATE** quickstart.md Scenario 1 (safe-area on notched device)
5. Complete Phase 4 — US2 sequentially (T008 → T009)
6. **STOP and VALIDATE** quickstart.md Scenario 2 (SubjectsGrid at 320/640/1024px)
7. **Deploy / demo** — the two most visible mobile breakages are resolved

### Incremental Delivery — P2 then P3

Continue layering on stories independently after each MVP validation:

8. Phase 5 — US3 (T010 → T011, T012 parallel) → validate quickstart.md Scenario 3
9. Phase 6 — US4 (T013 → T014–T016 → T017–T019 → T020–T022) → validate Scenarios 5, 6, 9
10. Phase 7 — US5 (T023) → validate quickstart.md Scenario 4 (both touch and desktop steps)
11. Phase 8 — US6 (T024 → T025–T029 parallel) → validate quickstart.md Scenario 7
12. Phase 9 — Polish (T030 → T031 parallel, T032)

### Parallel Team Strategy — 2 Developers

After Phase 2 completes, split the work across P1 and P2 stories simultaneously:

```
Developer A                           Developer B
──────────────────────────────────    ──────────────────────────────────
Phase 3 — US1                         Phase 4 — US2
  T004 Header safe-area + hamburger     T008 SubjectsGrid live grid
  T005 Layout dvh + pt                  T009 SubjectsGrid skeleton
  T006 AI page h-dvh
  T007 MobileNav safe-area bottom
            ↓                                      ↓
Phase 5 — US3                         Phase 6 — US4 (Batches B + C)
  T010 MobileNav drawer width cap       T014 Header max-w-7xl
  T011 MobileNav light-mode text        T015 Footer max-w-7xl
  T012 Header inner-div cleanup         T016 Layout max-w-7xl
            ↓                           T019 SummariesSection transition
Phase 7 — US5                          T020 VideosSection transition
  T023 hover:hover CSS wrapper          T022 QuizzesSection transition
            ↓                                      ↓
Phase 6 — US4 (Anchor + Sequential)  ←─ both merge here ─→
  T013 index.css glass tokens (Dev A)
  T017 HomeClient DashboardStats breakpoint (Dev B)
  T018 HomeClient div→button (Dev B)
  T019 HomeClient transition-all (Dev B)
            ↓
Phase 8 — US6 (shared, parallel)
  T024 CSS reduced-motion block (either dev)
  T025–T029 Framer Motion hooks (split 2–3 per dev)
            ↓
Phase 9 — Polish (together)
  T030 Quickstart scenarios
  T031 RTL verification (parallel with T030)
  T032 Final pnpm build
```

---

## Notes

- **`[P]`** = task touches a **different file** from all concurrent sibling tasks in the same phase; safe to execute simultaneously with those siblings
- **`[USN]`** = maps this task to a specific User Story for independent delivery traceability; omitted in Setup, Foundational, and Polish phases
- **Same-file tasks are always sequential** — no `[P]` marker applied regardless of story priority
- **No automated tests** in this branch — all verification is manual via `quickstart.md` (9 scenarios)
- **No new npm packages** — `useReducedMotion` is already available in Framer Motion 12.35.0; `h-dvh` / `min-h-dvh` are built into Tailwind 3.4.1
- **RTL layout preserved** — no `dir="rtl"` attributes, logical-property classes, or `start-0`/`end-0` positioning are changed; verify with T031
- **FR-006 (profile page `overflow-x-hidden`) is intentionally omitted** — marked explicitly out-of-scope in spec.md Assumptions section; SC-008 is deferred accordingly
- **Commit cadence**: commit after each phase checkpoint (not after each individual task) so each commit maps cleanly to a user story increment
- **Glass token change (T013) is a near-imperceptible visual delta** — the audit test is in the CSS source (no pure `rgba(255,255,255,...)` remaining), not the naked eye
- **T012 is a cleanup task, not a net-new implementation** — it removes a class that T004 relocated; both tasks touch `Header.tsx` but in different phases so T012 MUST come after T004 completes
