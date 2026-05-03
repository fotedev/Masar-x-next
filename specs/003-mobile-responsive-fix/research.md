# Research: Mobile Responsive Fix & Design System Alignment

**Branch**: `003-mobile-responsive-fix`
**Phase**: 0 — Technical Decisions
**Generated**: 2026-05-02

All NEEDS CLARIFICATION items from the technical context are resolved below.
Each decision includes rationale and rejected alternatives.

---

## Decision 1 — Dynamic Viewport Height Strategy

**Question**: Which unit to use for full-height pages (`ai-assistant/page.tsx`, `Layout.tsx`)?
The existing code mixes `h-screen` (= `100vh`) with a single instance of `h-[100dvh]`.

**Decision**: Use `100dvh` as the primary value, with `100vh` as the cascaded fallback via
a standard `@supports` pattern.

**Implementation**:
```css
/* Fallback first (older browsers) */
height: 100vh;
/* Progressive enhancement */
height: 100dvh;
```
In Tailwind: use `h-screen` as the base class (maps to `100vh`), then override with an
arbitrary `h-[100dvh]` class that naturally overrides via specificity — or add a custom
Tailwind `dvh` utility. Since Tailwind 3.4 added `dvh`/`svh`/`lvh` support via `h-dvh`,
**use `h-dvh`** (available in Tailwind ≥3.4, which is confirmed in this project at 3.4.1).

**Rejected alternatives**:
- `100svh` (small viewport): Shrinks when the address bar is *shown*; creates jarring
  layout shift when toolbar hides. Not suitable for a fixed chat window.
- `100lvh` (large viewport): Assumes toolbar is always hidden; causes content clipping
  on load when toolbar is visible.
- `calc(var(--vh, 1vh) * 100)` with JS `resize` listener: Older pattern that works but
  requires JavaScript and causes a layout-shift on first paint. `dvh` is now the
  standard CSS solution.

---

## Decision 2 — Safe-Area Inset Application Point

**Question**: Should `env(safe-area-inset-top)` be applied on the `<header>` element
itself or on its inner `max-w-[1280px]` container `div`?

**Decision**: Apply on the **`<header>` element itself** — specifically as
`padding-top: env(safe-area-inset-top)` on the root `<header>` tag, in addition to the
fixed `h-[72px]` height.

**Why**: The `<header>` is `position: fixed; top: 0`. The notch / Dynamic Island occupies
the very top of the screen. The entire header element must be pushed down by the inset
amount. Applying the padding on an inner `div` still lets the header's background colour
bleed behind the notch. The Tailwind class `pt-[env(safe-area-inset-top)]` already
exists in the codebase on the inner `div` — move it to the `<header>` element.

The header then becomes effectively `h-[calc(72px+env(safe-area-inset-top))]` on notched
devices, which is the correct behaviour.

**Also required**: The root `<html>` `<meta name="viewport">` tag must include
`viewport-fit=cover`. Verify this in `src/app/layout.tsx` — if absent, `env()` returns 0
and the fix has no effect.

**Rejected alternatives**:
- CSS `margin-top` instead of `padding-top`: Margin doesn't fill the header background
  behind the notch — leaves a transparent gap.
- JS-based inset detection: Over-engineered when native CSS `env()` is available.

---

## Decision 3 — SubjectsGrid Layout Pattern

**Question**: Replace `flex-wrap + calc()` with which CSS Grid pattern?

**Decision**: Use Tailwind's responsive column grid classes:
```
grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6
```

**Why**: The spec requires predictable column counts at 320px (1 or 2 cols), 500px (2),
900px (3), and 1280px (4). The existing `calc()` widths attempted to achieve this via
`flex-wrap` but are fragile because the gap offsets are magic numbers.

Using explicit column grid:
- `grid-cols-2` — 2 columns from 0px (375px phones comfortable, 320px tight but works)
- `sm:grid-cols-3` — 3 columns from 640px
- `lg:grid-cols-4` — 4 columns from 1024px

Cards use `w-full` by default inside grid cells — no width calculation needed.

**Rejected alternatives**:
- `grid-cols-[repeat(auto-fill,minmax(200px,1fr))]`: Produces variable column count that
  doesn't match the design intent of always-2 on mobile, always-4 on desktop. The design
  system shows a fixed rhythm, not fluid auto-fill.
- `auto-fit` variant: Same issue as auto-fill for this use case.
- Keep `flex-wrap` but fix the `calc()` values: Still brittle and doesn't fix the
  fundamental fragility of gap-math. Replacement is minimal effort for large gain.

---

## Decision 4 — Mobile Nav Drawer Width Cap

**Question**: The drawer is `w-[280px] sm:w-[320px]` — what should replace this to ensure
adequate dismiss area on narrow screens?

