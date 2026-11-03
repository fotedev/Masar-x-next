# 06 — AI Chat Interaction Performance

> Subagent auditor #6, 2026-11-02. Domain: apps/web /ar/ai-assistant streaming, markdown pipeline, per-message costs. Coordinator spot-check: LatexRenderer per-input dynamic wrapper (SPLIT-8 ≡ CHAT-6) verified in source; ChatMessageItem Lottie gate corroborated by auditor #5.

## Findings

### [CHAT-1] Streamed flush re-renders every chat bubble — memo defeated by unstable `onUiMessage`/`onRetry` props

- P1 · Impact H — this is the main per-token re-render fan-out: every rAF flush re-renders all N `ChatMessageItem`s, each re-running `extractZaneUiBlocks` + the 5-pass markdown repair chain (see CHAT-7), feeding TBT 629ms / mainthread 3.40s.
- Evidence chain: `useAiChat.ts:426` — `sendMessage` useCallback deps include `messages`; `useAiChat.ts:317` — `flushStream` calls `setMessages` per rAF flush → new `sendMessage` identity per flush. `page.tsx:108-113` — `handleUiMessage` is `useCallback([sendMessage, selectedModel])`; `page.tsx:119-122` — `handleRetryLast` is `useCallback([messages, sendMessage, ...])` → both churn per flush. `ChatContainer.tsx:47` is `memo`, but `ChatContainer.tsx:404-414` passes `onUiMessage`/`onRetry` to every item, so `ChatMessageItem.tsx:170` (`memo(...)`) shallow-compares false for every message, not just the streaming one.
- Current: only the streaming message's object identity changes (`useAiChat.ts:317` uses `prev.map`, preserving others) — the memo design is right, the prop identities break it.
- Fix: make `handleUiMessage`/`handleRetryLast` identity-stable (store the latest `sendMessage`/`messages` in refs inside stable wrappers). Effort S.

### [CHAT-2] One dotLottie WASM player per assistant message (N concurrent animated canvases)

- P1 · Impact H — every non-user message mounts an autoplay-loop `LottiePlayer` (`ChatMessageItem.tsx:640-652`); hero + typing indicator add two more (`ChatContainer.tsx:270-283, 425-434`). With the 100-row retention cap (`chat-pagination.ts:9`) a full thread = up to ~50 WASM workers/canvases animating simultaneously — a large share of bootup 2.28s and mainthread 3.40s.
- Evidence: the state machine is only ever driven on the latest bubble — `ChatMessageItem.tsx:261` (`if (isUser || !isLatestAssistant) … return`), so older players are pure cost: they idle-loop with zero interaction.
- Current · Fix: render a static avatar (SVG/img) for non-latest assistant messages; mount Lottie only when `isLatestAssistant`. Effort M.

### [CHAT-3] rehype-highlight re-parses + re-highlights the whole growing message every flush → O(n²) streaming cost

- P1 · Impact M — `MarkdownRendererHeavy.tsx:24` (`rehypePlugins={[rehypeHighlight]}`) runs highlight.js over the full content on every content change; `ChatMessageItem.tsx:397-401,595` re-feeds the full `normalized` string each flush, and the rAF throttle (`delta-throttle.ts:14-40`) permits up to ~60 flushes/sec. Long code answers get progressively slower as the stream grows.
- Fix: while `message.streaming` is true, skip `rehypeHighlight` (plain fenced code already renders fine via the `pre` handler, `ChatMessageItem.tsx:529-556`) and/or relax the throttle to a 100–250ms trailing tick; re-highlight once at finalize. Effort S–M.

### [CHAT-4] LCP 9.06s: hero canvas paints only after hydration → rAF → dynamic chunk → 1.69MB wasm → .lottie fetch

- P1 · Impact H — for anon, `user` is `null` from first render (`AuthContext.tsx:49` `useState(initialUser)`), so the guest layout effect (`useAiChat.ts:102-125`) sets `isReady` synchronously at hydration — the Supabase fetch gate (`useAiChat.ts:130-182`) is NOT the measured cause. What remains: the LCP element is the hero (Lottie canvas or staggered text, `ChatContainer.tsx:241-308`), and `LottiePlayer.tsx:98-105` defers mount one rAF, then dynamic-imports dotlottie (`LottiePlayer.tsx:35-49`), which then fetches `/dotlottie-player.wasm` — 1,691,944 bytes (`apps/web/public/dotlottie-player.wasm`) plus `/animations/ai-robo.lottie` (69,824 bytes) before the first canvas frame. This chain starts only after 1390KB of JS finishes hydrating.
- Fix (cheapest): render the hero name/welcome text without framer-motion's `delayChildren: 0.15` + stagger gating its first paint (`ChatContainer.tsx:244-257`) so text becomes the LCP element, and add `<link rel="preload" as="fetch">` for the wasm on this route. Effort S–M.

### [CHAT-5] QuizPlayer + quizService statically bundled into the chat page

