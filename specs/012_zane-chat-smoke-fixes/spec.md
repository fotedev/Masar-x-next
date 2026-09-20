# Spec 012 — Zane chat smoke-round fixes (owner's 8 items)

**Status:** APPROVED 2026-09-21 (owner drove plan-mode exploration, unanswered choice questions fell to recommended defaults)
**Input:** Owner smoke-test feedback on `/[locale]/ai-assistant` after specs/011, plus three pasted second-model analyses (validated per AGENTS.md I10 — several claims rejected, see §2).
**MVP-lock:** compliant — all items are owner-directed core-assistant functional/UX fixes.

## 1. Context & problem statement

After specs/011 (streaming, overlay scrollbar, lazy sync, bidi blocks) the owner smoke-tested the live page and reported 8 defects:

1. Top status header consumes vertical space; wants it smaller, inside the composer.
2. Arabic glue: in `عايزه **متعدد الصفحات**` the final ه renders stuck to the bold text.
3. User avatar (48/64px) too large.
4. Copy / View-Source buttons appear abruptly on hover — perceived flicker.
5. Overlay scrollbar thumb only moves after mouse release — not immediate.
6. Assistant replies still boxed in a card; owner wants clean-canvas text (View Source button must stay).
7. Typing in the composer feels heavy / page lags.
8. `Puter AI error {}` in console; generic "AI service encountered an error" bubbles — root cause: Puter 402 `insufficient_funds` ("No usage left for request.").

## 2. Validated root causes (code-verified; pasted-model claims adjudicated)

| # | Verified cause | Pasted-model claim verdict |
|---|---|---|
| 1 | `ChatHeader.tsx:52` — `py-1.5 shrink-0` bar, right container renders **empty** in cs_assistant mode; mounted whenever a conversation exists (page.tsx:195) | — |
| 2 | The pipeline passes `عايزه **…**` byte-identical (repairSpacedBold trims only INNER spaces); LatexRenderer's non-math branch is a bare `<span>` (no isolation), so a space present in the DOM renders correctly → the glue is **model output gluing the marker** (`عايزه**متعدد…`), the same gluing class `repairListGlue` already repairs elsewhere | "pipeline drops inter-node whitespace" REJECTED; "add CSS margins to strong" REJECTED; "insert space next to unpaired `**` via regex" REJECTED (would space openers → CommonMark emits literal `**`); "unicode-bidi:isolate on strong" REJECTED (isolation risks boundary-neutral misplacement — the exact bug class) |
| 3 | `ChatMessageItem.tsx:631` shared avatar wrapper `w-12 h-12 sm:w-16 sm:h-16` | — |
| 4 | Buttons are **already always-mounted** (opacity/max-h CSS, no conditional React mount); flicker = the `max-h-0→max-h-10` + `mt-0→mt-1` **height animation** | "conditional mount/unmount on hover" REJECTED (both models asserted it; false) |
| 5 | Scroller carries Tailwind `scroll-smooth` (`ChatContainer.tsx:221`); ChatScrollbar pointermove writes `el.scrollTop` directly (:94) — CSS `scroll-behavior: smooth` makes Chrome **animate programmatic scrolls**, so drags lag/commit late | "heavy unthrottled scroll listeners" not supported (update is cheap, passive) |
| 6 | `ChatMessageItem.tsx:655-660` shared bubble classes give assistant replies bg/border/rounded/padding/shadow | — |
| 7 | Input state lives at page level (page.tsx:123); ChatContainer is NOT memoized; `handleUiMessage` (page.tsx:96) is recreated every render, defeating ChatMessageItem.memo → **every keystroke re-renders all messages incl. full markdown re-parse**; first char also flips `hasUserInput` refiring the Lottie effect | "LottiePlayer animation cost" partial (real but secondary); "Puter websocket reconnect loop" not supported by code (socket noise is SDK-level, throttled by puter.ts diagnostics) |
| 8 | `insufficient_funds` matches NO classifier in errors.ts (neither transport/auth/model) → generic `canned.genericError` bubble (persisted as a normal reply), `logger.error` prints `{}` (Error non-enumerable props; plain-object code lost by normalizeError), no retry/gate — every send re-hits Puter | "fallback is broken" was TRUE for streaming shape (fixed in 011); "auto-fallback on 402 to server route" deferred — route needs unconfigured `AI_GATEWAY_API_KEY` (503s anyway) |

