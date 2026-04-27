---
name: Masar X
description: AI-powered academic platform for Arabic-speaking university students — study smarter, learn faster.
colors:
  midnight-navy: "#0f172a"
  midnight-abyss: "#020617"
  interface-blue: "#3b82f6"
  interface-blue-muted: "#60a5fa"
  horizon-sky: "#0ea5e9"
  horizon-sky-muted: "#38bdf8"
  amber-catalyst: "#f59e0b"
  amber-catalyst-warm: "#fbbf24"
  signal-violet: "#8b5cf6"
  surface-light: "#ffffff"
  surface-dark: "#020617"
  surface-raised-light: "#f1f5f9"
  surface-raised-dark: "#1e293b"
  surface-card-dark: "#1f2937"
  text-primary-light: "#0f172a"
  text-primary-dark: "#f8fafc"
  text-muted-light: "#64748b"
  text-muted-dark: "#94a3b8"
  border-light: "#e2e8f0"
  border-dark: "#1e293b"
  destructive: "#ef4444"
  success: "#10b981"
typography:
  display:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "0.01em"
  arabic-display:
    fontFamily: "Almarai, Cairo, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.3
  arabic-body:
    fontFamily: "Almarai, Cairo, Segoe UI, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.7
  arabic-label:
    fontFamily: "Almarai, Cairo, Segoe UI, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  2xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.midnight-navy}"
    textColor: "{colors.surface-light}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.interface-blue}"
    textColor: "{colors.surface-light}"
  button-secondary:
    backgroundColor: "{colors.interface-blue}"
    textColor: "{colors.surface-light}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.horizon-sky}"
    textColor: "{colors.surface-light}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary-light}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary-light}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card-base:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.text-primary-light}"
    rounded: "{rounded.lg}"
    padding: "24px"
  card-glass:
    backgroundColor: "rgba(255,255,255,0.8)"
    textColor: "{colors.text-primary-light}"
    rounded: "{rounded.2xl}"
    padding: "20px"
  input-default:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.text-primary-light}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  chip-default:
    backgroundColor: "{colors.surface-raised-light}"
    textColor: "{colors.text-muted-light}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  chip-active:
    backgroundColor: "{colors.interface-blue}"
    textColor: "{colors.surface-light}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  badge-blue:
    backgroundColor: "#dbeafe"
    textColor: "#1d4ed8"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  badge-green:
    backgroundColor: "#d1fae5"
    textColor: "#065f46"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  badge-purple:
    backgroundColor: "#ede9fe"
    textColor: "#5b21b6"
    rounded: "{rounded.full}"
    padding: "2px 10px"
---

# Design System: Masar X

## 1. Overview

**Creative North Star: "The Scholar's Command Center"**

Masar X is a high-performance tool first, an educational platform second. The visual language borrows from the best productivity tools — the purposeful density of Linear, the calm intelligence of Notion, the responsive precision of Raycast — and applies them to a bilingual academic context. Every surface either serves the learning task directly or gets out of the way. Nothing decorates for decoration's sake.

The system is dark-primary. Not because "tools look dark" but because the primary user is a student at midnight, in a dim room, preparing for an exam. Light mode exists and is equally considered, but dark mode carries the most design investment. Surfaces are deep slate, accents are restrained, and the amber highlight fires only when action is required.

This system is bilingual at the core. Arabic (Almarai) and English (Inter) are co-equal scripts — not translation layers applied on top of a Latin-first layout. RTL is a first-class layout direction. Typography scales, line-heights, and letter-spacing are tuned independently for each script.

This system explicitly rejects: the cluttered sidebar hell of Moodle and legacy Blackboard; the dry institutional gray of government portals; the startup-template blob-and-gradient aesthetic; and any hero section with a stock photo and a floating card of metrics.

**Key Characteristics:**
- Dark-primary; light mode fully supported
- Glass morphism used structurally, not decoratively
- Bilingual RTL/LTR with per-script type tuning
- Motion is earned: flat at rest, animated on interaction
- Amber is the single action signal; blue handles navigation and structure
- Density is context-aware: rich in browsing, quiet in reading

