# Spec 012 — Tasks

## A. Scrollbar drag immediacy
- [x] A1. Remove `scroll-smooth` from the messages scroller (ChatContainer.tsx:221)
- [x] A2. ChatScrollbar: `scrollBehavior="auto"` on pointerdown, restore `""` on pointerup/pointercancel
- [x] A3. Pill/track-click smooth, post-sync jump instant, prepend anchor instant — all explicit JS, verified unchanged

## B. Glued bold boundaries
- [x] B1. `repairBoldBoundaries` in zaneMarkdown.ts (paired-span only, letter/digit boundaries, fence-excluded)
- [x] B2. Composed into renderAssistantContent after repairSpacedBold
- [x] B3. Unit tests: owner's exact sentences + punctuation + fence immunity + multi-span + remark-chain proof

## C. Message layout
- [x] C1. Assistant unboxed (no bg/border/shadow/rounded/padding); user bubble unchanged
- [x] C2. Reserved `h-8` action row — opacity/pointer-events transition only; long-press path kept
- [x] C3. User avatar `w-8 h-8 sm:w-9 sm:h-9`, icon `w-4 h-4 sm:w-5 sm:h-5`; bot + typing-row avatars unchanged
- [x] C4. Raw-view/CodeBlock/zane-ui keep their own containers

## D. Header → composer chip
- [x] D1. ChatInput: identity chip (mode icon + label + ping dot + onlineReady) at start of controls row, hero state included
- [x] D2. ChatHeader: early-returns null without student toolset / quiz chip; identity block + icon imports removed

## E. Typing performance
- [x] E1. All page callbacks useCallback'd (incl. the two inline arrows); sendMessage/loadOlder verified stable (useCallback'd in useAiChat)
- [x] E2. memo(ChatContainer); keystroke re-renders only ChatInput

## F. Puter 402
- [x] F1. `isPuterInsufficientFundsError` in errors.ts
- [x] F2. assistant.ts: per-model gate (early return), logger.warn with reason, clear on success, canned return in both tails
- [x] F3. `canned.insufficientFunds` in en+ar aiAssistant.json (en staged via hunk-filtered patch — parallel session's rebranding hunks preserved unstaged)
- [x] F4. useAiChat hardcoded error string → cannedMessagesFor(locale).genericError

## G. Console honesty
- [x] G1. Console patch moved verbatim to lib/dotlottie-console-guard.ts (side-effect import in LottiePlayer)
- [x] G2. `puter.quiet = true` set best-effort at SDK init (puter.ts)

## V. Verification
- [x] V1. Per-commit: typecheck + lint (52 ratchet held) + web vitest (81 passed)
- [x] V2. e2e: full suite 7 passed / 1 skipped with `--workers=1`; the ar subject-detail flake at 2 workers is hotspot network contention on the data-dependent test (passes standalone and at 1 worker) — no regression
- [x] V3. Column-centering preserved (native scrollbar stays hidden; no layout-affecting change made)
- [x] V4. Ledger updated (this commit)
- [ ] V5. Owner smoke checklist (checklists/verification.md) — pending owner

## Status ledger
- 2026-09-21: spec approved via plan-mode exploration + owner "continue"; A1–G2 + V1–V4 executed across commits `27cacf0`…(ledger). Incident: first `7e130aa` attempt swept the parallel session's unstaged en/aiAssistant.json rebranding hunks because `git commit -- <paths>` commits WORKING-TREE state of the named paths, bypassing the index — repaired via `git reset --soft` → unstage → re-stage filtered hunk → index-only commit (`8037b5e`). Lesson recorded: for files shared with a parallel session, pathspec-guarded commits are NOT safe; filtered-patch staging + plain index commit is.

