# Spec 011 — Tasks

> Status ledger: `[ ]` pending · `[~]` in progress · `[x]` done · `[!]` blocked/deferred

## Phase A — Server fallback + chunk extraction (commit 2)

- [x] A1 `apps/web/src/lib/ai/puter-client.ts`: add `extractPuterChunkText(chunk: unknown): string` (pure; shapes `{text}`, `{message:{content: string|Array<{text}>}}`; safe fallback `""`).
- [x] A2 `apps/web/src/lib/ai/assistant.ts`: rewrite `tryServerSideFallback` to read `response.body` (reader + TextDecoder), feed `onDelta`, return accumulated text; keep 503/error handling.
- [x] A3 `apps/web/src/lib/ai/__tests__/`: unit tests for A1 + fallback reader parsing (chunked stream, onDelta order).

## Phase B — Streaming (commit 3)

- [x] B1 `assistant.ts`: `generateResponse(..., opts?: { onDelta? })` — cs_assistant + student_agent Puter calls `stream: true`, async-iterate, accumulate, invoke `onDelta`; timeout = time-to-first-chunk; mid-stream failure keeps partial.
- [x] B2 `useAiChat.ts`: `ChatMessage.streaming?: boolean`; rAF-throttled delta flush into state; first-delta append; finalize on completion before insertChatRow/persist.
- [x] B3 `LazyMarkdown.tsx`: module-scope `dynamic()` wrapper; content as prop.
- [x] B4 `ChatMessageItem.tsx`: while `streaming`, render plain `whitespace-pre-wrap` text; full markdown on completion; typing indicator until first delta.

## Phase C — Scrollbar + scroll behavior (commit 4)

- [x] C1 `components/ai/ChatScrollbar.tsx`: overlay track+thumb (drag, click-to-jump, auto-hide, ResizeObserver + passive scroll).
- [x] C2 `page.tsx`/`ChatContainer.tsx`: post-sync instant jump; near-bottom stick (100px, no forced stick while loading); pill visibility state.
- [x] C3 Scroll-to-end pill component + smooth jump; i18n keys `scrollToEnd`, `loadingOlder` in en+ar aiAssistant.json (en: filtered-patch staging only).
- [ ] C4 Numeric gate: column center vs viewport center = 0px in hero + chat states.

## Phase D — Lazy sync (commit 5)

- [x] D1 `useAiChat.ts`: initial `.range(0,29)`; `loadOlder()` pages 30/60/90 to cap 100; `hasMoreOlder`; loadingOlder flag.
- [x] D2 `ChatContainer.tsx`: top sentinel + IntersectionObserver (rootMargin ≈200px) → `loadOlder()` (authenticated only).
- [x] D3 Scroll preservation: capture `scrollHeight` pre-prepend, `useLayoutEffect` restore `scrollTop += Δ`.
- [x] D4 Guest persist 100-cap (drop oldest) + unit test.

## Phase E — Bidi (commit 6)

- [x] E1 `ChatMessageItem.tsx` markdown components: inline `code` → `<bdi>`/`dir="ltr"`; plaintext-safe paragraph blocks; unlayered CSS where the cascade demands it (index.css lessons).
- [~] E2 DOM-probe verification (computed direction/inner order) in dev session with owner.

## Verification

- [x] V1 `pnpm typecheck`
- [x] V2 `pnpm --filter web lint` (ratchet 52, no regression)
- [x] V3 `pnpm --filter web test` (all suites green incl. new ones)
- [x] V4 `pnpm --filter web test:e2e` (after commit 4)
- [~] V5 Owner smoke checklist (checklists/verification.md)