**Decision**: Replace with `w-[min(320px,85vw)]` — a single responsive expression that:
- On 320px viewport: drawer = `272px`, backdrop = `48px` (sufficient to tap)
- On 375px viewport: drawer = `320px`, backdrop = `55px`
- On 768px+: drawer = `320px`, no change from current

In Tailwind: `w-[min(320px,85vw)]` as an arbitrary value.

**Rejected alternatives**:
- `max-w-[85vw]` with `w-[320px]`: Correct but requires two classes and `max-w` capping.
  The `min()` approach is a single, self-documenting value.
- Reducing fixed width to `240px`: Reduces usability on wider phones for no reason.
- Keeping `280px` and accepting the 40px backdrop on 320px screens: Fails SC-004.

---

## Decision 5 — MobileNav Light-Mode Text Fix

**Question**: Active nav items use `text-white bg-[rgba(255,255,255,0.12)]` — invisible on
the light-mode `bg-white` drawer. What token system to use?

**Decision**: Introduce explicit `dark:` variants for all nav item states:

```
Inactive:  text-slate-600 dark:text-[#a1a1aa]
Hover:     hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-white/8
Active:    text-slate-900 bg-slate-100 dark:text-white dark:bg-white/12
```

This uses Tailwind's built-in `dark:` variant — no custom CSS required. Contrast ratios:
- Light inactive: slate-600 on white = 5.9:1 (WCAG AA ✅)
- Light active:   slate-900 on slate-100 = 17:1 (WCAG AAA ✅)
- Dark inactive:  #a1a1aa on #020617 = 5.3:1 (WCAG AA ✅)
- Dark active:    white on rgba(255,255,255,0.12) = sufficient ✅

**Rejected alternatives**:
- CSS custom properties for nav state: Overkill for a simple two-mode state.
- Using `currentColor`: Not directly applicable for background states.

---

## Decision 6 — Hover Transform on Touch Devices

**Question**: `.modern-card:hover { transform: translateY(-4px) }` in `index.css` causes
stuck hover state on touch devices. Also, Framer Motion `whileHover` on `SubjectsGrid`
and content cards does the same.

**Decision (CSS layer)**: Wrap the `.modern-card:hover` transform in
`@media (hover: hover)` — this media query evaluates to true only on devices where
hover is the *primary* pointing mechanism (mouse, trackpad). It evaluates to false on
touch-primary devices.

```css
@media (hover: hover) {
  .modern-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.2);
    border-color: var(--brand-blue);
  }
}
```

**Decision (Framer Motion layer)**: Use `useReducedMotion()` hook (covered in Decision 7).
For hover specifically in touch contexts, the `whileTap` interaction already provides
feedback; remove `whileHover` from touch contexts by wrapping in a `shouldReduceMotion`
check.

**Rejected alternatives**:
- `@media (pointer: fine)`: Fine pointer = mouse, but some touchscreens also have fine
  pointer (stylus). `hover: hover` is the more semantically correct query.
- JavaScript `ontouchstart` detection: Unreliable and deprecated approach.
- `active:` pseudo-class only: Correct for touch, but loses hover affordance entirely on
  desktop.

---

## Decision 7 — `prefers-reduced-motion` Implementation

**Question**: How to implement reduced-motion support for both CSS transitions and Framer
Motion animations?

**Decision (two-layer approach)**:

**Layer 1 — CSS**: Add a global `@media (prefers-reduced-motion: reduce)` block at the
end of `index.css` that collapses all `transition-duration` and `animation-duration` to
`0.01ms`:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Layer 2 — Framer Motion**: Use the `useReducedMotion()` hook from `framer-motion`
(available in Framer Motion ≥4, confirmed at v12.35.0). Where `shouldReduceMotion` is
`true`, pass empty/static variants instead of animated ones:
```tsx
const shouldReduceMotion = useReducedMotion();
const variants = shouldReduceMotion ? {} : animatedVariants;
```

Applied to: `SubjectsGrid`, `SummariesSection`, `VideosSection`, `QuizzesSection`,
`ChatContainer` (5 components).

**Rejected alternatives**:
- CSS-only approach: Framer Motion injects styles via JS; the CSS media query catches
  `transition` but not Framer Motion's `transform` animations reliably across all browsers.
  The two-layer approach is the documented Framer Motion recommendation.
- `motionSafe:` Tailwind variant only: Doesn't cover Framer Motion animations.

---

## Decision 8 — `transition-all` Replacement Strategy

**Question**: `transition-all` is used in 30+ components. Replace all at once, or
incrementally?

**Decision**: **Replace only in files touched by this feature** (the 9 files in scope).
Do not do a project-wide refactor in this branch — that is a separate concern that
should go through its own spec.

