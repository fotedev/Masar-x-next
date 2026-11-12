# Spec 046 — Scrollbar Polish (dark-theme white-line fixes)

> | | |
> |---|---|
> | Branch | `fix/046-scrollbar-polish` |
> | Created | 2026-11-12 |
> | Status | Approved (owner, 2026-11-12 — plan approval in session; owner report "what is this white line in the app" with browser + desktop screenshots) |
> | Type | CSS polish — no component behavior changes |
> | Baseline | `main` `53e8c5f` |

## Problem

A thin light vertical line appears on the right of the content in the
dark-themed app, from two unrelated renderers:

1. **Browser `/en/ai-assistant`** — the app-drawn `ChatScrollbar` overlay thumb
   (`components/ai/ChatScrollbar.tsx:139`, `dark:bg-slate-500/60`) reads as a
   white line on the navy background. Two utilities referenced by components
   are dead (no Tailwind scrollbar plugin installed):
   `scrollbar-none` (`ChatHeader.tsx:50`) and
   `scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800`
   (`ChatInput.tsx:272`) — any overflow there falls back to the global 8px
   webkit scrollbar (unstyled native bars can leak into dark mode).
2. **Desktop `/en/subjects`** — the blanket
   `[data-masarx-desktop="true"] * { scrollbar-gutter: stable }`
   (`styles/desktop-shell.css:116`) reserves gutters on every `overflow: hidden`
   container (body, Layout root, main), and Chromium mis-paints the reserved
   strip light when both axes are hidden (chromium issue 1459802) — a
   full-height faint strip below the fixed titlebar. Nothing on the page
   scrolls; the two real scroll panes already set `scrollbarGutter: stable`
   inline (`LectureListColumn.tsx:53`, `AssistantPanel.tsx:170`).

## Scope

**In:**

1. `desktop-shell.css`: remove only `scrollbar-gutter: stable` from the blanket
   `*` rule (keep `scrollbar-width`/`scrollbar-color`). Gutters become opt-in
   per real scroll pane — FR-018's "MUST NOT cause layout to shift" is
   preserved by the two inline panes; non-scrolling containers never shift.
2. `ChatScrollbar.tsx`: dim the dark thumb `dark:bg-slate-500/60` →
   `dark:bg-slate-600/50` (hover cyan unchanged; light mode unchanged).
3. `index.css`: add a real `.scrollbar-none` utility beside
   `.chat-scrollbar-hidden` (`scrollbar-width: none` + webkit `display: none`).
4. `ChatInput.tsx`: replace the dead textarea classes with `scrollbar-none`
   (textarea still scrolls; the unstyled light bar is gone).
5. `index.css`: `:root { color-scheme: light } .dark { color-scheme: dark }`
   fallback (currently only the pre-paint inline script sets it —
   `ThemeScript.tsx:63`).
6. AGENTS.md spec-table row.

**Out:** any change to FR-018's thumb palette in desktop mode (its light thumb
was not the reported strip); redesigning the ChatScrollbar feature (spec 011).

## Follow-up (2026-11-12, post-reinstall) — the strip persisted

Reinstalling this spec's fixes did not clear the owner's line on
`/en/subjects`. Pixel forensics (column-brightness read of the owner's
screenshot + shipped-CSS audit) identified a **second, independent renderer**:

- The line is the `.modern-card`'s own 1px glass border painted on the
  window's **last pixel column** (x=1279, y≈148..575 = the card box, straight
  segment inside the 24px rounded corners; computed rgb(21,27,41) —
  `--glass-border: rgba(241,245,249,0.08)` over the card background).
- Desktop `main` has no horizontal padding (`Layout.tsx` desktop variant:
  `relative flex min-h-0 w-full flex-1 flex-col overflow-hidden`), so
  edge-to-edge cards put their border flush on the window edge. Browser mode
  never shows this (`px-3 sm:px-6 lg:px-8` insets the card to ≈x=1248).
- The shipped bundle was verified to contain **zero** `scrollbar-gutter` rules
  — the first fix above was real but addressed a different artifact.

**Fix:** the desktop `main` variant gains `pe-4` (16px inline-end inset), so
card borders sit 16px inside the window edge on every desktop page (subjects
list, home, …). RTL-aware via the logical property; the rail's start offset
lives on the root div (spec 045) and the ZANE/workspace flex chains keep
their full-height geometry (verified visually on the real app, including
`/subjects/[subject]`).

## Follow-up 3 (2026-11-12) — the top line: titlebar border painted v3 gray-200

Owner clarified the target: the bright ~1px **horizontal** line at y≈32,
full window width — the bottom edge of the custom titlebar. Shipped-CSS
audit (agent-verified against the installed bundle) found a third,
independent renderer in the same bug family:

- `CustomTitlebar.tsx:105` uses `border-b border-border`. Tailwind v4
  generates **no CSS** for `border-border` when no `--color-border` token
  exists in `@theme` — and this project has none: the shadcn HSL triplets
  (`--border: 214.3 31.8% 91.4%` light `index.css:182`, `217.2 32.6%
  17.5%` dark `index.css:240`) were never wired into the `@theme` block.
- The dead utility's 1px border therefore paints with the base-layer
  fallback `border-color: #e5e7eb` (`index.css:12-19`, spec-026 v3
  defaults restoration) — near-white on the dark navy shell. The same
  dead class renders bright lines at 11 more desktop-chrome sites:
  `AssistantPanel.tsx:126,129,199,206`, `StudyWorkspace.tsx:160,203`,
  `LectureListColumn.tsx:56,75`, `ReaderToolbar.tsx:49`,
  `UpdateToast.tsx:72,92` (12 total).
- Diagnosed-against claims that did NOT apply (recorded for the ledger):
  "Tailwind v4 bare borders default to currentColor" is false here (the
  pinned `#e5e7eb` base rule wins); the `.modern-card` container border
  (`rgba(241,245,249,0.08)`) and the rail divider
  (`dark:border-slate-800/80`) are intentional subtle design.

**Fix:** wire the missing token in `@theme` (matching the existing
`--color-primary-foreground: hsl(var(--primary-foreground))` pattern) —

```css
--color-border: hsl(var(--border));
```

One line heals all 12 sites: dark → `hsl(217.2 32.6% 17.5%)` ≈ slate-800,
light → `hsl(214.3 31.8% 91.4%)`; theme-switchable at runtime via the
existing `--border` triplets. No call-site edits.

**Scope guard (deferred):** the rest of the shadcn semantic-token layer is
still dead — `bg-background`, `bg-muted`, `bg-accent`, `text-foreground`,
`text-muted-foreground`, `ring-ring`, `bg-card` (~98 sites incl. the
`components/ui/` primitives; transparent/inherit/hover-noop consequences).
Wiring those changes rendering on many surfaces → its own follow-up spec,
owner decision. This hotfix wires `--color-border` only.

**Regression guard:** desktop-sim e2e asserts the titlebar's computed
`borderBottomColor` is not the gray-200 fallback and is dark in dark mode.

## Verification

1. Worktree gates green (typecheck, lint, web vitest).
2. e2e 33 passed / 2 skipped on a clean :3000.
3. Rebuilt installer installed; Playwright desktop-sim on the packaged server:
   `/en/subjects` right edge matches the page background (no strip);
   `/en/ai-assistant` thumb dimmed. computer-use on the real window confirms
   both pages visually with the sidenav rail intact.
