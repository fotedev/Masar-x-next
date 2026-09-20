# Spec 011 — Zane Chat: Streaming, Right-Edge Scrollbar, Auto-Scroll & Lazy Sync

> **Status: APPROVED 2026-09-20 (owner approved the full plan in-session, I11).**
> Prepared 2026-09-20 after the owner reviewed `/en/ai-assistant` with a second-model UI/UX report and asked for: (1) a visible scrollbar docked at the right edge, (2) streaming Zane output, (3) auto-scroll after history sync + lazy ("sync only what's visible") history loading. Owner decisions recorded in-session: lazy sync stays **within the newest-100 window** (spec 008 prune unchanged); scrollbar implemented as a **custom overlay thumb** (native scrollbar stays hidden); mixed-direction (bidi) fixes **included** in this round.

## 1. Context & problem statement

The AI assistant page (`apps/web/src/app/[locale]/ai-assistant/`) works end-to-end but has four functional gaps verified against code on 2026-09-20:

1. **No streaming.** Every reply arrives as one string: `puter.ai.chat(prompt, { stream: false })` at all six call sites (`apps/web/src/lib/ai/assistant.ts:187,200,281,301,308,451,510,540`); `generateResponse` returns `Promise<string>`; `useAiChat` appends the whole reply in one `setMessages`. Puter's async-iterable streaming return is only handled defensively (`hasAsyncIterator`, `puter-client.ts:169-173`) and never requested.
2. **Server fallback is broken.** `/api/ai/chat` responds with `result.toTextStreamResponse()` (plain-text stream, `route.ts:108`) but the client fallback reads `await response.json()` expecting `{ message }` (`assistant.ts:108`) — a shape mismatch, so the fallback path can never succeed.
3. **Scroll behavior gaps.** The auto-scroll effect (`page.tsx:107-126`) only scrolls when already near bottom; after a signed-in history sync renders (`scrollTop=0`), no jump to the newest message fires. During generation the `isAtBottom || isLoading` branch force-sticks, preventing the user from scrolling up mid-answer. There is no scroll-to-end affordance when detached.
4. **No visible scrollbar / no lazy history.** The messages scrollbar is hidden outright (`.chat-scrollbar-hidden`, `apps/web/src/index.css:525-538` — round-7 decision protecting column centering). History load fetches the newest 100 rows at once (`CHAT_HISTORY_CAP`, `useAiChat.ts:24`); older rows within the window are rendered eagerly; the guest localStorage persist has no cap (spec-008 leftover). Additionally, inline English/code runs inside Arabic bubbles lack bidi isolation (bubble-level `dir=getTextDirection()` only), producing flipped punctuation/labels in mixed-direction replies.

Non-issues verified (rejected second-model claims): the input dock is a pinned flex sibling under the `h-dvh overflow-hidden` shell and cannot be pushed off-screen; the scroll container is already full-viewport-width with the centered `max-w-4xl` column as its child (the "mid-page scrollbar" sighting was a stale `.next` build).

## 2. Architecture & design

### 2.1 Right-edge overlay scrollbar (Workstream 1)

- **Keep native scrollbar hidden** (`chat-scrollbar-hidden` stays on the container in both states) — zero layout shift, column centering preserved on classic-scrollbar platforms (Windows).
- New `apps/web/src/components/ai/ChatScrollbar.tsx`: absolutely-positioned track + thumb overlaying the container's right padding edge. Thumb height = `clientHeight / scrollHeight` ratio (min thumb size); top offset = `scrollTop / (scrollHeight - clientHeight)`. Pointer-event drag on the thumb, click-to-jump on the track, no wheel capture. Auto-hides when `scrollHeight <= clientHeight + 1`. Updates via passive `scroll` listener + `ResizeObserver`. Theme-styled (slate/cyan thumb, light+dark). The container is `dir="ltr"` (`ChatContainer.tsx:162`), so the thumb docks at the physical right edge in both locales — as requested.
- Numeric gate: message-column center vs viewport center = 0px in hero and chat states.

