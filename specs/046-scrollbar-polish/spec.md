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

## Verification

1. Worktree gates green (typecheck, lint, web vitest).
2. e2e 33 passed / 2 skipped on a clean :3000.
3. Rebuilt installer installed; Playwright desktop-sim on the packaged server:
   `/en/subjects` right edge matches the page background (no strip);
   `/en/ai-assistant` thumb dimmed. computer-use on the real window confirms
   both pages visually with the sidenav rail intact.