Also verified: auth-sync ~6× POST/load = StrictMode double-mount + forced SIGNED_IN events (10s cooldown exists, bypassed by force) — **no loop, no fix**. Machine network flakes (`fetch failed`) are environmental. The owner's PowerShell `rm -rf apps/web/.next` **failed** (PS has no `-rf`), so this smoke ran on a warm `.next`.

## 3. Design

### A. Scrollbar drag immediacy
- Remove `scroll-smooth` from the messages scroller — all smoothness is already explicit in JS (pill `behavior:"smooth"`, track-click smooth, stick/anchor instant).
- Belt-and-braces: `ChatScrollbar` sets `container.style.scrollBehavior = "auto"` on pointerdown, restores `""` on pointerup/pointercancel.

### B. Glued bold boundaries (Arabic)
- New pure `repairBoldBoundaries(text)` in `zaneMarkdown.ts`, fence-excluded, operating on **complete bold spans only**:
  - `(\S)(\*\*[^*\n]+?\*\*)` → `$1 $2` (space before an opener glued to a word)
  - `(\*\*[^*\n]+?\*\*)(\S)` → `$1 $2` (space after a closer glued to a word)
- Composed after `repairSpacedBold` in `renderAssistantContent`. Unpaired `**` is never touched.

### C. Message layout (unbox + reserved actions + avatar)
- Bubble classes split by role: assistant loses bg/border/shadow/rounded/padding (plain full-width text under the bot avatar); user bubble unchanged. Raw-view `<pre>`, CodeBlock, zane-ui blocks already self-contained.
- Action row: fixed reserved `h-8` row under every message; only `opacity` + `pointer-events` transition (group-hover/focus-within desktop, long-press touch unchanged). No height animation.
- User avatar → `w-8 h-8 sm:w-9 sm:h-9`, icon `w-4 h-4 sm:w-5 sm:h-5`. Assistant (Lottie) avatar and typing-row avatar unchanged.

### D. Header → composer identity chip
- ChatInput: compact chip as first child of the composer controls row — mode icon (gradient badge) + mode label (`truncate`, hidden below sm) + green ping dot + `onlineReady` (hidden below md). Reuses existing i18n keys; visible in hero state too.
- ChatHeader renders **only** when it has real content: `mode === "student_agent"` (toolset selects + Start) or `generatedQuiz?.data` (last-exam chip); identity block removed from it.

### E. Typing performance (keystroke re-render isolation)
- `useCallback` all page-level callbacks (handleModelChange, handleSuggestionClick, handleUiMessage, handleSendMessage, handleSummarizeChat, handleStartQuiz, the two inline arrows); verify `sendMessage`/`loadOlder` stability in useAiChat (wrap if needed).
- `memo(ChatContainer)`. Keystrokes then re-render only ChatInput (value prop) — messages stop re-parsing markdown per keystroke. ChatInput's public props are unchanged (QuickQuizFromTextModal untouched).

### F. Puter 402 / insufficient_funds
- `isPuterInsufficientFundsError` in errors.ts (matches `insufficient_funds` / `no usage left` / `payment required` via asErrorMessage).
- assistant.ts: module-scope `puterFundsDepletedModel` gate — on insufficient funds, remember the model, `logger.warn` with `reason: asErrorMessage(error)`, return new `canned.insufficientFunds`; same-model sends short-circuit without network until model switch or reload; any successful response clears the gate.
- New `canned.insufficientFunds` key in en + ar `aiAssistant.json` (bilingual actionable copy: switch model / top up Puter).
- Drive-by (I3): useAiChat's hardcoded Arabic catch string → `cannedMessagesFor().genericError`.

