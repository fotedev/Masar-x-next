# Data Model: 026 — Tailwind CSS v4 (Oxide) Upgrade

No database or API entities change. The "data" of this upgrade is the **design-token system** — its schema moves from a JS object (`tailwind.config.js`) to CSS custom properties declared through `@theme`/`@utility` in `src/index.css`.

---

## Entity 1 — Theme tokens

Single source of truth moves: `tailwind.config.js` (retired via `git rm` in C2) → `@theme` blocks in `apps/web/src/index.css`.

| Token group (v3 config key) | Count | v4 representation | Consumed as | Runtime source |
|---|---|---|---|---|
| `theme.extend.colors.ax.*` | 24 tokens | `--color-ax-*: rgb(var(--ax-*-rgb))` | `bg-ax-*`, `text-ax-*`, `border-ax-*` (+ `/alpha`) | `--ax-*-rgb` triplets in `:root`/`html.dark` (unchanged) |
| `theme.extend.colors.brand.*` | 5 | `--color-brand-*: rgb(var(--brand-*))` / hex for purple | `bg-brand-navy`, … | `--brand-*` triplets in `:root`/`.dark` (unchanged) |
| `theme.extend.colors.primary.foreground` | 1 | `--color-primary-foreground: hsl(var(--primary-foreground))` | `text-primary-foreground` | shadcn HSL vars (unchanged) |
| `theme.extend.screens` (xs, tablet only) | 2 | `--breakpoint-xs: 475px; --breakpoint-tablet: 820px` | `xs:`, `tablet:`, `max-tablet:` variants | — |
| `theme.extend.fontSize` | 9 pairs | `--text-*` + `--text-*--line-height` | `text-xs`…`text-5xl` (+ leading overrides) | — |
| `theme.extend.spacing` | 5 | `--spacing-18/88/128`, `--spacing-ax-sidebar*` | `p-18`, `w-ax-sidebar`, … | `--ax-space-sidebar*` (unchanged) |
| `theme.extend.boxShadow` | 3 | `--shadow-ax-sm/md/lg` | `shadow-ax-*` | `--ax-shadow-*` (unchanged) |
| `theme.extend.animation` + `keyframes` | 2 | `--animate-wiggle`, `--animate-ping-slow` + `@keyframes wiggle` inside `@theme` | `animate-wiggle`, `animate-ping-slow` | — |
| `theme.extend.transitionTimingFunction` | 1 | `--ease-ax-standard` | `ease-ax-standard` | `--ax-ease-standard` (unchanged) |
| `theme.extend.transitionDuration` | 3 | **`@utility duration-ax-*`** (no duration namespace in v4) | `duration-ax-fast/base/slow` | `--ax-dur-*` (unchanged) |
| `theme.extend.zIndex` | 6 | **`@utility z-{header,sidebar,modal,popover,toast,tooltip}`** (no z-index namespace in v4) | `z-header`… | — |

**Validation rules**: every token MUST resolve to the identical computed value as v3 (spec FR-003). Verified per-group by the spot-check matrix in quickstart.md.

**Key structural rule**: light/dark switching stays entirely in the runtime CSS custom properties (`--ax-*-rgb`, `--brand-*`, shadcn HSL set) — `@theme` only *references* them. Flattening to static hex values would break dark mode and is forbidden (spec Key Entities).

## Entity 2 — Custom variants

| Variant | v3 definition | v4 definition | Call sites |
|---|---|---|---|
| `dark` | `darkMode: 'class'` config key | `@custom-variant dark (&:where(.dark, .dark *));` | ~all styled components |
| `hover-device` | inline JS plugin `addVariant('hover-device', '@media (any-hover: hover)')` | `@custom-variant hover-device (@media (any-hover: hover));` | 2 (`ChatMessageItem.tsx`) |

**Constraint**: ThemeScript.tsx pre-paint `.dark`-on-`<html>` mechanism untouched (I7); `any-hover` semantics preserved exactly (round-14 ratified limitation carries forward).

## Entity 3 — v3 defaults restoration (compat layer, permanent)

| Rule | Purpose | Scope of protection |
|---|---|---|
| `@layer base { *, ::after, ::before, ::backdrop, ::file-selector-button { border-color: var(--color-gray-200, currentColor); } }` | v4 changed bare `border`/`divide` default from gray-200 → currentColor | ~350 bare-border sites |
| `@theme { --default-ring-width: 3px; --default-ring-color: var(--color-blue-500); }` | v4 changed bare `ring` from 3px/blue-500 → 1px/currentColor | 27 bare-ring sites (still pinned explicitly in C4) |

## Entity 4 — Renamed utilities (call-site migration map)

The full v3→v4 spelling map with measured baseline counts lives in the spec (Story 3 table) and is mirrored as the authoritative contract in [contracts/class-name-contract.md](./contracts/class-name-contract.md). Categories: scale renames (shadow/blur/rounded/backdrop/drop-shadow), `outline-none→outline-hidden`, `bg-gradient-to-*→bg-linear-to-*`, `*-opacity-*→alpha suffix`, `flex-shrink/grow→shrink/grow`, bare-`ring` pinning, `ring-offset` audit, `space-x-reverse` verification.

**Call-site surface**: 223 files with `className` in `apps/web/src`; 147 dynamic template literals across 71 files; class strings in `src/constants/notifications.ts` + `src/constants/assistantUIStyles.ts` (covered by `@source` — see research D15).

## Entity 5 — Unlayered custom CSS (unchanged, protected)

~40 unlayered classes in `index.css` (`.chat-scrollbar-hidden`, `.zane-ul/.zane-ol`, `.ax-chevron`, `.ax-collapse-grid`, `.ax-drawer-*`, `.glass-card`, `.btn-primary`, `.modern-card`, contrast/mobile helpers, `@keyframes gradientShift/ax-badge-pop/ax-content-fade/ax-tooltip-fade`) — preserved verbatim (FR-008). v4's real cascade layers keep unlayered author CSS winning over layered utilities (same precedence outcome as v3's faked layers).

## Entity 6 — Dependencies (apps/web/package.json)

| Package | Before | After |
|---|---|---|
| `tailwindcss` | `^3.4.1` (3.4.19) | `^4` (latest 4.x) |
| `postcss` | `^8.4.35` (8.5.26) | unchanged |
| `autoprefixer` | `^10.4.18` (10.5.4) | **removed** (v4 includes prefixing) |
| `@tailwindcss/postcss` | — | **added** `^4` |
| `tailwind-merge` | `^3.5.0` (3.6.0) | unchanged (v4 grammar verified — research D12) |
