# Research: 026 — Tailwind CSS v4 (Oxide) Upgrade

**Date**: 2026-09-29 · **Spec**: [spec.md](./spec.md) · All decisions verified against live Tailwind v4.3 docs (fetched 2026-09-29) and the real repo state.

---

## D1 — v4 entry path for `src/index.css`

**Decision**: replace the three `@tailwind` directives with:

```css
@import "tailwindcss";
@source "../src/**/*.{js,ts,jsx,tsx}";
@config "../../tailwind.config.js";   /* Story 1 bridge only — removed in C2 */
```

**Rationale**: `@config` is the official v3-compat directive (path relative to the CSS file). Explicit `@source` mirrors the v3 `content` globs deterministically. The v3 glob `./index.html` was **dead** — `apps/web/index.html` does not exist (verified on disk) — so only `src/**` is sourced.

**Alternatives considered**: pure auto-detection (v4 default, scans cwd excluding gitignored/node_modules) — viable but less deterministic; rejected as primary, kept as documented fallback.

---

## D2 — Engine-default compat layer is PERMANENT (refines the spec's "temporary" wording)

**Decision**: Story 1 adds a **permanent, documented "v3 defaults restoration" block** using the exact recipes from the official v4 upgrade guide:

```css
/* v3 defaults restoration (see research.md D2) */
@layer base {
  *, ::after, ::before, ::backdrop, ::file-selector-button {
    border-color: var(--color-gray-200, currentColor);
  }
}
@theme {
  --default-ring-width: 3px;
  --default-ring-color: var(--color-blue-500);
}
```

**Rationale**: this resolves the spec's largest risk (bare `border` ×~350 sites: gray-200 → currentColor) and bare `ring` (27 sites: 3px/blue-500 → 1px/currentColor) **without touching a single call site**. The upgrade guide documents these blocks verbatim as the compatibility path.

**Spec deviation note**: the spec described the compat layer as "temporary, removed by Story 3". Plan-phase research showed removal would BE the breaking moment (removing the base-layer bridge flips ~350 borders to currentColor). The outcome (zero visual regression) is unchanged; the mechanism is refined: the layer is permanent. Story 3 still pins explicit `ring-N` (+ color where v3 semantics matter) at the 27 bare-ring sites for determinism, and audits `ring-offset-*` (66) against the new shadow stacking.

**Alternatives considered**: per-site explicit color pinning of ~350 border sites — massive churn, high regression risk; rejected. `@utility ring` override — unnecessary once `--default-ring-*` exists.

---

## D3 — z-index tokens → static `@utility` (NO `--z-index-*` namespace exists)

**Decision**:

```css
@utility z-header  { z-index: 40; }
@utility z-sidebar { z-index: 45; }
@utility z-modal   { z-index: 50; }
@utility z-popover { z-index: 55; }
@utility z-toast   { z-index: 60; }
@utility z-tooltip { z-index: 70; }
```

**Rationale**: the live v4.3 theme-namespaces table has **no z-index namespace**, so `@theme` cannot produce `z-header`. Static `@utility` names keep all 4 call sites (`z-header/sidebar/modal/popover/...`) unchanged.

**Alternatives considered**: rename call sites to `z-[40]` / `z-(--ax-z-header)` — churn for zero benefit; rejected.

---

## D4 — transitionDuration → static `@utility`; ease → `@theme` (namespace exists there)

**Decision**:

```css
@utility duration-ax-fast { transition-duration: var(--ax-dur-fast); }
@utility duration-ax-base { transition-duration: var(--ax-dur-base); }
@utility duration-ax-slow { transition-duration: var(--ax-dur-slow); }
@theme { --ease-ax-standard: var(--ax-ease-standard); }
```

**Rationale**: no duration namespace exists in v4.3; `--ease-*` does exist, so `ease-ax-standard` (6 call sites) is a proper theme variable. `duration-ax-*` (1 call site) becomes static utilities. `ax-dur-*`/`ax-ease-standard` runtime vars stay untouched.