---

## 2. Colors: The Midnight Scholar Palette

A deep navy foundation with a cool-blue structural accent and a single warm amber for action. The palette is precise and restrained — each color has a defined role and does not cross into another's territory.

### Primary
- **Midnight Navy** (`#0f172a` light / `#020617` dark): The foundation. Used for the primary button background, the dark-mode surface, and any element that carries maximum visual authority. In light mode it reads as a near-black with a pronounced blue undertone. In dark mode it becomes almost lightless. Never used decoratively.
- **Interface Blue** (`#3b82f6` light / `#60a5fa` dark): The structural signal. Navigation links, interactive elements, active states, focus rings, and information-category badges. High saturation for visibility, cooled slightly in dark mode to reduce eye strain at low ambient light.

### Secondary
- **Horizon Sky** (`#0ea5e9` light / `#38bdf8` dark): The secondary action color, used where Interface Blue would create ambiguity. Secondary buttons, gradient transitions alongside Interface Blue, link hover states. Cooler and lighter than Interface Blue — sits comfortably alongside it without competing.

### Tertiary
- **Amber Catalyst** (`#f59e0b` light / `#fbbf24` dark): The single warm note in an otherwise cool palette. Used exclusively for primary calls-to-action, progress indicators, and the AI-assistant accent. Its rarity is intentional. If Amber Catalyst appears on more than 10% of any screen, the design is wrong.
- **Signal Violet** (`#8b5cf6`): Reserved for AI, quiz, and gamification contexts. Differentiates the intelligent layer of the product from the content layer. Used sparingly.

### Neutral
- **Surface Light** (`#ffffff`): Light mode page background.
- **Surface Dark / Midnight Abyss** (`#020617`): Dark mode page background. Not pure black — carries a deep blue undertone that keeps the navy brand present.
- **Surface Raised Light** (`#f1f5f9`): Muted backgrounds, secondary sections, input fills.
- **Surface Raised Dark** (`#1e293b`): Elevated dark surfaces — sidebar panels, modals, section containers.
- **Surface Card Dark** (`#1f2937`): Card background in dark mode when not using glass treatment.
- **Text Primary Light** (`#0f172a`) / **Text Primary Dark** (`#f8fafc`): Body text, headings. Never pure black or pure white.
- **Text Muted Light** (`#64748b`) / **Text Muted Dark** (`#94a3b8`): Captions, secondary labels, placeholder text.
- **Border Light** (`#e2e8f0`) / **Border Dark** (`#1e293b`): Structural dividers and card outlines.
- **Destructive** (`#ef4444`): Error states, delete actions. Never used for emphasis.
- **Success** (`#10b981`): Completion, correct answers, positive status.

### Named Rules
**The Amber Gate Rule.** Amber Catalyst is the only color that triggers action. Primary CTAs, submit buttons, and AI-response indicators use Amber. Interface Blue handles navigation and structure. If you reach for Amber for a non-action element, stop and use Blue instead.

**The Two-Script Rule.** Every color decision must pass both Inter and Almarai. A text color that provides sufficient contrast in Inter may behave differently against Arabic letterforms at the same size. Always test in both scripts before finalizing.

---

## 3. Typography

**Display / Headline / UI Font:** Inter (with Segoe UI, system-ui, sans-serif fallback)
**Arabic Display / Body Font:** Almarai (with Cairo, Segoe UI fallback)
**Mono (code, IDs):** System monospace stack

**Character:** Inter is neutral precision — it disappears into the content and lets information lead. Almarai is structured and legible at body sizes, with a warmth that suits Arabic letterforms without veering into decorative. Together they project calm authority across both scripts.

### Hierarchy

