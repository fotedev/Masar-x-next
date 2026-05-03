# UI Contract: CSS Token Surface

**Branch**: `003-mobile-responsive-fix`
**Phase**: 1 — Interface Contracts
**Generated**: 2026-05-02

This contract defines the CSS custom property surface that all UI components depend on.
Any implementation that changes a value in this contract must preserve the semantic
behaviour described below — consumers must continue to function correctly after the change.

---

## Contract: Glass Effect Variables

These variables are written in `:root` / `.dark` blocks in `src/index.css` and consumed
by any element with the `.glass-card` or `.modern-card` class.

### `--glass-bg`

**Purpose**: Background fill for glass/frosted surfaces.
**Consumers**: `.glass-card`, `.modern-card`, AI chat container
**Contract**: Must be a semi-transparent colour (opacity 0.7–0.9) that allows the surface
behind to show through. Must **not** be pure `rgba(255,255,255,...)` or `rgba(0,0,0,...)` —
must use a brand-tinted neutral.

| Mode | Constraint | Accepted range |
|------|-----------|----------------|
| Light | Slate-tinted white | `rgba(241–255, 245–255, 249–255, 0.7–0.9)` |
| Dark | Navy-tinted dark | `rgba(0–15, 0–23, 0–42, 0.75–0.90)` |

**Breaking change**: Setting opacity to `1` (fully opaque) removes the glass effect and
breaks the visual elevation system. Setting opacity below `0.5` makes text unreadable on
light backgrounds.

---

### `--glass-border`

**Purpose**: 1px border on glass surfaces providing edge definition.
**Consumers**: `.glass-card`, `.modern-card`
**Contract**: Must be semi-transparent (opacity 0.05–0.5). Must be the same hue family as
`--glass-bg`.

| Mode | Constraint |
|------|-----------|
| Light | Slate-tinted white, opacity 0.4–0.6 |
| Dark | Slate-tinted white, opacity 0.05–0.12 (subtle) |

---

### `--card-shadow`

**Purpose**: Box shadow applied to card surfaces at rest.
**Consumers**: `.modern-card`
**Contract**: Must use brand-navy base colour (not pure black). Shadow spread must not
exceed `40px` — larger values cause CLS on first paint.

---

## Contract: Layout Max-Width

All three layout containers share a single canonical max-width after this fix.

**Contract**: `Header`, `Footer`, and `<main>` content wrappers MUST all use `max-w-7xl`
(1280px). Any new full-width layout container added to the project must also use `max-w-7xl`
unless an explicit override is documented with a reason.

**Why this is a contract**: Users perceive horizontal alignment between the navigation bar
and page content. Misaligned max-widths create an inconsistent visual grid that breaks
user trust in the layout.

---

## Contract: Safe-Area Inset Application

**Contract**: The fixed `<header>` element MUST have `padding-top: env(safe-area-inset-top)`
applied **on the element itself**, not on any child element. The viewport meta tag MUST
include `viewport-fit=cover` for this to take effect.

Any component that renders fixed UI at the bottom of the screen (future bottom nav,
toasts pinned to bottom, floating action buttons) MUST apply
`padding-bottom: env(safe-area-inset-bottom)` or equivalent.

---

## Contract: Touch Target Minimum Size

**Contract**: All interactive elements that are the primary action trigger for a feature
MUST have a minimum touch target of `44px × 44px` on mobile. This applies to:
- Hamburger menu button
- Navigation items in the mobile drawer (`min-h-[48px]`)
- Primary action buttons in forms

Visual size may be smaller — the touch target is achieved via padding, not visual size.

---

## Contract: Hover Transform Scope

**Contract**: All `translateY` and `scale` transforms triggered by `:hover` pseudo-class
MUST be wrapped in `@media (hover: hover)`. This prevents stuck-hover states on touch
devices and is a forward-compatibility requirement for any new interactive component
added to the project.

```css
/* Required pattern for ALL hover transforms */
@media (hover: hover) {
  .component:hover {
    transform: translateY(-Xpx);
  }
}
```

Components using Framer Motion's `whileHover` are exempt from the CSS contract but MUST
check `useReducedMotion()` before applying motion (see Motion contract below).

---

## Contract: Motion Preference

**Contract**: All animated components — CSS transitions and Framer Motion — MUST respond
to the `prefers-reduced-motion: reduce` media query by eliminating or minimising motion.

**CSS implementation**: Global `@media (prefers-reduced-motion: reduce)` block in
`index.css` covers all CSS transitions.

**Framer Motion implementation**: Any component using `motion.*` with `variants`,
`whileHover`, `whileTap`, `animate`, or `transition` props MUST import `useReducedMotion`
from `framer-motion` and apply it as follows:

```tsx
import { useReducedMotion } from 'framer-motion';

// Inside component:
const shouldReduceMotion = useReducedMotion();
// Pass static variants when true
```

**Violation definition**: A component that plays a visible position/scale/opacity
animation when `prefers-reduced-motion` is `reduce` violates this contract.

---

## Contract: Responsive Grid

**Contract**: The `SubjectsGrid` component MUST use CSS Grid with explicit column counts
at each Tailwind breakpoint. The pattern `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`
is the canonical form. Any cards within this grid MUST be `w-full` — no `calc()`-based
width expressions are permitted.

The skeleton loading state for `SubjectsGrid` MUST use the same grid container class to
prevent layout shift between loading and loaded states.

---

## Versioning

| Contract | Version | Last changed |
|---|---|---|
| Glass Effect Variables | 1.1 | 2026-05-02 (tinted neutrals) |
| Layout Max-Width | 1.0 | 2026-05-02 (unified to 1280px) |
| Safe-Area Inset | 1.0 | 2026-05-02 |
| Touch Target Minimum | 1.0 | 2026-05-02 |
| Hover Transform Scope | 1.0 | 2026-05-02 |
| Motion Preference | 1.0 | 2026-05-02 |
| Responsive Grid | 1.0 | 2026-05-02 |
