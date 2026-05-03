# Feature Specification: Mobile Responsive Fix & Design System Alignment

**Feature Branch**: `003-mobile-responsive-fix`  
**Created**: 2026-05-02  
**Status**: Draft  
**Input**: User description: "Refactor critical mobile responsive failures and design system alignment issues identified in UI/UX audit"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Safe-Area & Viewport Height on Notched Devices (Priority: P1)

A student opens MasarX on an iPhone with a notch. The header overlaps the status bar, page content is clipped at the bottom behind the browser chrome, and the chat input area is partially hidden. After this fix, the header respects safe-area insets, all full-height pages use dynamic viewport height, and no content is hidden behind system UI.

**Why this priority**: This is the most visible breakage — the app literally looks broken on the most popular mobile devices. Without this fix, every mobile user's first impression is damaged.

**Independent Test**: Open the app on any notched iOS device (or Chrome DevTools iPhone X simulation). Verify header doesn't overlap status bar, page content doesn't clip at bottom, and chat input is fully visible.

**Acceptance Scenarios**:

1. **Given** the app is opened on a notched iOS device, **When** the page loads, **Then** the header content is fully visible below the notch with proper safe-area padding
2. **Given** any page with `min-h-screen`, **When** the mobile browser chrome is visible, **Then** no content is clipped behind the address bar or bottom bar
3. **Given** the AI assistant chat page on mobile, **When** the keyboard is not open, **Then** the chat input area is fully visible and not hidden behind browser chrome

---

### User Story 2 - Subject Grid Cards Layout Correctly on All Viewports (Priority: P1)

A student browses subjects on a tablet or an unusual viewport width. The subject cards use brittle `calc()` width hacks that break at intermediate sizes, causing cards to overflow or misalign. After this fix, the grid uses proper CSS Grid `auto-fill` with `minmax()` so cards flow naturally at any width.

**Why this priority**: The subjects page is a primary navigation hub — broken card layout directly blocks users from accessing content.

**Independent Test**: Resize the browser window to various widths between 320px and 1536px. Verify subject cards always align in a proper grid with no overflow.

**Acceptance Scenarios**:

1. **Given** the subjects page at a 500px viewport, **When** cards render, **Then** exactly 2 cards fit per row with proper gap
2. **Given** the subjects page at a 900px viewport, **When** cards render, **Then** 3 cards fit per row without overflow
3. **Given** the subjects page at a 320px viewport, **When** cards render, **Then** 1 card per row fills the width with no horizontal scroll

---

### User Story 3 - Mobile Navigation Drawer is Dismissable on Narrow Screens (Priority: P2)

A user on a 320px-wide device opens the mobile nav drawer. The drawer takes up 280px, leaving only 40px of backdrop — too small to tap reliably for closing. After this fix, the drawer is capped at 85% of viewport width, ensuring adequate dismiss area.

**Why this priority**: Navigation is essential, but this only affects the narrowest devices and the menu button still works as an alternative close method.

**Independent Test**: Open the app at 320px viewport width, open the mobile menu, and tap the visible backdrop area to close it.

**Acceptance Scenarios**:

1. **Given** the mobile nav drawer is open on a 320px viewport, **When** the user taps the visible backdrop area, **Then** the drawer closes
2. **Given** the mobile nav drawer is open on any viewport, **When** the user presses Escape, **Then** the drawer closes

---

### User Story 4 - Consistent Design Tokens Replace Hard-Coded Colors (Priority: P2)

A developer changes the primary foreground color in the design system CSS variables. Despite this, 317 instances of `text-white` across 110 files remain unchanged, creating visual inconsistency. After this fix, all text colors reference design tokens so theme changes propagate automatically.

**Why this priority**: Design token consistency prevents future regressions and enables proper theming, but it doesn't block current functionality.

**Independent Test**: Change the `--primary-foreground` CSS variable value and verify that previously `text-white` elements now reflect the new token value.

**Acceptance Scenarios**:

1. **Given** a component previously using `text-white` for primary foreground text, **When** the `--primary-foreground` token is updated, **Then** the component text color updates accordingly
2. **Given** the dark mode is toggled, **When** tinted-neutral tokens are applied, **Then** glass effects and shadows use tinted colors instead of pure black/white

---

### User Story 5 - Cards Don't Stick in Hovered State on Touch Devices (Priority: P2)

A mobile user taps a subject card. The card lifts with `translateY(-4px)` and stays "stuck" in the lifted position because touch devices don't have a true hover-out event. After this fix, hover transforms are suppressed on touch-primary devices via `@media (hover: hover)`.

**Why this priority**: Visual glitch that makes the app feel broken on mobile, but doesn't block functionality.

**Independent Test**: Tap a card on a touch device and verify it returns to its resting state after the tap.

**Acceptance Scenarios**:

1. **Given** a modern-card on a touch-primary device, **When** the user taps the card, **Then** the card does not remain in a lifted position after tap
2. **Given** a modern-card on a pointer device with hover, **When** the user hovers the card, **Then** the card lifts as expected

---

### User Story 6 - Motion Respects User Preferences (Priority: P3)

A user with vestibular disorders has enabled "Reduce Motion" in their OS settings. The app still plays Framer Motion animations, hover lifts, and card transitions at full intensity. After this fix, all animations are reduced or eliminated when the user prefers reduced motion.

**Why this priority**: Accessibility compliance and user wellbeing, but doesn't affect core functionality for most users.

**Independent Test**: Enable "prefers-reduced-motion" in OS settings or Chrome DevTools, and verify animations are suppressed.

**Acceptance Scenarios**:

