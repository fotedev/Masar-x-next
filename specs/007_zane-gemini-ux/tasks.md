# Tasks: 007_zane-gemini-ux

> Gates for every task: pnpm typecheck · pnpm lint (ratchet 52 warnings) · web vitest 20/20 · no NEW hardcoded-Arabic hits · ar/en key parity. Hard boundary: apps/web + packages/shared messages only; ChatMessageItem.tsx and the owner's uncommitted en/aiAssistant.json Puter→AI rename are NEVER touched/staged (en json partial-staged via HEAD+ours blob).

## 1. Spec landing

- [x] 1.1 specs/007_zane-gemini-ux/spec.md + tasks.md committed before code (9a9f9c6)

## 2. Commit 1 — Full-bleed shell + window-edge scrollbar

- [x] 2.1 Layout.tsx: assistant-route `<main>` → `"relative flex min-h-0 w-full flex-1 flex-col overflow-hidden"`; assistant route bypasses PageTransition (plain `w-full h-full min-h-0` div, like admin/light) (28b8fc5)
- [x] 2.2 page.tsx: root → `flex h-full min-h-0 w-full flex-col` (deviation: `h-full` instead of `flex-1` — the PageTransition-bypass div is a plain block, so flex-1 had no height source; h-full resolves against its `h-full`); all `100dvh − …` calc classes and `max-w-5xl mx-auto` removed (28b8fc5)
- [x] 2.3 ChatContainer.tsx: scroll div `w-full min-h-0` + `dir="ltr"`; inner wrapper `dir={isRTL ? "rtl" : "ltr"}` + `flex min-h-full w-full max-w-4xl mx-auto flex-col` wrapping both state branches; `.chat-messages` retained (28b8fc5)
- [x] 2.4 Verified: scroll container right edge == window width (ar+en, 1920×1000 and 1280×800), hero/chat × mobile/desktop, zero document scroll, footer-lock intact → commit `fix(web): dock zane chat scrollbar to window edge (full-bleed shell)` (28b8fc5)

## 3. Commit 2 — (+) tools popover, bottom model selector, slim header

- [x] 3.1 i18n: `tools` (أدوات زين / ZANE tools) + `model` (النموذج / Model) added to ar+en (orchestrator-owned edit)
- [x] 3.2 ChatInput.tsx: (+) circular button (w-9 h-9 sm:w-10 sm:h-10) → upward popover (overlay + Escape dismissal): Quick Quiz / 3 modes with Check / Summarize (spinner+disabled states) / Clear chat
- [x] 3.3 ChatInput.tsx: model pill beside (+) (menu upward, models array moved here, `setSelectedModel` = page's handleModelChange)
- [x] 3.4 ChatHeader.tsx slim → ultra-minimal transparent bar (owner confirmation): status/title + student toolset (selects/Start/last-exam chip) + AI settings icon; mode/model pills and summarize/clear buttons removed (447 → 145 lines)
- [x] 3.5 page.tsx: props re-wired (ChatInput gains 8 props; ChatHeader drops 7)
- [x] 3.6 Commit `feat(web): zane tools popover, bottom model selector and slim header` (5de6491); en json partial-staged (HEAD + 2 lines only — owner's Puter→AI rename preserved uncommitted)

## 4. Verification & report

- [x] 4.1 Gates: typecheck ✓ (4 projects) · lint ✓ 0 errors / 52 warnings (ratchet unchanged) · tsc after every repair
- [x] 4.2 Browser-probe matrix: popover opens with all 6 items (ar+en, anchored to (+), within viewport) · active-mode Check · summarize disabled without messages · Escape + overlay + item-click dismissal · model switch persisted across reloads (gpt-4o → claude) · mode switch persisted (student/group/programming) · student toolset renders in slim header (student_agent) · scroll flush right edge ar+en · zero document scroll
- [x] 4.3 Execution notes: dispatch-2 agy run hit its quota cap mid-run (resets ~162h) leaving ChatHeader.tsx truncated — orchestrator reconstructed the prologue (interface/signature/modes) from git HEAD and verified the rest; agy stray scratch file `.openclaw-find-region.mjs` moved to `.trash/` (I9). Frozen framer-motion opacities observed during probing were rAF throttling of the hidden IAB pane (env artifact) — states verified correct via DOM + persistence once the pane was foregrounded.

## 5. Polish round (owner feedback after real-browser review, 2026-09-16)

Owner notes: inconsistent element placement · group the 3 personas in their own submenu · (+) menu does not close on far outside click (REAL bug) · composer frame too heavy/grey-blue — wants Gemini · textarea direction must be automatic. Analysis addendum: double mode selector (hero + popover) · header still hosts AI Mode button · model pill too cyan · muted send button unclear.

- [x] 5.1 ROOT CAUSE (outside-click): the `fixed inset-0` overlays were trapped by the card's `backdrop-blur` containing block, so they covered only the card — far clicks never reached them. Replaced with a document `pointerdown` listener + wrapper-ref containment checks (both menus, mutual exclusivity kept, Escape kept). Overlays deleted.
- [x] 5.2 Persona accordion in (+) menu: "نوع المساعد" row (Bot + active-mode badge + chevron) expanding the 3 modes with Check; AI Settings item moved into the menu (opens PuterSettingsModal). New i18n key `assistantPersona` (ar/en; en partial-staged).
- [x] 5.3 Gemini-style composer: `rounded-3xl` 1px neutral border, `bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl shadow-lg`, subtle neutral focus-within border; cyan aura + cyan focus glow deleted; textarea fully transparent.
- [x] 5.4 Auto direction: removed the `isRTL text-right/left` overrides that fought `dir="auto"`; textarea `dir={inputMessage ? "auto" : isRTL ? "rtl" : "ltr"}` — typed content self-directs, empty state follows locale (Arabic placeholder stays right-aligned). Verified: Arabic → rtl, English/code → ltr, empty-ar → rtl.
- [x] 5.5 Consistency: composer width unified `max-w-4xl` in both states; neutral model pill (no cyan badge); clearer disabled send (`bg-slate-200/80 dark:bg-slate-700/60`); hero mode dropdown deleted (ChatContainer −~90 lines, dead imports/state pruned); `aria-expanded` added to both menu buttons.
- [x] 5.6 Verified: outside far-pointerdown closes state (aria-expanded probe) · mutual exclusivity · accordion + settings item · dir matrix · hero without dropdown · composer 864px (4xl) in initial state · mobile 360px popover within viewport · gates green. Commit: `fix(web): zane composer polish (gemini style) — persona submenu, outside-click fix, neutral pill`.