### 2.2 Streaming (Workstream 2)

- `apps/web/src/lib/ai/puter-client.ts`: new pure `extractPuterChunkText(chunk: unknown): string` handling the observed Puter chunk shapes (`{ text }`, `{ message: { content: string | Array<{ text }> } }`), returning `""` for unparseable chunks.
- `assistant.ts` `generateResponse`: new options param `{ onDelta?: (fullSoFar: string) => void }`. When supplied, the cs_assistant/student_agent Puter calls use `stream: true`, iterate the async-iterable response, accumulate text, and invoke `onDelta` per chunk. `withTimeout` now bounds **time-to-first-chunk**; once streaming starts, no overall timeout. `withPuterRetry` / circuit breaker / premium-model fallback apply to pre-first-chunk failures unchanged; mid-stream failure keeps the partial text and flows into the existing error path.
- `tryServerSideFallback` fix: consume `response.body` with a reader, decode text chunks, feed `onDelta`, return the accumulated text. (Fixes the `.json()` shape mismatch; the route already streams.)
- `useAiChat.ts`: `ChatMessage` gains optional `streaming?: boolean`. `sendMessage` passes an `onDelta` that (a) on first delta appends the assistant message with `streaming: true`, (b) afterwards updates its content via a rAF-throttled flush. On completion the message is finalized (`streaming: false`) and the existing `insertChatRow` / persist path runs unchanged. Guest localStorage persist stays event-driven (`pendingPersistRef`). Desktop `AssistantPanel` consumes the same hook and inherits streaming.
- `LazyMarkdown.tsx`: the `dynamic()` wrapper is created **once at module scope** (content flows as a prop — no remount per content change; the current `useMemo(..., [className, content])` recreation is fatal under streaming). While `message.streaming` is true, `ChatMessageItem` renders plain `whitespace-pre-wrap` text; the full markdown pipeline renders on completion (avoids per-tick rehype-highlight cost). The typing indicator shows until the first delta lands.
- Documented, not changed: model-id mismatch between the ChatInput menu (`gpt-5-nano`) and the `resolvePuterModel` fallback constant (`gpt-5.4-nano`) — cannot be verified against live Puter in this round.

### 2.3 Auto-scroll + lazy sync (Workstream 3)

- **Post-sync jump:** when restored history first renders (messages transition empty→N from the load path, not user action), perform an instant `scrollTo(bottom)` (`behavior: "instant"` — no smooth crawl through up to 100 messages).
- **Near-bottom stick:** replace `isAtBottom || isLoading` with stick-only-when-near-bottom (100px threshold tracked by a passive scroll listener). Content growth during streaming pins via instant scroll; a user who scrolled up stays put.
- **Scroll-to-end pill:** floating button above the composer, visible when `messages.length > 0 && !nearBottom`; smooth jump on click. New i18n keys `scrollToEnd`, `loadingOlder` in `packages/shared/src/messages/{en,ar}/aiAssistant.json` (namespace already wired through `request.ts` MESSAGE_LOADERS; `t` is passed down to ChatContainer).
- **Lazy sync (within newest 100):** `useAiChat` gains `loadOlder()` + `hasMoreOlder`. Initial DB load `.range(0, 29)`; a top sentinel div in `ChatContainer` observed by an `IntersectionObserver` (rootMargin ≈ 200px) fetches `.range(30, 59)`, `.range(60, 89)`, `.range(90, 99)` until `CHAT_HISTORY_CAP` or row exhaustion. Spec-008 prune (`pruneChatOverflow`) unchanged. Scroll preservation on prepend: `scrollHeight` captured before the prepend lands; a `useLayoutEffect` restores `scrollTop += (newScrollHeight - oldScrollHeight)`.
- **Guest parity:** guest localStorage persist capped at 100 messages (spec-008 leftover; guests paginate client-side from their already-complete array).

### 2.4 Bidi isolation (Workstream 4)