1. **Given** the user has prefers-reduced-motion enabled, **When** navigating between pages, **Then** transitions are instant or minimal
2. **Given** the user has prefers-reduced-motion enabled, **When** viewing Framer Motion components, **Then** no motion animations play

---

### Edge Cases

- What happens when `env(safe-area-inset-top)` is unsupported (older browsers)? Fallback to 0px — no padding added.
- What happens when `100dvh` is unsupported? Fallback to `100vh` — same as current behavior, no regression.
- What happens when `@container` is unsupported? Components fall back to media-query behavior — no regression.
- How does the system handle RTL layout with the mobile nav drawer? Drawer slides from the start edge (already handled via `start-0` and `translate-x-full` for RTL).
- What happens on ultra-wide screens (>1600px) with three different max-widths? Content alignment may still differ between header/footer/main — unified max-width is a polish item.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The fixed header MUST include `env(safe-area-inset-top)` padding on the header element itself, not just its inner container, so content is never hidden behind the notch on iOS
- **FR-002**: All pages using `min-h-screen` MUST be updated to use dynamic viewport height (`100dvh`) with a `100vh` fallback for older browsers
- **FR-003**: The SubjectsGrid component MUST replace `calc()`-based width hacks with CSS Grid using explicit responsive column breakpoints (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`) for predictable responsive card layouts at all viewport widths
- **FR-004**: The MobileNav drawer width MUST be capped at `w-[min(320px,85vw)]` to ensure adequate backdrop dismiss area on narrow screens (guarantees ≥48px tappable backdrop at 320px viewport)
- **FR-005**: The chat window mobile height MUST use Tailwind `h-dvh` (equivalent to `100dvh`) with the 64px offset handled by the Layout wrapper's `pt-[calc(72px+env(safe-area-inset-top))]`, replacing the old `h-screen` / `h-[100dvh]` mixed usage
- **FR-006**: The profile page mobile layout MUST include `overflow-x-hidden` to prevent horizontal scroll from gradient bleeds
- **FR-007**: The `modern-card` hover transform MUST be wrapped in `@media (hover: hover)` to prevent stuck hover states on touch devices
- **FR-008**: Glass effect CSS variables MUST use tinted neutrals (slate-tinted whites, navy-tinted blacks) instead of pure `rgba(255,255,255,...)` / `rgba(0,0,0,...)`
- **FR-009**: Hard-coded `text-white` on primary foreground text MUST be replaced with design token references (`text-primary-foreground`, `hsl(var(--primary-foreground))`) in the in-scope files: `HomeClient.tsx`, `SummariesSection.tsx`, `VideosSection.tsx`, `QuizzesSection.tsx`, and `MobileNav.tsx` — remaining 105 files are out of scope for this critical-fix branch
- **FR-010**: All Framer Motion animations and CSS transitions MUST respect `prefers-reduced-motion` by reducing or eliminating motion
- **FR-011**: Duplicate transition properties (e.g., `transition-colors transition-transform`) MUST be consolidated into `transition-[colors,transform]`
- **FR-012**: The DashboardStats grid MUST include a `sm:grid-cols-2` breakpoint to prevent cramped 4-column layout on tablets
- **FR-013**: The header, footer, and main content containers MUST use a unified `max-w-7xl` (1280px) max-width to ensure left/right edge alignment across all layout sections

### Key Entities

- **Viewport Configuration**: The set of CSS properties and meta tags that control how the app renders within the browser viewport (safe-area insets, dvh units, overflow containment)
- **Design Token**: A CSS custom property (`--token-name`) that represents a semantic color, spacing, or typography value, used instead of hard-coded values
- **Responsive Grid Pattern**: A CSS Grid configuration using explicit responsive column breakpoints (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`) that provides predictable column counts at standard viewport widths
- **Motion Preference**: The user's OS-level setting for reduced motion, which the app must query via `prefers-reduced-motion` media feature

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On any notched iOS device, zero pixels of header content are hidden behind the system status bar
- **SC-002**: On any mobile browser with visible chrome, zero pixels of page content are clipped behind the address bar or bottom navigation bar
- **SC-003**: The subjects grid displays correctly aligned cards at any viewport width between 320px and 1536px with zero horizontal overflow
- **SC-004**: The mobile nav drawer can be dismissed by tapping the backdrop on a 320px-wide viewport
- **SC-005**: No card remains in a "stuck" hover-lifted state after a tap on a touch-primary device
- **SC-006**: Zero instances of pure `rgba(255,255,255,...)` or `rgba(0,0,0,...)` in glass effect CSS variables (all replaced with tinted neutrals)
- **SC-007**: When `prefers-reduced-motion` is enabled, no Framer Motion entrance/exit animations are visible and all CSS transitions are reduced to 0ms or minimal duration
- **SC-008**: The profile page has zero horizontal scroll on any viewport width down to 320px (deferred — depends on FR-006, out of scope for this branch)

## Assumptions

- Users on notched devices run browsers that support `env(safe-area-inset-*)` (Safari 11.2+, Chrome 69+)
- The `100dvh` unit has sufficient browser support for the target audience, with `100vh` as a safe fallback
- The existing design token system (`--primary-foreground`, `--foreground`, etc.) is the intended source of truth for colors, and hard-coded values are deviations to be corrected
- RTL layout handling (already present via `dir` attribute and logical properties) will not be affected by these changes
- Framer Motion's `useReducedMotion()` hook is available in the project's version of the library
- FR-006 (profile page `overflow-x-hidden`) is a minor single-class fix that is out of scope for this critical-fix branch; it will be addressed in a follow-up polish pass
- The `@container` query additions are a future enhancement (D-1 from audit) and are out of scope for this critical fix spec
- Fluid typography with `clamp()` is a future enhancement (D-2 from audit) and is out of scope for this critical fix spec