### G. Console honesty
- LottiePlayer's global console.error/warn patch moves verbatim to `lib/dotlottie-console-guard.ts` (side-effect import) so stack frames stop attributing unrelated logs to LottiePlayer.
- Optional (best-effort): suppress the Puter ASCII banner via the SDK's quiet flag if trivially supported by the installed @heyputer/puter.js.

## 4. Behavior preservation & regression strategy

- Scroll behaviors unchanged everywhere except drag latency: pill smooth, track-click smooth, post-sync jump instant, prepend anchor instant — all were already explicit JS; removing the CSS class only stops the browser animating direct `scrollTop` writes.
- Bold repair is additive and conservative (complete spans, fence-excluded, no double spaces); already-spaced text passes through unchanged (unit-tested with the owner's exact sentences).
- User bubble, student toolset, quiz chip, View Source, long-press actions, streaming path — untouched semantics.
- 402 gate is per-model and cleared on success; other error classes keep their existing paths.

## 5. Test specification

- `zaneMarkdown.test.ts`: `repairBoldBoundaries` — glued opener Arabic, glued closer, glued both (`أعمله**React**بدل`), already-spaced unchanged, `**Note:**something`, fence immunity, no double-spacing.
- Existing suites stay green: repairSpacedBold/repairListGlue/pagination/stream/throttle (74 tests baseline).
- Gates per commit: `pnpm typecheck && pnpm --filter web lint` (≤52 ratchet) `&& pnpm --filter web test`; `pnpm --filter web test:e2e` after the scrollbar commit and at the end.
- Owner smoke checklist (see checklists/verification.md): cold `.next` with the **PowerShell-correct** command, drag immediacy, glued-bold sentence, unboxed assistant, typing smoothness, 402 message-once-per-model.

## 6. Atomic execution plan

| # | Commit | Files |
|---|---|---|
| 1 | `docs(ai): add specs/012 chat smoke-round fixes` | specs/012/* |
| 2 | `fix(ai): make overlay scrollbar drag immediate` | ChatContainer.tsx, ChatScrollbar.tsx |
| 3 | `fix(ai): repair glued bold markers around Arabic text` | zaneMarkdown.ts + tests |
| 4 | `feat(ai): unbox assistant messages, reserve action space, shrink user avatar` | ChatMessageItem.tsx |
| 5 | `feat(ai): fold header identity into composer chip` | ChatHeader.tsx, ChatInput.tsx |
| 6 | `perf(ai): stabilize chat callbacks and memoize container` | page.tsx, useAiChat.ts (if needed) |
| 7 | `fix(ai): actionable insufficient-funds handling for Puter 402` | errors.ts, assistant.ts, useAiChat.ts, aiAssistant.json en+ar |
| 8 | `chore(ai): relocate dotlottie console guard` (+optional quiet) | LottiePlayer.tsx, new lib module, puter.ts |
| 9 | `docs(ai): record specs/012 execution ledger` | tasks.md |

All commits pathspec-guarded; the parallel session's dirty files (Footer*, LanguageToggle, Sidebar, FooterDeveloper, sw.js, next-env.d.ts, en/aiAssistant.json rebranding hunks) are never swept — en/aiAssistant.json is staged via hunk-filtered patch.

## 7. Out of scope

Server-fallback rerouting on 402 (needs `AI_GATEWAY_API_KEY`, unconfigured); right-click context menu for actions (not discoverable, breaks native menu — owner's reserved-space suggestion adopted instead); assistant avatar resize; auth-sync cooldown changes (no loop found); error-bubble persistence semantics; TanStack Virtual.
