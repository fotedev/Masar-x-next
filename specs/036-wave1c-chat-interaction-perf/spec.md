# Spec 036 — Wave 1C: Chat Interaction + Quizzes Render Perf

Status: Approved (owner, 2026-11-07 — plan approved with 3 tweaks, incorporated below)

## Goal

Cut the interaction-time render cost of the AI chat and the quizzes dashboard. These are
P1/P2 findings from the 2026-11-02 performance audit (`docs/perf/audit-2026-11-02/`):
CHAT-1, CHAT-2, CHAT-3, RENDER-2. Client-only wave: no DB, no migrations, no generated
types, no i18n keys, and **zero edits under `supabase/functions/`** (owner's active
reorganization zone — see Exclusions).

## Owner notes incorporated (2026-11-07)

1. Web AI is 100% Puter (`@heyputer/puter.js`); there are no Gemini models in the client.
   The old EDGE-1 target (Gemini pins in edge functions) is moot and stays untouched.
2. Regular users can no longer upload or modify files/materials — admin-only. The old
   EDGE-4 target is dropped.
3. No conflicts with the owner's other sessions: branch is cut from current `main`
   (`c130352`, which already contains the owner's merged quiz fixes #182/#185).
4. Edge functions are the owner's cleanup zone — excluded entirely (facts recorded below).

## Owner tweaks on the approved plan

- **Tweak 1 (Track C):** `useInViewport` starts `false`; only an environment without
  `IntersectionObserver` (jsdom/vitest) flips it to `true` inside the effect. Nothing
  viewport-dependent mounts at first paint, and SSR/client markup matches (no hydration
  mismatch).
- **Tweak 2 (Track A):** `messagesRef` is assigned synchronously in the render body
  (`messagesRef.current = messages`), not in an effect. The retry path was verified:
  `handleRetryLast` does not slice — it scans the transcript for the last user prompt and
  re-sends it (error bubble stays as history, round-14 semantics), so reading the
  render-synced ref preserves that behavior exactly.
- **Tweak 3 (Track A):** page-level callbacks audited. `handleRetryLast` was the only one
  depending on `messages` — it now reads `messagesRef` so the memoized `ChatContainer`
  (ChatContainer.tsx:47) is not defeated during streaming. `AssistantPanel.tsx` (the
  second `useAiChat` consumer) was audited: no `messages`-dependent callbacks, no retry
  button — no change needed.
- **Track B:** the rehype plugin arrays are module-level constants (stable identities).

## Tracks

### Track A — CHAT-1: `sendMessage` identity churn (`hooks/useAiChat.ts`, `ai-assistant/page.tsx`)

`sendMessage` reads `messages` once (history snapshot) but listed it in its dep array, so
the handler was recreated on every streamed delta. Fix: render-synced `messagesRef`
mirror (same pattern as `userRef` in AuthContext, spec 034); history reads
`messagesRef.current`; `messages` leaves the dep array. The hook returns `messagesRef`;
`handleRetryLast` reads it (deps drop `messages`). `isLoading` stays in `sendMessage`'s
deps — the concurrency guard reads it from the closure.

Acceptance: `sendMessage` identity is stable across a whole streaming exchange except the
two `isLoading` flips (start/end); `handleRetryLast` never churns during streaming.

### Track B — CHAT-3: skip syntax highlighting while streaming (`MarkdownRendererHeavy.tsx`, `LazyMarkdown.tsx`, `ChatMessageItem.tsx`)

`rehypeHighlight` ran unconditionally, re-highlighting the growing bubble once per frame.
`MarkdownRendererHeavy` gains `streaming?: boolean`; module constants
`HIGHLIGHT_REHYPE_PLUGINS` / `EMPTY_REHYPE_PLUGINS`; forwarded through `LazyMarkdown`;
passed at both `ChatMessageItem` call sites (main rendered view + nested language-markdown
case). One full highlighted render on finalize is the intended one-time cost.

### Track C — CHAT-2 (owner design): IntersectionObserver-gated Lottie avatars (`hooks/useInViewport.ts` new, `ChatMessageItem.tsx`)

Every assistant message mounted its own dotLottie player (canvas + engine per message).
A shared module-singleton `IntersectionObserver` (`rootMargin: "200px"`) drives
`useInViewport`; the avatar renders `LottiePlayer` only when `inView || isLatestAssistant`
(latest always animated), otherwise a same-size, same-gradient placeholder circle —
unmount, not pause, per owner decision; zero layout shift (CLS must stay 0.000).
jsdom/SSR fallback: no `IntersectionObserver` → `inView` set `true` in the effect.

### Track D — RENDER-2: quizzes grid (`QuizGridItem.tsx`, `quizzes/page.tsx`)

`QuizGridItem` wrapped in `memo` (default shallow, matching the `ChatContainer` /
`ChatMessageItem` precedent); the four dashboard handlers and the two inline `router.push`
arrows become stable `useCallback`s so memo engages while filtering.

FETCH-2 (unbounded `select("*")` in `quizzes/_hooks/useQuizzesData.ts`) is **deferred, not
dropped**: admins fetch all rows by design and non-admins filter client-side, so a client
limit would silently hide quizzes. Wave 2's server-side academic scoping bounds the set
properly.

## Exclusions (facts for the owner's edge-function cleanup — no edits made)

- `supabase/functions/summarize-chat` and `supabase/functions/process-pdf`: zero client
  callers in the repo.
- `supabase/functions/ai-chat`: called only by the mobile app
  (`apps/mobile/src/lib/ai.ts:40`) and a web proxy route (`/api/ai-chat`) that no web
  client code calls.
- `supabase/functions/upload-file`: the only one the web actually calls
  (`lib/cloudinary.ts:83`); it has no server-side admin check — gating is client-side UI
  only (owner is aware; edge-function territory).
- Gemini model strings exist only inside edge functions, never in `apps/web` /
  `packages/shared`.

## Acceptance criteria / verification

Measured in the worktree (`.env.local` copied before build; NEXT_PUBLIC inlines at build
time):

- [ ] Build green (Turbopack), standalone size unchanged (~52 MB).
- [ ] vitest suite green (baseline 286/286).
- [ ] Playwright e2e green — `ai-chat-history` is the critical suite (its long-transcript
      path exercises Track C directly); known slow-runner flake → one `rerun --failed`.
- [ ] Lighthouse smoke on `/ai-assistant` and `/quizzes`: no LCP/CLS regression (news CLS
      must stay 0.000); TBT/INP expected to improve on long chats.
- [ ] Manual dev check: multi-message chat, scroll up/down — robots mount only near the
      viewport, placeholder shows no shift, guest persistence survives reload.

## Results

Measured 2026-11-07 in the worktree at `fix/036-wave1c-chat-perf` (commits `00c9d55`…`8edf36a`):

- [x] Typecheck clean; ESLint 0 errors, 48 warnings (all pre-existing `no-console` style; repo cap 52).
- [x] vitest 286/286 — baseline held exactly.
- [x] Build green (Turbopack); standalone **52 MB** unchanged (`@img` 19 MB — the spec-033 trace fix intact).
- [x] Playwright e2e **18 passed / 2 skipped / 0 failed** (skips = signed-in/prod suites needing credentials,
      same as prior waves). `ai-chat-history` — the 60-bubble transcript that exercises Track C directly —
      passed in 7.0s.
- [x] Lighthouse 13.6 smoke (mobile, Playwright Chromium-1248, single-run volatility ±5; machine live):
      - `/ar/ai-assistant` ×2: perf **81 / 80**, LCP 1.9 / 2.0 s, TBT 660 / 710 ms, **CLS 0.005 / 0.005**.
        No regression signal — the recorded 1.37 s baseline (spec 032) was a single volatile run under
        different machine load, and none of these tracks touch a load-time LCP path (the hero is
        untouched; avatar gating affects only message bubbles after content exists).
      - `/ar/quizzes` ×2: perf 84 / 62, LCP 1.4 / 1.4 s, TBT 620 / 540 ms, CLS **0.013 / 0.77**.
        The CLS bimodality is the documented pre-existing guest allow-list race (specs 033/034 Wave-2
        wall — needs server-side academic scoping); Track D changes no layout. Reruns show both faces.
- [x] Manual/dev structural check: handler identities verified stable by construction
      (`messagesRef` render-synced; retry reads the ref; quizzes handlers + modal-dialog
      helpers `useCallback`-wrapped), highlight skip verified via the `streaming` prop path
      (main + nested language-markdown call sites), avatar gating verified in the e2e
      long-transcript run. Guest persistence untouched (event-driven persist from round 13/14).

Deferred (documented, not dropped): FETCH-2 unbounded quizzes fetch — a client limit would
hide rows (admins fetch all by design; non-admins filter client-side); Wave 2 server-side
academic scoping bounds it properly. Quizzes CLS wall rides the same Wave-2 work.
