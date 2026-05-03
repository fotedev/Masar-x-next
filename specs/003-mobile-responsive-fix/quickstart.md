# Quickstart: Verification Guide

**Branch**: `003-mobile-responsive-fix`
**Phase**: 1 — Integration Scenarios
**Generated**: 2026-05-02

Step-by-step instructions for verifying each acceptance criterion after implementation.
No automated test suite is added by this feature — all verification is manual via
Chrome DevTools device emulation and/or real devices.

---

## Setup

1. Start the dev server: `pnpm dev`
2. Open Chrome DevTools → Toggle Device Toolbar (Cmd+Shift+M)
3. Keep the Console panel open to watch for layout errors

---

## Scenario 1 — Safe-Area on Notched iOS (FR-001, SC-001, SC-002)

**Maps to**: User Story 1 — P1

### Step 1: Enable iPhone X simulation
1. In DevTools device toolbar, select **iPhone 12 Pro** (or iPhone X)
2. Set orientation to **Portrait**
3. In Device Toolbar → More Options → check **"Show device frame"** if available

### Step 2: Verify header is fully visible
- Navigate to any page (home, subjects, etc.)
- **Expected**: The MasarX logo and hamburger button are fully visible below the simulated notch area
- **Fail condition**: Any header content is partially hidden behind the notch chrome

### Step 3: Verify `viewport-fit=cover` is set
1. Open DevTools → Elements → find `<meta name="viewport">`
2. **Expected**: Value includes `viewport-fit=cover`
3. **Fail condition**: Attribute is absent — `env(safe-area-inset-top)` returns 0 and the entire fix is silently broken

### Step 4: Verify body top offset
1. Open DevTools → Elements → click `<div class="...pt-[72px]...">` (Layout wrapper)
2. Check computed padding-top
3. **Expected on notched device**: padding-top = 72px + safe-area value (typically 44–59px on iPhone 12 Pro) = ~116–131px
4. **Expected on desktop**: padding-top = exactly 72px

### Step 5: Verify AI chat on notched device
1. Navigate to `/ai-assistant`
2. **Expected**: The chat input bar at the bottom is fully visible, not hidden behind the simulated home indicator bar
3. **Expected**: No outer page scroll — only the inner message container scrolls
4. **Fail condition**: Page-level scroll bar appears alongside chat-container scroll (double-scroll)

---

## Scenario 2 — SubjectsGrid at Narrow Viewports (FR-003, SC-003)

**Maps to**: User Story 2 — P1

### Step 1: Open subjects page
Navigate to `/subjects` (or click Subjects in nav)

### Step 2: Test 320px viewport
1. Set DevTools viewport width to **320px**
2. **Expected**: Cards render in exactly **2 columns** with `gap-4` between them
3. **Expected**: No horizontal scrollbar at page level
4. **Fail condition**: Cards overflow horizontally, or render in 1 column (too narrow) or 3 columns (too wide)

### Step 3: Test 500px viewport
1. Set viewport to **500px**
2. **Expected**: **2 columns** (still below the 640px `sm` breakpoint)

### Step 4: Test 640px viewport
1. Set viewport to **640px**
2. **Expected**: **3 columns** (hits `sm:grid-cols-3`)

### Step 5: Test 900px viewport
1. Set viewport to **900px**
2. **Expected**: **3 columns** (below `lg` 1024px breakpoint)

### Step 6: Test 1024px viewport
1. Set viewport to **1024px**
2. **Expected**: **4 columns** (hits `lg:grid-cols-4`)

### Step 7: Test skeleton state
1. Throttle the network to **Slow 3G** in DevTools Network panel
2. Navigate to `/subjects`
3. **Expected**: Skeleton loading cards use the **same 2/3/4 column grid** as live cards
4. **Fail condition**: Skeleton renders in different column count than live cards (causes layout shift)

---

## Scenario 3 — Mobile Nav Drawer at 320px (FR-004, SC-004)

**Maps to**: User Story 3 — P2

### Step 1: Set viewport to 320px
1. DevTools viewport to **320px**
2. Navigate to any page

### Step 2: Open the mobile nav drawer
1. Tap the hamburger button (top-right)
2. **Expected**: Drawer opens from the `start` edge
3. Measure the visible backdrop area: it should be at least **48px wide** (320 × 0.15 = 48px)

### Step 3: Dismiss via backdrop tap
1. Tap anywhere in the visible backdrop area to the right of the drawer
2. **Expected**: Drawer closes
3. **Fail condition**: Tap registers on the drawer or nothing happens

### Step 4: Verify nav text in light mode
1. Toggle to **light mode** (if a theme toggle is visible, or via DevTools → prefers-color-scheme: light)
2. Open the drawer
3. **Expected**: All nav items are clearly legible (dark text on white background)
4. **Expected**: Active nav item has a distinct background (slate-100) and dark text
5. **Fail condition**: Any nav item text is white on white (invisible)

### Step 5: Verify nav text in dark mode
1. Toggle to **dark mode**
2. Open the drawer
3. **Expected**: Inactive items are slate-400/zinc-400 on near-black background — legible
4. **Expected**: Active item is white on white/12 semi-transparent background

---

## Scenario 4 — Stuck Hover on Touch Devices (FR-007, SC-005)

**Maps to**: User Story 5 — P2

