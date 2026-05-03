# Data Model: Mobile Responsive Fix & Design System Alignment

**Branch**: `003-mobile-responsive-fix`
**Phase**: 1 — CSS Entity Surface
**Generated**: 2026-05-02

This feature has no database entities. The "data model" for a UI-layer change is the
**CSS token and layout contract** — the set of CSS custom properties, Tailwind classes,
and layout primitives that components depend on, and whose values change as part of this
fix.

---

## Entity 1 — ViewportConfiguration

Represents the set of meta and CSS properties that control how the browser renders the
app within the physical screen.

| Property | Current Value | Target Value | Scope |
|---|---|---|---|
| `<meta viewport>` | `width=device-width, initial-scale=1` | `width=device-width, initial-scale=1, viewport-fit=cover` | `src/app/layout.tsx` |
| Header height | `h-[72px]` (fixed) | `h-[72px]` + `pt-[env(safe-area-inset-top)]` | `Header.tsx` |
| Layout top padding | `pt-[72px]` (fixed) | `pt-[calc(72px+env(safe-area-inset-top))]` or CSS var | `Layout.tsx` |
| Full-height pages | `h-screen` / `h-[100dvh]` mixed | `h-dvh` (Tailwind 3.4) with `h-screen` fallback | `ai-assistant/page.tsx` |
| Mobile nav bottom | `pb-6` | `pb-[max(1.5rem,env(safe-area-inset-bottom))]` | `MobileNav.tsx` |

**State transitions**:
- `viewport-fit=cover` absent → `env()` returns `0` → safe-area padding = 0 → no visual change (safe fallback)
- `viewport-fit=cover` present → `env()` returns inset px value → header pushed down by that amount

---

## Entity 2 — DesignToken

Represents a CSS custom property (`--name`) or Tailwind semantic class used instead of a
hard-coded value. This entity tracks which tokens currently violate the "no pure white/black"
rule and what replaces them.

### Glass Effect Variables (in `src/index.css`)

| Token | Current | Target | Mode |
|---|---|---|---|
| `--glass-bg` | `rgba(255, 255, 255, 0.8)` | `rgba(248, 250, 252, 0.8)` | light |
| `--glass-bg` | `rgba(15, 23, 42, 0.8)` | `rgba(2, 6, 23, 0.85)` | dark |
| `--glass-border` | `rgba(255, 255, 255, 0.5)` | `rgba(241, 245, 249, 0.5)` | light |
| `--glass-border` | `rgba(255, 255, 255, 0.08)` | `rgba(241, 245, 249, 0.08)` | dark |
| `--card-shadow` | `0 10px 30px -5px rgba(0, 0, 0, 0.05)` | `rgba(2, 6, 23, 0.05)` | light |
| `--card-shadow` | `0 20px 40px -10px rgba(0, 0, 0, 0.3)` | `rgba(2, 6, 23, 0.3)` | dark |

### Nav Item Text (in `MobileNav.tsx` — Tailwind classes, not CSS vars)

| State | Current classes | Target classes |
|---|---|---|
| Inactive | `text-[#a1a1aa]` | `text-slate-600 dark:text-[#a1a1aa]` |
| Inactive hover | `hover:text-white` | `hover:text-slate-900 dark:hover:text-white` |
| Inactive hover bg | `hover:bg-[rgba(255,255,255,0.08)]` | `hover:bg-slate-100 dark:hover:bg-white/8` |
| Active text | `text-white` | `text-slate-900 dark:text-white` |
| Active bg | `bg-[rgba(255,255,255,0.12)]` | `bg-slate-100 dark:bg-white/12` |

### Max-Width Tokens (Layout alignment)

| Location | Current | Target |
|---|---|---|
| `Header.tsx` inner div | `max-w-[1280px]` | `max-w-7xl` |
| `Footer.tsx` inner div | `max-w-[1400px]` | `max-w-7xl` |
| `Layout.tsx` `<main>` | `max-w-[1600px]` | `max-w-7xl` |

---

## Entity 3 — ResponsiveGridPattern

The CSS Grid configuration used by `SubjectsGrid` — replacing the flex-wrap pattern.