- **Display** (700, clamp(2rem, 5vw, 3rem), lh 1.1, ls -0.02em): Page-level hero headings. Used once per view maximum.
- **Headline** (700, 1.875rem, lh 1.2, ls -0.01em): Section titles, modal headers, empty-state callouts.
- **Title** (600, 1.25rem, lh 1.4): Card headings, sidebar section labels, tab titles.
- **Body** (400, 1rem, lh 1.5): All prose content. Max line length 65–75ch in reading contexts. Never narrower than 45ch.
- **Label** (500, 0.875rem, lh 1.25, ls 0.01em): UI labels, button text, badge text, metadata.

#### Arabic Overrides
- **Arabic Display** (700, clamp(2rem, 5vw, 3rem), lh 1.3): Display in RTL contexts. Line-height increased from 1.1 to 1.3 to accommodate Arabic ascenders and descenders.
- **Arabic Body** (400, 1rem, lh 1.7): Line-height increased to 1.7 for Arabic paragraph readability. Letter-spacing left at `normal` — never apply negative letter-spacing to Arabic.
- **Arabic Label** (500, 0.875rem, lh 1.4): Same weight as Label, wider line-height.

### Named Rules
**The Script Respect Rule.** Never apply `letter-spacing` other than `normal` to Arabic text. Never apply `text-transform: uppercase` to Arabic. Both properties are meaningless or harmful for Arabic script.

**The RTL Mirror Rule.** All directional UI elements — back arrows, chevrons, progress bars, tab underlines — must be mirrored in RTL. The `dir="auto"` attribute is used on content containers; `[locale === 'ar' ? 'rotate-180' : '']` handles directional icons explicitly.

---

## 4. Elevation

Masar X uses a hybrid elevation system: glass morphism for primary content surfaces, structural shadows for interactive lift states, and tonal layering for background depth. Nothing is purely flat; nothing is aggressively dimensional.

**Glass is structural, not decorative.** The `.modern-card` pattern — `backdrop-filter: blur(12–20px)` over a semi-transparent navy or white background — is the primary card treatment. It signals interactive surface and provides depth without opaque stacking. Glass is used on cards, modals, and the scroll-aware header. It is not used on form fields, inline text, or utility components.

**Shadows mark interaction, not rest.** Elements are flat at rest. Hover and focus states introduce lift via `translateY(-2px)` to `translateY(-8px)` paired with a deepened shadow. This motion communicates "this is interactive" without a permanent shadow tax on every surface.

### Shadow Vocabulary
- **Card rest** (`0 10px 30px -5px rgba(0,0,0,0.05)` light / `0 20px 40px -10px rgba(0,0,0,0.3)` dark): Default card surface at rest. Subtle in light mode, more pronounced in dark to separate surfaces.
- **Button ambient** (`0 4px 12px rgba(15,23,42,0.2)`): Primary button default shadow. Conveys weight without drama.
- **Button hover lift** (`0 8px 20px rgba(15,23,42,0.3)`): Applied alongside `translateY(-2px)` on button hover.
- **Card hover lift** (`0 30px 60px -12px rgba(0,0,0,0.2)`): Applied alongside `translateY(-8px)` on modern-card hover.
- **Active state scale** (`shadow-md + scale-[1.02]`): Sidebar lecture items and selected list items. Slight scale with medium shadow conveys selection without color alone.

### Named Rules
**The Glass Containment Rule.** Never nest a glass card inside another glass card or glass container. Glass works because it has a real surface behind it. Stacked glass reads as noise, not depth.

**The Flat-By-Default Rule.** Shadows are a response to state, not a default styling choice. A component at rest earns its shadow only if it needs to read as a distinct surface from its background. Form fields, labels, and inline UI do not get shadows.

---

## 5. Components

### Buttons
Clean, direct, and animated on interaction. Lift communicates affordance.

