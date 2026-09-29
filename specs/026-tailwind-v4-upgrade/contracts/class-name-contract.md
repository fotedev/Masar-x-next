# Contract: Utility class-name API (026)

**Consumers**: 223 files with `className` under `apps/web/src`, plus class strings in `src/constants/notifications.ts` and `src/constants/assistantUIStyles.ts`, plus `tailwind-merge` (`cn()` helpers) and the e2e suites.

This is the contract the upgrade MUST preserve or explicitly migrate. "Preserved" = same class string resolves to the same computed style before and after the upgrade.

## 1. Preserved names (no call-site change)

| Contract surface | Examples | Basis in v4 |
|---|---|---|
| ax color palette | `bg-ax-canvas`, `text-ax-primary`, `border-ax-edge`, `bg-ax-accent-soft`, `bg-ax-accent/50`, `text-ax-on-accent`, `bg-ax-tooltip-bg` | `--color-ax-*` (flattened nesting) |
| brand colors | `bg-brand-navy`, `text-brand-sky`, `bg-brand-purple` | `--color-brand-*` |
| `primary-foreground` | `text-primary-foreground` | `--color-primary-foreground` |
| breakpoints | `xs:`, `tablet:`, `max-tablet:` | `--breakpoint-xs/tablet` |
| font scale | `text-xs`…`text-5xl` (+ their line-heights) | `--text-*` pairs |
| named spacing | `p-18`, `w-88`, `h-128`, `w-ax-sidebar`, `w-ax-sidebar-collapsed` | `--spacing-*` |
| ax shadows | `shadow-ax-sm/md/lg` | `--shadow-ax-*` |
| animations | `animate-wiggle`, `animate-ping-slow` | `--animate-*` + keyframes |
| easing | `ease-ax-standard` | `--ease-ax-standard` |
| z-index names | `z-header`, `z-sidebar`, `z-modal`, `z-popover`, `z-toast`, `z-tooltip` | static `@utility z-*` |
| named durations | `duration-ax-fast/base/slow` | static `@utility duration-ax-*` |
| custom variants | `dark:*`, `hover-device:*` | `@custom-variant` |
| dynamic spacing scale | `p-17`, `gap-13`, … (v4 numeric scale) | `--spacing` base |

## 2. Renamed names (mechanical migration, C3/C4 — v3 spelling must reach 0 occurrences)

| v3 | v4 | Baseline count (apps/web/src, 2026-09-29) |
|---|---|---|
| `outline-none` | `outline-hidden` | 143 |
| `shadow-sm` | `shadow-xs` | 82 |
| bare `shadow` | `shadow-sm` | 58 |
| `ring-offset-*` | unchanged name — audit stacking | 66 |
| bare `ring` | `ring-3` (+ explicit color where v3 look must be exact) | 27 |
| `bg-gradient-to-*` | `bg-linear-to-*` | 33 |
| `backdrop-blur-sm` | `backdrop-blur-xs` | 12 |
| bare `backdrop-blur` | `backdrop-blur-sm` | ~7 |
| `bg-opacity-*` | alpha suffix (`bg-white/75`) | 12 |
| `flex-shrink-*` | `shrink-*` | 16 |
| `flex-grow-*` | `grow-*` | 5 |
| `blur-sm` | `blur-xs` | 12 |
| bare `blur` | `blur-sm` | ~8 |
| `rounded-sm` | `rounded-xs` | 4 |
| `space-x-reverse` / `space-y-reverse` | unchanged name — verify v4 margin logic | 8 |

**Gate**: SC-002 greps (`outline-none`, `bg-gradient-to-`, `bg-opacity-`, `flex-shrink-`, `flex-grow-` = 0 hits) + the same method for every row above.

## 3. Engine-default contract (compat layer — permanent)

- Bare `border` / `border-s` / `border-e` / `divide-y` resolve to **gray-200** (not v4's currentColor) via the `@layer base` restoration block.
- Bare `ring` resolves to **3px / blue-500** (not v4's 1px / currentColor) via `--default-ring-width` / `--default-ring-color`.
- Call sites keep working unchanged; C4 may still pin explicit values at bare-ring sites for determinism (contract surface unchanged either way).

## 4. tailwind-merge contract

`cn()`/`twMerge` must keep resolving conflicts correctly under v4 grammar — verified empirically on tailwind-merge 3.6.0: `shadow-sm shadow-xs → shadow-xs`, `ring ring-3 → ring-3`, `outline-none outline-hidden → outline-hidden` (research D12). Any new v4-only utility introduced later must be re-probed.

## 5. Non-class CSS contract (out of Tailwind's scope, untouched)

- Runtime CSS custom properties (`--ax-*-rgb`, `--brand-*`, shadcn HSL set, `--ax-shadow-*`, `--ax-dur-*`, `--ax-ease-standard`, `--ax-space-sidebar*`, gradients, glass vars) — values and light/dark switching unchanged.
- Unlayered custom classes (~40) — verbatim, precedence over layered utilities preserved.
- `desktop-shell.css`, `html-clip.css`, KaTeX CSS — untouched.