**Current pattern (fragile)**:
```
flex flex-wrap justify-center gap-4 sm:gap-6
  w-full sm:w-[calc(50%-12px)] md:w-[calc(33.333%-16px)] lg:w-[calc(25%-18px)]
```

**Target pattern (resilient)**:
```
grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6
  w-full  (card width — natural grid cell fill)
```

**Column count by viewport**:

| Viewport | Breakpoint | Columns | Card approx. width |
|---|---|---|---|
| 320px | base | 2 | ~148px |
| 375px | base | 2 | ~174px |
| 640px | `sm` | 3 | ~197px |
| 768px | `sm` | 3 | ~238px |
| 1024px | `lg` | 4 | ~238px |
| 1280px | `lg` | 4 | ~298px |

**Card minimum content space**: At 2 columns on 320px, cards are ~148px wide minus `p-6`
(24px each side) = ~100px content. Subject name uses `line-clamp-2`, which is sufficient
at this width.

**State transitions**:
- Grid cells are `w-full` — no calc() needed
- `gap` changes from `gap-4` (16px) at base to `gap-6` (24px) at `sm` — only one variable
- Skeleton loading uses identical grid pattern — update in sync with live grid

---

## Entity 4 — MotionPreference

Represents the user's OS-level motion preference and how it maps to animation behaviour
in the two motion layers.

| Layer | Query / Hook | When triggered | Effect |
|---|---|---|---|
| CSS | `@media (prefers-reduced-motion: reduce)` | OS/browser setting | `animation-duration: 0.01ms`, `transition-duration: 0.01ms` for all elements |
| Framer Motion | `useReducedMotion()` | Same OS setting, detected at runtime | Pass static/empty variants; `whileHover` and stagger animations disabled |
| Hover (CSS) | `@media (hover: hover)` | Device has primary hover pointer | `.modern-card:hover` transform enabled only for mouse/trackpad users |

**Components affected by MotionPreference entity**:

| Component | Current motion | Reduced-motion target |
|---|---|---|
| `SubjectsGrid` | `whileHover scale+translateY`, stagger enter | Static opacity only |
| `SummariesSection` | `whileHover translateY`, stagger enter | Static opacity only |
| `VideosSection` | `whileHover translateY`, stagger enter | Static opacity only |
| `QuizzesSection` | `whileHover translateY`, stagger enter | Static opacity only |
| `ChatContainer` | Stagger enter, `NeuralEnergyEntity` animation | Static, no stagger |
| `.modern-card` (CSS) | `hover: translateY(-4px)` always | Only under `(hover: hover)` |
| `.btn-primary` (CSS) | `hover: translateY(-2px)` always | Only under `(hover: hover)` |
| `.btn-secondary` (CSS) | `hover: translateY(-2px)` always | Only under `(hover: hover)` |

**Framer Motion variant pattern** (applied uniformly):
```tsx
const shouldReduceMotion = useReducedMotion();

const containerVariants = shouldReduceMotion
  ? { hidden: { opacity: 0 }, show: { opacity: 1 } }  // no stagger
  : {
      hidden: { opacity: 0 },
      show: { opacity: 1, transition: { staggerChildren: 0.05 } }
    };

const itemVariants = shouldReduceMotion
  ? { hidden: {}, show: {} }          // static
  : { hidden: { opacity: 0 }, show: { opacity: 1 } };
```

---

## Entity Relationships

```
ViewportConfiguration
  └─ drives → Layout top offset
  └─ drives → MobileNav bottom padding
  └─ drives → AI page full-height container

DesignToken
  └─ consumed by → .modern-card (glass-bg, glass-border, card-shadow)
  └─ consumed by → MobileNav items (text/bg states)
  └─ consumed by → Header/Footer/Layout (max-width alignment)

ResponsiveGridPattern
  └─ applied to → SubjectsGrid live render
  └─ applied to → SubjectsGrid skeleton loader (must match)

MotionPreference
  └─ governs → all Framer Motion components (5 components)
  └─ governs → all CSS hover transforms (index.css)
  └─ orthogonal to → touch hover suppression (separate @media hover:hover)
```
