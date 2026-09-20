# Spec 012 — Tasks

## A. Scrollbar drag immediacy
- [ ] A1. Remove `scroll-smooth` from the messages scroller (ChatContainer.tsx:221)
- [ ] A2. ChatScrollbar: `scrollBehavior="auto"` on pointerdown, restore `""` on pointerup/pointercancel
- [ ] A3. Confirm pill (smooth), track-click (smooth), post-sync jump (instant), prepend anchor (instant) all still correct

## B. Glued bold boundaries
- [ ] B1. `repairBoldBoundaries` in zaneMarkdown.ts (paired-span only, fence-excluded)
- [ ] B2. Compose into renderAssistantContent after repairSpacedBold
- [ ] B3. Unit tests: owner's exact sentences + already-spaced + fence immunity

## C. Message layout
- [ ] C1. Split bubble classes by role — assistant unboxed (no bg/border/shadow/rounded/padding)
- [ ] C2. Reserved `h-8` action row — opacity/pointer-events transition only; long-press path kept
- [ ] C3. User avatar `w-8 h-8 sm:w-9 sm:h-9`, icon `w-4 h-4 sm:w-5 sm:h-5`
- [ ] C4. Verify raw-view/CodeBlock/zane-ui self-contained boxes still look right unboxed

## D. Header → composer chip
- [ ] D1. ChatInput: identity chip (mode icon + label + ping dot + onlineReady) at start of controls row
- [ ] D2. ChatHeader: render only for student toolset / quiz chip; strip identity block + dead imports

## E. Typing performance
- [ ] E1. useCallback all page callbacks; verify sendMessage/loadOlder stability in useAiChat
- [ ] E2. memo(ChatContainer); confirm keystroke re-renders only ChatInput

## F. Puter 402
- [ ] F1. `isPuterInsufficientFundsError` in errors.ts
- [ ] F2. assistant.ts: per-model gate + logger.warn with reason + return canned.insufficientFunds; clear on success
- [ ] F3. `canned.insufficientFunds` in en+ar aiAssistant.json (hunk-filtered staging for en)
- [ ] F4. useAiChat hardcoded error string → cannedMessagesFor().genericError

## G. Console honesty
- [ ] G1. Move LottiePlayer console patch verbatim to lib/dotlottie-console-guard.ts
- [ ] G2. Optional: puter quiet banner if trivially supported

## V. Verification
- [ ] V1. Per-commit: typecheck + lint (≤52) + web vitest
- [ ] V2. e2e after commit 2 and at the end
- [ ] V3. Column-centering numeric gate (0px) after layout commits
- [ ] V4. Ledger updated (commit 9)
- [ ] V5. Owner smoke checklist (checklists/verification.md) — pending owner

## Status ledger
- 2026-09-21: spec approved via plan-mode exploration + owner "continue"; A1–G2, V1–V4 executed (see git log); V5 owner-side.