**Alternatives considered**: convert call sites to `duration-(--ax-dur-fast)` (idiomatic v4 but changes call sites); rejected for zero-churn.

---

## D5 — Colors: `<alpha-value>` triplets → plain `@theme` color vars

**Decision** (exact v3 config values verified in `apps/web/tailwind.config.js` + `src/index.css`):

```css
@theme {
  /* ax palette — every --ax-*-rgb is an "R G B" triplet defined in :root/.dark */
  --color-ax-canvas: rgb(var(--ax-canvas-rgb));
  --color-ax-surface: rgb(var(--ax-surface-rgb));
  --color-ax-surface-hover: rgb(var(--ax-surface-hover-rgb));
  --color-ax-surface-inset: rgb(var(--ax-surface-inset-rgb));
  --color-ax-primary: rgb(var(--ax-text-primary-rgb));
  --color-ax-secondary: rgb(var(--ax-text-secondary-rgb));
  --color-ax-muted: rgb(var(--ax-text-muted-rgb));
  --color-ax-edge: rgb(var(--ax-border-default-rgb));
  --color-ax-edge-strong: rgb(var(--ax-border-strong-rgb));
  --color-ax-accent: rgb(var(--ax-accent-rgb));
  --color-ax-accent-hover: rgb(var(--ax-accent-hover-rgb));
  --color-ax-accent-soft: rgb(var(--ax-accent-soft-rgb));
  --color-ax-accent-soft-hover: rgb(var(--ax-accent-soft-hover-rgb));
  --color-ax-on-accent: rgb(var(--ax-on-accent-rgb));
  --color-ax-success: rgb(var(--ax-success-rgb));
  --color-ax-success-soft: rgb(var(--ax-success-soft-rgb));
  --color-ax-warning: rgb(var(--ax-warning-rgb));
  --color-ax-warning-soft: rgb(var(--ax-warning-soft-rgb));
  --color-ax-danger: rgb(var(--ax-danger-rgb));
  --color-ax-danger-soft: rgb(var(--ax-danger-soft-rgb));
  --color-ax-info: rgb(var(--ax-info-rgb));
  --color-ax-info-soft: rgb(var(--ax-info-soft-rgb));
  --color-ax-tooltip-bg: rgb(var(--ax-tooltip-bg-rgb));
  --color-ax-tooltip-fg: rgb(var(--ax-tooltip-fg-rgb));
  /* brand */
  --color-brand-navy: rgb(var(--brand-navy));
  --color-brand-blue: rgb(var(--brand-blue));
  --color-brand-sky: rgb(var(--brand-sky));
  --color-brand-orange: rgb(var(--brand-orange));
  --color-brand-purple: #8b5cf6;
  /* shadcn remnant */
  --color-primary-foreground: hsl(var(--primary-foreground));
}
```

**Rationale**: v4 drops the `<alpha-value>` substitution mechanism; alpha modifiers (`bg-ax-accent/50`) now resolve via `color-mix()`, which works on any resolved color value including `rgb(var(--triplet))`. The v3 mapping `rgb(var(--x-rgb) / <alpha-value>)` becomes `rgb(var(--x-rgb))`. Nested keys (`ax.surface.hover` → `bg-ax-surface-hover`, `ax.accent.soft` → `bg-ax-accent-soft`, `ax.edge-strong`, `ax.on-accent`, `ax.tooltip-bg`) flatten to dashed names, producing identical utility names.