- In `ChatMessageItem.tsx`'s markdown render path: inline `code` wrapped in `<bdi>` / `dir="ltr"` isolation; paragraph/block-level elements get `unicode-bidi: plaintext`-safe handling so English labels/punctuation do not flip inside Arabic bubbles (extends the round-13 KaTeX `dir="ltr"` fix; fenced code blocks are already `dir="ltr"`).
- Verification is DOM-probe based (`innerText`, element presence, computed `direction`) — never screenshot-description alone (round-10 discipline).

## 3. Behavior preservation & regression strategy

- **Persist policy untouched:** event-driven `pendingPersistRef` writes (zero writes on mount/mode-switch/auth-transition — round-14 lesson), DB insert on send/reply, prune after reply, clearChat semantics — all unchanged. Streaming only changes *when the assistant message's content updates in state*, not what is persisted.
- **Error/fallback ladder intact:** circuit breaker, retry, premium-model fallback and the (now fixed) server fallback keep their trigger conditions; streaming failures before first chunk behave exactly like today's non-streaming failures.
- **Layout regression guards:** `.chat-scrollbar-hidden` stays (no native scrollbar), so the round-6/7 column-centering fixes are structurally preserved; the overlay thumb adds no layout. Numeric center check in both states after implementation.
- **Non-regression suite:** existing vitest suites (`zaneMarkdown`, `ai-circuit-breaker`, utils) must stay green; the eslint ratchet (`--max-warnings=52`) must not regress.

## 4. Test specification (vitest, node env)

1. `extractPuterChunkText`: `{text:"x"}`, `{message:{content:"x"}}`, `{message:{content:[{text:"x"}]}}`, `""`/null/unknown shapes → `""`, multi-chunk concatenation.
2. Delta accumulator (extracted pure fn): first-delta creates, subsequent deltas append, final flush, no rAF in node (inject scheduler).
3. Range-offset pagination math: offsets 0/30/60/90, hasMore flag boundaries at cap 100, reverse-chronological → chronological reversal.
4. Guest 100-cap: array trimmed from the head (oldest dropped) on persist overflow.
5. Fallback stream reader: chunked `ReadableStream` → accumulated string + onDelta calls (polyfilled reader in node).

DOM/visual behaviors (streaming bubble, scrollbar thumb, pill, bidi) are covered by the owner smoke checklist in `checklists/verification.md` — no DOM test env exists (vitest node), and Puter cannot be hit from e2e.

## 5. Atomic execution plan

| # | Commit | Contents | Gate |
|---|---|---|---|
| 1 | `docs(ai): add specs/011 zane chat streaming, scrollbar & lazy sync` | this spec | — |
| 2 | `fix(ai): consume server chat fallback as text stream` | `extractPuterChunkText` + unit tests; `tryServerSideFallback` stream reader | typecheck + lint + vitest |
| 3 | `feat(ai): stream Zane responses via Puter deltas with throttled rendering` | `assistant.ts` onDelta/stream, `useAiChat` streaming state, `LazyMarkdown` module-scope wrapper, `ChatMessageItem` raw-text-during-stream, typing-indicator handoff | typecheck + lint + vitest |
| 4 | `feat(ai): right-edge overlay scrollbar + scroll behavior` | `ChatScrollbar.tsx`, post-sync jump, near-bottom stick, scroll-to-end pill, i18n keys (en+ar; en staged hunk-only — parallel session owns other hunks in that file) | typecheck + lint + vitest + e2e |
| 5 | `feat(ai): lazy history sync with top sentinel and scroll preservation` | `loadOlder`/`hasMoreOlder`, IntersectionObserver sentinel, scroll preservation, guest 100-cap | typecheck + lint + vitest |
| 6 | `fix(ai): bidi isolation for mixed-direction chat bubbles` | inline-code bdi isolation + plaintext-safe blocks + CSS | typecheck + lint + vitest |

Constraints honored: no commits touch the parallel session's dirty files wholesale (`next-env.d.ts`, `sw.js`, `Footer*`, `LanguageToggle`, `Sidebar`, `docs/spec-completion-dashboard.md`); `en/aiAssistant.json` is staged via a filtered patch containing only this spec's key additions.
