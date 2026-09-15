# Feature Specification: ZANE Chat — Gemini/Perplexity UX Alignment

**Feature Branch**: main (atomic commits)
**Created**: 2026-09-15
**Status**: approved (owner-approved inline plan, this file records it)
**Input**: owner directive — "الشكل وحش، عاوزه مثل gemini و perplexity": (+) tools button, bottom model selector, window-edge scrollbar.

## Context & Problem Statement

The ZANE AI chat page (`apps/web/src/app/[locale]/ai-assistant/`) deviates from modern chat-app UX in three structural ways:

1. **Scrollbar floats mid-screen.** The scroll container (`ChatContainer.tsx:198-206`) sits inside the page's `max-w-5xl mx-auto` column (`page.tsx:198-203`), which itself sits inside the generic `<main class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">` (`Layout.tsx:104`). On wide screens the scrollbar renders at the 5xl column edge (~1024px), not the window edge. The page also compensates height with fragile `100dvh − 6.5/7.5/8.5rem` calc chains duplicating main's paddings.
2. **Tools live in the top header.** Quiz (Brain button), assistant mode, summarize, and clear chat are split between `ChatHeader.tsx` and the Brain button in `ChatInput.tsx` — chrome-heavy, unlike Gemini/Perplexity which consolidate tools in a (+) popover at the composer.
3. **Model selector is in the header.** Gemini/Perplexity place the model pill in the bottom composer toolbar next to the (+) button.
4. **Dead classes**: `scrollbar-thin scrollbar-thumb-*` in ChatContainer/ChatInput are inert (no tailwind-scrollbar plugin; `tailwind.config.js` `plugins: []`). Real chat scrollbar styling is `.chat-messages` CSS (`index.css:525-547`).

Prior work this builds on: `bd2361c` (two-tier composer capsule), `129227f` (footer hidden + viewport locked on assistant route via the `isAssistantRoute` Layout branch).

## Architecture & Design

### Commit 1 — full-bleed shell + window-edge scrollbar (`Layout.tsx`, `page.tsx`, `ChatContainer.tsx`)

- `Layout.tsx`: assistant-route `<main>` gets the desktop-shell treatment `"relative flex min-h-0 w-full flex-1 flex-col overflow-hidden"` (no max-w, no padding); assistant route joins `isLightRoute || isAdminRoute` in bypassing `PageTransition`.
- `page.tsx`: root becomes `flex flex-col w-full flex-1 min-h-0` — all `100dvh` calc classes and `max-w-5xl mx-auto` removed (height now flows from the flex chain).
- `ChatContainer.tsx`: the scroll div keeps `.chat-messages` + both state variants, gets `w-full min-h-0` and **`dir="ltr"`** (forces the scrollbar to the right edge in Arabic RTL, matching the owner's requirement; browsers otherwise flip RTL overflow containers to the left). A new inner wrapper `dir={isRTL ? "rtl" : "ltr"} className="flex min-h-full w-full max-w-4xl mx-auto flex-col"` restores direction and centers message content on a unified `max-w-4xl` axis (matches the composer's existing chat-state width — owner decision).

### Commit 2 — (+) tools popover + bottom model pill + slim header (`ChatInput.tsx`, `ChatHeader.tsx`, `page.tsx`, i18n)

- `ChatInput.tsx`: Brain button → circular **(+)** button (hitbox ≥ `w-9 h-9 sm:w-10 sm:h-10`) opening an upward popover (`bottom-full start-0`, same visual language as the header menus: `bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border z-40`; dismiss via `fixed inset-0 z-30` overlay + Escape). Items: Quick Quiz (existing modal), divider + the three assistant modes with Check on active (Bot/Brain/MessagesSquare), divider + Summarize (spinner while `isSummarizing`, disabled without messages), Clear chat. A **model pill** (moved markup from ChatHeader 222-275, menu opening upward) joins the (+) on the start side of the bottom toolbar; Send stays on the end side.
- `ChatHeader.tsx` slims to: status/title + **student toolset preserved verbatim** (subject/exam selects, Start, last-exam chip — owner decision) + AI settings icon. Removed: mode pill + menu, model pill + menu, summarize/clear buttons, their state and now-unused imports/props.
- `page.tsx`: re-wires props (ChatInput gains `mode/setMode/onSummarizeChat/onClearChat/isSummarizing/hasChatData/selectedModel/setSelectedModel`; ChatHeader drops the moved ones).
- i18n: two new keys `tools` / `model` (ar + en). `en/aiAssistant.json` holds the owner's uncommitted Puter→AI rename — committed via **non-destructive partial staging** (staged blob = HEAD + our two lines only, `git update-index`), never touching the owner's pending hunks.

## Behavior Preservation & Regression Strategy

- Zero functional loss: every action reachable before stays reachable (quiz modal, 3 modes + `setMode`, summarize incl. per-mode handler on the page, clear, model switch incl. `localStorage` persistence + claude `initPuterDiagnostics` side effect via the page's `handleModelChange`).
- Scroll-to-bottom logic (`page.tsx:111-127`, `messagesContainerRef`) targets the same scroll element — only its width/direction change; scroll math is direction-agnostic.
- Hero state unchanged visually (own centered `max-w-2xl` content, hidden scrollbar variant); header already hidden in initial state, so no mode-pill duplication in one view.
- Footer-lock fix (`129227f`) untouched — wrapper `h-dvh overflow-hidden` still bounds the page; only inner geometry changes.
- Proof: gates (`pnpm typecheck`, `pnpm lint` ratchet 52, web vitest 20/20) + scripted DOM measurements (scroll container bounding box right edge == window width in ar and en; scrollHeight/scrollTop behavior) + manual matrix hero/chat × mobile/desktop × ar/en × dark/light.

## Test Specification

No component test infra exists for these files (verified: `src/lib/__tests__/` only). Verification is gate + browser-probe based:

1. Scroll container `getBoundingClientRect().right` equals `window.innerWidth` on `/ar/ai-assistant` and `/en/ai-assistant` (desktop 1280/1920) — scrollbar flush to window edge in both directions.
2. Message column axis: messages, header content, and composer share `max-w-4xl` centering.
3. (+) popover: opens/closes (tap, overlay click, Escape), each item fires its action; popover anchored correctly in RTL and LTR; no viewport overflow on 360px width.
4. Model pill: switch model → persisted to `localStorage["zane_ai_selected_model"]`; selecting a claude model triggers diagnostics init (sessionStorage flag).
5. Student flow: with mode `student_agent`, header still shows subject/exam selects + Start; last-exam chip renders.
6. Regression: `/ar`, `/ar/news` still render the global footer; document still zero-scroll on assistant route.

## Atomic Execution Plan

1. `docs(specs): add 007 zane gemini-style chat ux spec` — this directory.
2. `fix(web): dock zane chat scrollbar to window edge (full-bleed shell)` — Layout.tsx + page.tsx + ChatContainer.tsx. Gates + browser probe.
3. `feat(web): zane tools popover, bottom model selector and slim header` — ChatInput.tsx + ChatHeader.tsx + page.tsx + ar/en aiAssistant.json (partial-staged en). Gates + full matrix probe.