### Step 1: Enable touch simulation in DevTools
1. In DevTools → Toggle Device Toolbar → any mobile device
2. This forces `(hover: none)` media query

### Step 2: Navigate to Subjects page
1. Tap a subject card
2. **Expected**: Card scales/lifts briefly during the tap, then returns to rest position immediately
3. **Fail condition**: Card remains elevated (translateY(-4px)) after the tap ends

### Step 3: Verify hover still works on desktop
1. Exit device toolbar (go back to desktop mode)
2. Hover over a subject card with the mouse
3. **Expected**: Card lifts with translateY(-4px) and border turns brand-blue
4. **Fail condition**: Card does not respond to hover at all (over-scoped fix)

---

## Scenario 5 — Max-Width Alignment (FR-004, layout unification)

**Maps to**: User Story 4 — P2

### Step 1: Set viewport to 1440px
1. DevTools viewport to **1440px**
2. Navigate to the home page

### Step 2: Visual alignment check
1. Open DevTools → Elements → inspect the header's inner `div`
2. Check `max-width` computed value: **Expected** = 1280px
3. Inspect the `<main>` wrapper
4. Check `max-width` computed value: **Expected** = 1280px
5. Inspect the footer's inner `div`
6. Check `max-width` computed value: **Expected** = 1280px

### Step 3: Visual eye-check
- On a 1440px+ screen, the left edge of the page heading and the left edge of the nav logo should be optically aligned
- **Fail condition**: Page content extends wider than the header, creating a visible horizontal misalignment

---

## Scenario 6 — Semantic HTML Action Cards (FR-009, accessibility)

**Maps to**: User Story 4 — P2

### Step 1: Keyboard navigation
1. On the home page, press **Tab** repeatedly
2. **Expected**: The 4 action cards (Subjects, Quizzes, News, Profile) and the ZANE AI card receive focus (visible focus ring)
3. **Fail condition**: Focus skips the action cards entirely

### Step 2: Screen reader check
1. Open DevTools → Accessibility panel
2. Click one of the action cards
3. **Expected**: Role = `button`, Name = the card label text
4. **Fail condition**: Role = `generic` (means `<div>`)

### Step 3: Enter key activation
1. Tab to an action card
2. Press **Enter**
3. **Expected**: Navigation occurs (same as clicking)

---

## Scenario 7 — Reduced Motion (FR-010, SC-007)

**Maps to**: User Story 6 — P3

### Step 1: Force prefers-reduced-motion in DevTools
1. DevTools → Rendering tab (via More Tools) → check **"Emulate CSS media feature prefers-reduced-motion"** → set to **"reduce"**

### Step 2: Navigate to Subjects page
1. **Expected**: Subject cards appear instantly (no stagger fade-in)
2. **Expected**: Hovering a card (on desktop) does not lift it
3. **Fail condition**: Stagger animation plays, or cards animate on hover

### Step 3: Navigate to Home page
1. **Expected**: Summaries/Videos/Quizzes sections appear instantly, no stagger delay
2. **Fail condition**: Cards animate in sequentially

### Step 4: Navigate to AI Assistant
1. **Expected**: The initial state (NeuralEnergyEntity, welcome text) appears without motion
2. **Expected**: Mode selector dropdown opens/closes without scale animation
3. **Fail condition**: Any visible motion/animation

### Step 5: Verify CSS transitions are suppressed
1. In the Console, run: `getComputedStyle(document.body).transitionDuration`
2. **Expected**: `"0.01ms"` or similar near-zero value
3. This confirms the global `prefers-reduced-motion` CSS block is active

---

## Scenario 8 — Hamburger Touch Target Size (C5)

### Step 1: Inspect the button dimensions
1. DevTools → Elements → select the hamburger `<button>` element
2. In the Computed tab, check `width` and `height`
3. **Expected**: Both = **44px** (or 48px if upgraded)
4. **Fail condition**: Either dimension is below 44px

---

## Scenario 9 — Glass Tinted Neutrals (FR-008, SC-006)

### Step 1: Check index.css variables
1. DevTools → Sources → `src/index.css` (or Styles tab on an element using `.modern-card`)
2. Find `--glass-bg` in the `:root` block
3. **Expected**: Value is `rgba(248, 250, 252, 0.8)` or similar slate-tinted value — **not** `rgba(255, 255, 255, 0.8)`
4. Find `--card-shadow` in `:root`
5. **Expected**: Shadow color uses `rgba(2, 6, 23, ...)` — **not** `rgba(0, 0, 0, ...)`

### Step 2: Visual spot check
1. In light mode, look at a subject card or summary card
2. The card background should have an extremely subtle cool tint (not stark white)
3. This is a nearly imperceptible change — the test is in the code, not the eye

---

## Quick Regression Check (run after all scenarios pass)

| Area | Check | Expected |
|------|-------|---------|
| Desktop nav | Header at 1440px | Logo aligns with page content left edge |
| Dark mode | All pages | No white text on white, no pure-black shadows |
| RTL | `/ar` route | Nav drawer slides from right, all layouts mirror correctly |
| Desktop hover | Subject cards | Hover lift still works with mouse |
| Forms | Login page | Input font-size ≥ 16px (no iOS zoom on tap) |
| Mobile | 375px home page | No horizontal scrollbar |