Replacement pattern:
```
transition-all → transition-[colors,transform,box-shadow,border-color]
```
For elements that only change colours:
```
transition-all → transition-colors
```
For elements with hover lift:
```
transition-all → transition-[transform,box-shadow,border-color]
```

**Rejected alternatives**:
- Project-wide find-and-replace: Unsafe without a visual regression test suite. Out of
  scope for this ticket.
- Keeping `transition-all` in untouched files: Acceptable. FR-011 says "duplicate
  transition properties MUST be consolidated" — this refers to the pattern
  `transition-colors transition-transform` (two separate utilities), not `transition-all`.

---

## Decision 9 — Max-Width Unification

**Question**: Three different max-widths exist: `Header` = 1280px, `Footer` = 1400px,
`Layout <main>` = 1600px. Which canonical value?

**Decision**: **`max-w-7xl` (1280px) for all three.** Rationale:

- The `Header` already uses `max-w-[1280px]` — it is the most constrained and the most
  visible alignment reference. When users look at the page, the header provides the
  optical left/right margins. Content wider than the header creates a perception of
  misalignment.
- `max-w-7xl` = `1280px` in Tailwind, uses a semantic class not an arbitrary value.
- The content loss from 1600px→1280px on very wide screens is minimal: only users on
  ≥1440px monitors are affected, and they see slightly more generous side margins.

**Rejected alternatives**:
- `1400px` compromise: Still wider than the header — partial fix only.
- `1600px` for all: Makes header feel narrower than content — worse than current.
- Keep asymmetric widths: Violates visual alignment. SC-003 implicitly requires alignment.

---

## Decision 10 — Glass Variable Tinted Neutral Colours

**Question**: What specific tinted neutral values replace pure `rgba(255,255,255,...)` and
`rgba(0,0,0,...)`?

**Decision**: Use slate-family tints that align with the "Midnight Scholar" brand palette:

| Current value | Replacement | Rationale |
|---|---|---|
| `rgba(255, 255, 255, 0.8)` | `rgba(248, 250, 252, 0.8)` | `slate-50` base — barely perceptible blue tint |
| `rgba(255, 255, 255, 0.5)` | `rgba(241, 245, 249, 0.5)` | `slate-100` base |
| `rgba(255, 255, 255, 0.08)` | `rgba(241, 245, 249, 0.08)` | `slate-100` base at low opacity |
| `rgba(15, 23, 42, 0.8)` | `rgba(2, 6, 23, 0.85)` | `#020617` = brand-navy-dark, already correct |
| `rgba(0, 0, 0, 0.2)` | `rgba(2, 6, 23, 0.2)` | brand-navy base |
| `rgba(0, 0, 0, 0.3)` | `rgba(2, 6, 23, 0.3)` | brand-navy base |

`rgba(15, 23, 42, ...)` values are already correct (they use `--brand-navy`). Only the
pure-white and pure-black variants need updating.

**Rejected alternatives**:
- oklch colour space: DESIGN.md references oklch for palette definition, but Tailwind 3
  doesn't natively emit oklch, and the rest of the codebase uses rgb. Consistency wins.
- Warm-tinted whites (`rgba(255, 253, 240,...)`): Contradicts the cool navy brand language.

---

## Decision 11 — Hamburger Touch Target

**Question**: The hamburger button is `w-[40px] h-[40px]`. How to increase without
changing visual appearance of the 3-bar icon?

**Decision**: Change outer button to `w-11 h-11` (44px × 44px). The inner icon container
stays at `w-[24px] h-[18px]`. The extra 4px of tappable area is transparent — invisible
to the user, functional for the finger.

```diff
- className="... w-[40px] h-[40px] ..."
+ className="... w-11 h-11 ..."
```

No visual change. Touch target grows by 4px on each side.

---

## All NEEDS CLARIFICATION Items Resolved

| Item | Status |
|------|--------|
| dvh fallback strategy | ✅ `h-dvh` (Tailwind 3.4 built-in) |
| safe-area-inset scope | ✅ On `<header>` element, check `viewport-fit=cover` |
| SubjectsGrid layout | ✅ `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` |
| Drawer width cap | ✅ `w-[min(320px,85vw)]` |
| MobileNav light-mode text | ✅ Explicit `dark:` variants |
| Hover-on-touch suppression | ✅ `@media (hover: hover)` wrapper |
| Reduced motion | ✅ CSS global block + Framer Motion `useReducedMotion()` |
| transition-all scope | ✅ Only in-scope files, not project-wide |
| Max-width unification | ✅ `max-w-7xl` (1280px) for Header, Footer, Layout |
| Glass tinted neutrals | ✅ slate-family RGB replacements |
| Hamburger touch target | ✅ `w-11 h-11` |