- P2 · Impact M — contributes to the page being the largest at 1390KB. `ChatInput.tsx:26-27` statically imports `QuickQuizFromTextModal` and `QuickQuizPlayerModal`; the latter pulls `QuizPlayer` + `quizService` (`QuickQuizPlayerModal.tsx:6-7`), all rendered only on demand.
- Fix: `next/dynamic` with `ssr:false`, same pattern already used for `PuterSettingsModal` (`page.tsx:28-33`). Effort S.

### [CHAT-6] `LatexRenderer` recreates its dynamic-import wrapper on every text change → katex subtree remounts per flush

- P2 · Impact M — `LatexRenderer.tsx:27-35`: `useMemo(() => dynamic(...), [className, input])` — `input` is a dep, so any math-bearing text run gets a NEW component type each stream flush → React unmounts/remounts (and re-parses katex). Contrast `LazyMarkdown.tsx:10-13`, which correctly hoists `dynamic` to module scope.
- Fix: module-scope `dynamic`, pass text as a prop (identical to LazyMarkdown). Effort S. (≡ SPLIT-8 — same fix, counted once in the enhancement plan.)

### [CHAT-7] Full-content regex work re-runs per flush on the streaming bubble

- P2 · Impact L — `ChatMessageItem.tsx:312-329` (`extractZaneUiBlocks` regex over full content), `ChatMessageItem.tsx:397-401` (`completeOpenFences` + `normalizeLatexDelimiters` + 3 repair passes), `ChatMessageItem.tsx:343-361` (`hasMarkdownContent`) all execute on the growing string every render. Multiplies CHAT-1/CHAT-3.
- Fix: skip zane-ui extraction and the repair chain while `streaming` (run once at finalize); they exist to fix final output. Effort S.

### [CHAT-8] No list virtualization — bounded, acceptable once CHAT-1 is fixed

- P2 · Impact L — `ChatContainer.tsx:404-414` renders all messages; cap 100 rows / 30-row pages (`chat-pagination.ts:8-9`) keeps DOM size sane. Acceptable for MVP once CHAT-1/2 land; if the cap ever lifts, virtualize. Effort M (only if needed).

## Healthy areas

- **Streaming throttle design**: `delta-throttle.ts:14-40` trailing-edge rAF throttle keeps setState to at most one per frame; scheduler injected and unit-testable.
- **LazyMarkdown chunk split**: module-scope `dynamic` (`LazyMarkdown.tsx:10-13`) avoids remounting the ReactMarkdown tree on content change (comment documents the fixed regression).
- **Persistence is event-driven**: `pendingPersistRef` (`useAiChat.ts:256-270`) means no localStorage write per flush — only finalize/clear persists; guest array capped at CHAT_HISTORY_CAP.
- **Fire-and-forget DB writes don't block chat**: `insertChatRow`/`pruneChatOverflow` (`useAiChat.ts:36-70`) swallow errors into the logger; prune probe window (rows 101–200) is a range query, not a full scan.
- **highlight.js is NOT the full bundle**: `rehype-highlight ^7.0.2` (`package.json:56`) defaults to lowlight's `common` set (~37 languages) with no `languages` override (`MarkdownRendererHeavy.tsx:24`); full-bundle concern unfounded. Katex also only loads on `$`-detect (`LatexRenderer.tsx:19-25`).
- **Puter transport caching**: SDK import, warmup, and `listModels` are cached promises (`puter-client.ts:34-37, 127-167, 258-282`), so only the first send pays setup; the 5s status poll reads only cached state (`useAiChat.ts:232-244`, `puter-client.ts:53-59` — "never triggers an import").
- **Fallback routes are lean**: `/api/ai/chat` is one hop (auth → rate-limit → `streamText`, `api/ai/chat/route.ts:53-112`); `/api/ai-chat` proxy does one SSE passthrough hop to the edge fn (`api/ai-chat/route.ts:108-132`) but is not on the primary Puter streaming path used here.
- **Typing isolation works as designed**: controlled input state lives in the page but memo'd `ChatContainer` + stable callbacks mean per-keystroke re-render is scoped to `ChatInput` (documented contract, `page.tsx:83-85`; `hasUserInput` only flips on empty↔non-empty, `page.tsx:282`).

## Notes

- Measured LCP chain for authed users adds the Supabase history fetch to the same tail (spinner until `isReady`, `page.tsx:239-245`) — fixing CHAT-4's hero paint helps both audiences.
- CHAT-1 + CHAT-7 are one coordinated change (stabilize two callbacks; gate repair/extraction on `!streaming`) and together should remove most of the per-token mainthread cost; CHAT-2 is the single biggest steady-state win.
- `flushStream`/`finalizeStream` correctly swap in the sanitized reply only at finalize (`useAiChat.ts:324-333`, `assistant.ts:455-457`) — no correctness risk in throttling harder.
- 15 source files read (page.tsx, useAiChat.ts, ChatContainer.tsx, ChatMessageItem.tsx, ChatInput.tsx [head], LazyMarkdown.tsx, MarkdownRendererHeavy.tsx, LottiePlayer.tsx, delta-throttle.ts, lib/ai/assistant.ts, puter-client.ts, LatexRenderer.tsx, both API routes) + greps of AuthContext/package.json/chat-pagination/pasted-attachments/QuickQuiz modals.