- **Shape:** Rounded medium (`rounded-md`, 8px). Product actions use `rounded-xl` (12px) for slightly softer feel in content-heavy contexts.
- **Primary:** Midnight Navy background, white text, 8px 16px padding. Gradient variant (`linear-gradient(135deg, #0f172a, #1e3a8a)`) used in hero and onboarding contexts for brand presence.
- **Secondary:** Interface Blue fill, white text. Used for navigation-adjacent actions.
- **Ghost:** Transparent, text color matches context. Used in toolbars and icon-adjacent labels.
- **Outline:** Transparent with `border border-input`. Used for secondary options alongside a primary.
- **Hover / Focus:** `translateY(-2px)` + deepened shadow at `0.3s cubic-bezier(0.4,0,0.2,1)`. Focus ring: `ring-2 ring-ring ring-offset-2`.
- **Disabled:** `opacity-50`, `pointer-events-none`. Never hidden.
- **Sizes:** `sm` (h-9, px-3), `default` (h-10, px-4), `lg` (h-11, px-8), `icon` (h-10 w-10).

### Chips / Badges
Used for metadata display (exam type, date, subject) and filter selection.

- **Default chip:** Slate-100 background, muted text, `rounded-full`, `py-0.5 px-2.5`. Small (xs/sm font).
- **Active chip:** Interface Blue fill, white text. Same shape.
- **Contextual badges:** Blue (`bg-blue-100 text-blue-800`), Green (`bg-green-100 text-green-800`), Purple (`bg-purple-100 text-purple-800`). Used for exam metadata tags on summary cards. Color-coding is supplemented with emoji icons (📅 📝 📚) to remain accessible without color alone.

### Cards / Containers
Two idioms coexist:

- **Base Card:** `rounded-lg border bg-white dark:bg-gray-800 shadow-sm`. Used for admin panels, settings sections, and utility containers where transparency would create noise.
  - Internal padding: `p-6` (24px). Header uses `flex-col space-y-1.5`. Footer uses `flex items-center`.
- **Glass Card (`.modern-card`):** `border-radius: 24px`, `backdrop-filter: blur(12px)`, semi-transparent navy/white background, glass border (`rgba(255,255,255,0.5)` light / `rgba(255,255,255,0.08)` dark). Used for primary content surfaces on the home screen, subject pages, and course cards.
  - Hover: `translateY(-8px)`, deeper shadow, border-color transitions to Interface Blue.
  - Internal padding: `p-5` (20px).
- **Nested cards are never used.** If content inside a card needs grouping, use spacing and typography hierarchy, not another card.

### Inputs / Fields
- **Style:** Full-width, `h-10`, `rounded-md`, `border border-input`, `bg-background`. Clean and undecorated.
- **Placeholder:** `text-muted-foreground`. Never uses color to convey required state.
- **Focus:** `ring-2 ring-ring ring-offset-2`. No glow effect — ring is precise and accessible.
- **Error:** Border switches to `destructive`. Error message below field in label size, red, with an icon.
- **Disabled:** `opacity-50 cursor-not-allowed`.
- **Mobile:** `font-size: 16px` minimum on all inputs to prevent iOS zoom on focus.

### Navigation
- **Header:** Sticky top, full-width. Scroll-aware: on scroll past 20px, gains glass treatment (`backdrop-filter`, border-bottom). Contains logo, desktop nav links, language toggle, user menu, theme toggle.
- **Desktop nav links:** Text `sm`/`base` weight medium. Active state uses Interface Blue. Hover transitions at `0.2s`.
- **Mobile nav:** Full-height overlay when open. Closes on Escape key, focus returns to trigger button. `max-height: calc(100vh - 4rem)` with scroll.
- **Sidebar (Subject view):** Lecture list with `rounded-2xl` items. Selected: `bg-blue-50 border-blue-500 dark:bg-blue-900/20 dark:border-blue-500 shadow-md scale-[1.02]`. Unselected: transparent border, hover fills with slate-50. Internal count icons (FileText, Video, BookOpen) are color-coded per type.

### AI Assistant
The AI surface has a distinct visual register — slightly elevated over standard product UI to signal "this is the intelligent layer."

