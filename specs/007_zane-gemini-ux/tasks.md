# Tasks: 007_zane-gemini-ux

> Gates for every task: pnpm typecheck · pnpm lint (ratchet 52 warnings) · web vitest 20/20 · no NEW hardcoded-Arabic hits · ar/en key parity. Hard boundary: apps/web + packages/shared messages only; ChatMessageItem.tsx and the owner's uncommitted en/aiAssistant.json Puter→AI rename are NEVER touched/staged (en json partial-staged via HEAD+ours blob).

## 1. Spec landing

- [x] 1.1 specs/007_zane-gemini-ux/spec.md + tasks.md committed before code (docs(specs): add 007 zane gemini-style chat ux spec)

## 2. Commit 1 — Full-bleed shell + window-edge scrollbar

- [ ] 2.1 Layout.tsx: assistant-route `<main>` → `"relative flex min-h-0 w-full flex-1 flex-col overflow-hidden"`; assistant route bypasses PageTransition (plain `w-full h-full min-h-0` div, like admin/light)
- [ ] 2.2 page.tsx: root → `flex flex-col w-full flex-1 min-h-0`; remove all `100dvh − …` calc classes and `max-w-5xl mx-auto`; no horizontal padding at page level (would inset the scrollbar)
- [ ] 2.3 ChatContainer.tsx: scroll div gets `w-full min-h-0` + `dir="ltr"` (scrollbar pinned right in RTL); keep `.chat-messages`, both state variants, ref, padding; new inner wrapper `dir={isRTL ? "rtl" : "ltr"}` + `flex min-h-full w-full max-w-4xl mx-auto flex-col` around existing children (hero `my-auto` centering preserved)
- [ ] 2.4 Verify: scroll container right edge == window width (ar+en, 1280/1920), hero/chat × mobile/desktop, zero document scroll, footer-lock intact on other routes → commit `fix(web): dock zane chat scrollbar to window edge (full-bleed shell)`

## 3. Commit 2 — (+) tools popover, bottom model selector, slim header

- [ ] 3.1 i18n: add `tools` (أدوات زين / ZANE tools) + `model` (النموذج / Model) to ar+en aiAssistant.json (orchestrator-owned edit; en partial-staged at commit)
- [ ] 3.2 ChatInput.tsx: (+) circular button (≥ w-9 h-9 sm:w-10 sm:h-10) → upward popover (`bottom-full start-0`, overlay + Escape dismiss): Quick Quiz / divider + 3 modes with Check / divider + Summarize (spinner+disabled states) / Clear chat
- [ ] 3.3 ChatInput.tsx: model pill beside (+) in bottom toolbar (markup moved from ChatHeader 222-275, menu opens upward, `setSelectedModel` = page's handleModelChange); models array moves here
- [ ] 3.4 ChatHeader.tsx slim: keep status/title + student toolset (selects/Start/last-exam chip) + AI settings icon; remove mode pill+menu, model pill+menu, summarize/clear buttons + their state/props/imports (lint-clean)
- [ ] 3.5 page.tsx: re-wire props (ChatInput gains mode/setMode/onSummarizeChat/onClearChat/isSummarizing/hasChatData/selectedModel/setSelectedModel; ChatHeader drops moved props)
- [ ] 3.6 Verify matrix: popover RTL/LTR + 360px, actions fire (quiz modal, setMode, summarize, clear), model persists + claude diagnostics, student flow intact, dark/light, hero+chat → commit `feat(web): zane tools popover, bottom model selector and slim header` (en json partial-staged: HEAD + our 2 lines only)

## 4. Verification & report

- [ ] 4.1 Full gates + browser-probe matrix; record results; update this checklist with commit hashes