**Alternatives considered**: hardcoding hex values (would break the `html.dark` runtime switch — forbidden by the spec's Key Entities); rejected.

---

## D6 — fontSize scale (972 `text-*`/`leading-*` usages rely on exact values)

**Decision**: `--text-xs: 0.75rem; --text-xs--line-height: 1rem;` … `--text-4xl: 2.25rem; --text-4xl--line-height: 2.5rem; --text-5xl: 3rem; --text-5xl--line-height: 1;` (all 9 pairs from the config, exact values preserved; `--text-sm/base/lg/xl/2xl/3xl` likewise).

**Rationale**: v4's `--text-*` + `--text-*--line-height` pair reproduces v3's `['size', { lineHeight }]` exactly. Note: this **overrides** v4 defaults for the shared names — intentional, matching v3 behavior.

---

## D7 — spacing

**Decision**: `@theme { --spacing-18: 4.5rem; --spacing-88: 22rem; --spacing-128: 32rem; --spacing-ax-sidebar: var(--ax-space-sidebar); --spacing-ax-sidebar-collapsed: var(--ax-space-sidebar-collapsed); }`

**Rationale**: `--spacing-*` namespace confirmed; v4's dynamic spacing scale (any multiple of `--spacing`) coexists with named values. Runtime vars unchanged.

---

## D8 — shadows

**Decision**: `--shadow-ax-sm: var(--ax-shadow-sm); --shadow-ax-md: var(--ax-shadow-md); --shadow-ax-lg: var(--ax-shadow-lg);` (11 call sites, names unchanged).

---

## D9 — animations & keyframes

**Decision**: `--animate-wiggle: wiggle 1s ease-in-out infinite; --animate-ping-slow: ping 3s cubic-bezier(0, 0, 0.2, 1) infinite;` with `@keyframes wiggle` defined **inside** `@theme` (verified pattern). The `ping` keyframes come from v4's default theme; implementation verifies `animate-ping-slow` output includes them (fallback: define `@keyframes ping` in `@theme` too).

---

## D10 — dark + hover-device variants

**Decision** (syntax verified against live docs):

```css
@custom-variant dark (&:where(.dark, .dark *));
@custom-variant hover-device (@media (any-hover: hover));
```

**Rationale**: exact official patterns for class-based dark mode and media-query variants. ThemeScript.tsx (I7) and the round-14 tablet behavior are preserved with zero call-site changes.

---

## D11 — Migration mechanics: manual directed sweep (NOT the official codemod)

**Decision**: perform the rename sweep with targeted, grep-driven mechanical edits restricted to `apps/web/src`, each verified by diff review (I10) and the SC-002 grep gates.

**Rationale**: the official `@tailwindcss/upgrade` codemod refuses to run on a dirty tree, and the tree carries uncommitted work from another session (mobile files, `.gitignore`, `.freebuff/`) that I14/I8 forbid stashing or touching. The rename surface is fully enumerated (spec Story 3 table), so a directed sweep is verifiable.

**Alternatives considered**: run the codemod after coordinating with the owner to park the dirt — recorded as the fallback if the tree is clean at implementation time.

---

## D12 — tailwind-merge 3.6.0: v4-compatible (verified empirically)

**Decision**: keep `tailwind-merge` as-is. **Evidence**: runtime probe on the installed package (2026-09-29): `twMerge('shadow-sm shadow-xs') → 'shadow-xs'`, `twMerge('ring ring-3') → 'ring-3'`, `twMerge('outline-none outline-hidden') → 'outline-hidden'` — it already targets v4 grammar.

---

## D13 — Browser support floor changes

**Decision**: record the floor and proceed (the upgrade is owner-approved). v4 requires Safari 16.4+ / Chrome 111+ / Firefox 128+ (relies on `@property`, `color-mix()`). Desktop Electron 44 (Chromium ≥ 130) is unaffected; the web app's PWA/mobile-web audience on older Safari is the only exposure — noted for the PR description.

---

## D14 — Node version

**Decision**: no action. v4 tooling requires Node 20+; Next 16 already enforces ≥ 20.9.

---

## D15 — Content detection covers constants files

**Decision**: rely on auto-detection + the explicit `@source` from D1. `src/constants/notifications.ts` and `src/constants/assistantUIStyles.ts` (gradient classes) are plain `.ts` files inside the sourced glob — covered identically to v3. Verified mechanism, verified at C3 by grep + build.