- **Chat container:** Full-height on desktop, `calc(100vh - 64px)` on mobile. Custom scrollbar (`scrollbar-width: thin`, slate-400/30 thumb).
- **Message bubbles:** User messages right-aligned (left-aligned in RTL), AI messages left-aligned (right-aligned in RTL). Differentiated by background: user gets Interface Blue tint, AI gets surface-raised.
- **Input area:** Sticky bottom, textarea that grows with content. Send button uses Amber Catalyst when content is present.

### Skeleton / Loading States
All loading states use `Skeleton` components with matching shape and size to the content they replace. No spinners as primary loading indicators in content areas. Framer Motion stagger-fade (`staggerChildren: 0.05`) on list reveals.

---

## 6. Do's and Don'ts

### Do:
- **Do** use dark mode as the primary design target. Light mode receives equal technical support but dark receives equal aesthetic investment.
- **Do** mirror all directional elements in RTL: arrows, chevrons, progress bars, slide-in panels, scroll direction indicators. Use `rotate-180` on directional icons when `locale === 'ar'`.
- **Do** set `line-height: 1.7` for Arabic body text and `line-height: 1.3` minimum for Arabic display. Arabic needs more vertical breathing room than Latin at every scale.
- **Do** constrain Amber Catalyst to actions and AI indicators only. Its rarity is the point.
- **Do** use `cubic-bezier(0.4, 0, 0.2, 1)` at `0.3–0.4s` for all hover and state transitions. Do not deviate without a documented reason.
- **Do** use `prefers-reduced-motion` media query to disable all `translateY`, scale, and stagger animations for users who have requested it.
- **Do** keep touch targets at `min-height: 44px` minimum, `48px` preferred on mobile.
- **Do** use icon + color for all semantic states (success, error, warning, pending) — never color alone.
- **Do** cap body prose at 65–75ch in reading contexts (summary views, course content). Wider text degrades readability in Arabic and English alike.
- **Do** use the `modern-card` glass treatment for primary interactive content surfaces. Use the base `Card` for utility containers, admin panels, and settings.
- **Do** set `font-size: 16px` on all form inputs to prevent iOS zoom on focus.

### Don't:
- **Don't** use gradient text (`background-clip: text` with a gradient fill). The `.text-gradient-primary` and `.text-gradient-secondary` utility classes exist in the codebase but violate the design language. Remove them from new components. Use a solid `Interface Blue` or `Midnight Navy` instead.
- **Don't** stack glass surfaces. A glass card inside a glass container produces visual noise with no depth signal. One layer of glass per elevation step.
- **Don't** reproduce the legacy LMS pattern: dense multi-level sidebar with 20+ items, tabular data as the primary content view, no visual hierarchy between sections. This is an explicit anti-reference from PRODUCT.md.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on cards, alerts, or list items. Rewrite with full border, background tint, or a leading icon.
- **Don't** apply `letter-spacing` other than `normal` to Arabic text. Do not apply `text-transform: uppercase` to Arabic text.
- **Don't** use bounce or elastic easing. No spring physics. Ease out with `cubic-bezier(0.4,0,0.2,1)` or tighter variants only.
- **Don't** animate CSS layout properties (`width`, `height`, `top`, `left`, `margin`, `padding`). Animate `transform` and `opacity` only.
- **Don't** use glassmorphism as decoration. If a component uses `backdrop-filter` without a structural reason — something behind it that benefits from the blur — use a solid surface instead.
- **Don't** use the hero-metric template: big number, small label, supporting stats, gradient accent. This is a SaaS dashboard cliché that contradicts Masar X's editorial intelligence.
- **Don't** treat the AI assistant as a floating widget bolted onto the product. Its surface is integrated — it shares the navigation shell and type system, and its accent (Signal Violet / Amber) is applied only to AI-specific affordances.
- **Don't** build identical card grids: same-sized cards with icon + heading + text, repeated with no variation in density, size, or hierarchy. Content of different types (summaries, quizzes, courses) must have visually distinct card treatments.
- **Don't** use modals as a first response to user actions. Inline expansion, side panels, and progressive disclosure are preferred. Modals are reserved for irreversible destructive actions and multi-step flows with no logical inline location.