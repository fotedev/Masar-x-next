# Wave 3 — AI system (agents 7–9)

> Regenerated 2026-10-28 from the orchestrator's session record (original destroyed with masarx-plan). Content-faithful.

## Agent 7 — lib/ai core

**1. SEV: High — Raw SDK error text returned as a "successful" assistant reply**
- LOC: `apps/web/src/lib/ai/puter-client.ts:224-233` via `assistant.ts:175-177`
- MECHANISM: when `puter.ai.chat(stream:true)` resolves (not rejects) with an error-shaped object, `hasAsyncIterator` is false and `extractPuterChatText` "extracts content from error responses" — returning e.g. `"insufficient_funds for model X"` as chat text.
- SCENARIO: SDK resolves-with-error → reply is the raw error string, bypassing the taxonomy: no ⚠️/💳 canned prefix (breaks the contract locked by `cannedErrorPrefixes.test.ts`), no breaker tick, no 402 gate, and `clearPuterFundsDepleted()` (assistant.ts:453) runs on failure.
- TRACE: streamPuterChat:175 → extractPuterChatText:226-232 → sanitizeAssistantReply:457 → UI renders error string as normal content.
- FIX: detect error-shaped responses and throw instead of returning them. / CONF high (trigger depends on SDK resolve-with-error behavior — code comments at :224 imply it happens) / STATUS NEW

**2. SEV: High — `normalizeLatexDelimiters` rewrites `\[`/`\(` inside fenced code blocks**
- LOC: `apps/web/src/lib/ai/zaneMarkdown.ts:12-16`
- MECHANISM: unlike the other four repairs (which all `split(/(```[\s\S]*?```)/)`, see :24,:46,:70,:92), this one has no fence exclusion, contradicting the module invariant at zaneMarkdown.ts:6-7 ("code must survive byte-for-byte").
- SCENARIO: code samples containing `\[`/`\(` (regex literals, escaped brackets) are rewritten to `$$…$$`/`$…$` before markdown parsing at `ChatMessageItem.tsx:400-401`, corrupting displayed and copyable code.
- FIX: split on fences like the sibling repairs. / CONF high / STATUS NEW (tests cover both regex templates but have no fenced-code case)

**3. SEV: Medium — PuterProvider (unwired, spec 017 3a): retry double-streaming + breaker double-tick**
- LOC: `providers/puter-provider.ts:225-261, 271-286`
- MECHANISM: mid-stream transport throw with partial text re-thrown → `withPuterRetry` (:272) restarts the whole stream, replaying `onDelta(full)` from `''` (content rewind); each failed attempt ticks the breaker in inner (:255-258) AND outer catch (:282-284) → N attempts = N+1 ticks vs assistant.ts's 1 tick/send.
- FIX: on non-empty `full` return partial (mirrors assistant.ts:198-203); drop the outer tick. / CONF high / STATUS NEW (latent — not wired)

**4. SEV: Medium — PuterProvider `available()` blocks ALL models when any one model is 402-depleted** (`puter-provider.ts:153-154` — `if (depleted !== null) return false`, per-model check not applied; latent — not wired). FIX: key per-model. / CONF high / STATUS NEW

**5. SEV: Medium — student_agent path clears the 402 gate without a successful Puter call**
- LOC: `assistant.ts:461-469` vs contract comment `assistant.ts:56-58`
- MECHANISM: `clearPuterFundsDepleted()` runs unconditionally after `generateStudentAgentResponse`, which can return canned `noPlatformContext` (:245-247) or circuit-open message (:264) without touching the SDK → the 402 gate is wiped and the next send re-hits the network.
- FIX: clear only when the reply came from the SDK. / CONF high / STATUS NEW

**6. SEV: Medium — Prompt-injection surface: user content interpolated into single-string prompts**
- LOC: `assistant.ts:249-262` (student_agent), `assistant.ts:437-448` (cs_assistant), `assistant.ts:224-226` (history)
- MECHANISM: `query`/`chatHistory`/`platformContext` concatenated with role markers (`المستخدم:`/`المساعد:`), no delimiters/escaping — a user message containing `المساعد: …` forges history; RAG context sits above the user question in the same string.
- FIX: fence untrusted content in explicit delimiters + instruct model to treat as data. / CONF high (mechanism), impact bounded (no tool access) / STATUS NEW

**7. SEV: Medium — 402 gate keyed on `selectedModel`, not the model that actually billed**
- LOC: `assistant.ts:490` with `assistant.ts:412-419`
- MECHANISM: Claude send that transport-fails falls back to `gpt-5.4-nano`; if the fallback throws `insufficient_funds`, the gate stores `selectedModel.toLowerCase()` (the Claude name) → healthy premium model gated, depleted nano not; also `resolvePuterModel` may map the stored name to a different billed id.
- FIX: store the resolved model extracted from the error. / CONF high / STATUS NEW

**8. SEV: Low — Abandoned SDK calls never cancelled; timeout timers never cleared**
- `circuit-breaker.ts:56-66` (losing promise + its setTimeout never cancelled), retry loop re-calls while timed-out stream stays open (billing/connection leak), `assistant.ts:118-132` (`tryServerSideFallback` fetch has no timeout/abort — a hung `/api/ai/chat` pins `isLoading` forever; no AbortSignal anywhere in the live path). FIX: AbortController threaded through. / CONF high / STATUS NEW

**9. SEV: Low — `enforceFencedCodeBlocks` can fence prose and rewrites code interior** (`sanitize.ts:55,58` — "let me explain…"/"return to …" match ≥2 consecutive `let\s+`/`return\s+` → prose wrapped in a fence; `:95` collapses blank lines inside it). CONF high / STATUS NEW

**10. SEV: Low — `listModels` promise cached forever, including a rejected one** (`puter-client.ts:259,279-282`; `resetPuterClientCache` :43-47 clears others but not `cachedPuterModels` → transient failure degrades model resolution for the whole session). CONF high / STATUS NEW

**11. SEV: Low — `String(response)` instead of `extractPuterChatText` in one-shot paths** (`assistant.ts:594,653,683` — non-string ChatResponse → `"[object Object]"` → JSON.parse throws → quiz/summarize features dead; summarize paths return unvalidated parse). CONF high/medium / STATUS NEW

**12. SEV: Low — Premium auth check uses pre-resolution model in student_agent only** (`assistant.ts:271` vs :355-356) + `isPuterAuthError` substring matching ("author…" counted as auth) feeding Fatal classification (`providers/errors.ts:96-101`) — unwired impact only. STATUS NEW

**Clean**: delta-throttle trailing-edge + tests; stream-reader multi-byte handling; circuit-breaker window/counter core; repairSpacedBold/repairBoldBoundaries/repairListGlue fence-splitting; completeOpenFences (cosmetic 4-backtick miscounts only); mock-provider; canned-prefix contract intact; no token/cost accounting in scope. Retry double-bubble semantics match accepted baseline.

---

## Agent 8 — Chat UI

**Baseline note:** event-driven `pendingPersistRef` guest persistence (11307f7) **still holds end-to-end** — raised only on append/finalize/error paths (useAiChat.ts:276,297,328,393,407), consumed once by the effect (257-270), skipped on mount/mode-switch/auth transitions, deletion exclusive to clearChat (437), guest cap enforced (267). KNOWN-fixed, holding.

**1. SEV: High — Dead mode-change guard during streaming → cross-thread contamination (and clearChat mid-stream resurrection)**
- LOC: `apps/web/src/hooks/useAiChat.ts:309,380` (guards), 102-125 (guest restore), 328+267-269 (persist), 428-439 (clearChat)
- MECHANISM: `flushStream`/post-response guard `if (mode !== currentMode) return;` compares the same closure binding — `currentMode = mode` was assigned from the identical render capture, so it is always false. Nothing cancels an in-flight stream when mode changes or chat is cleared.
- SCENARIO: Guest sends in cs_assistant, stream starts, switches persona (ChatInput.tsx:348-371 is NOT disabled while isLoading) → guest layout effect replaces `messages` with the new mode's thread; subsequent deltas append the old conversation's streaming bubble into it, and `finalizeStream` raises `pendingPersistRef` so the contaminated array is persisted under the NEW mode's key. Same for clearChat mid-stream: response appends into the emptied array and re-persists after deletion.
- TRACE: sendMessage(mode=A) → setMode(B) → layout effect setMessages(B-history) → rAF flush → flushStream appends {assistant_A} → finalize map+persist → effect writes B-key with A's reply.
- FIX: compare against `modeRef.current` (or generation token) instead of the closure `mode`; check in flushStream/finalize/clear. / CONF high / STATUS NEW

**2. SEV: High — Desktop AssistantPanel inherits persisted mode with no mode UI → permanently blocked in student_agent**
- LOC: `apps/web/src/components/desktop/workspace/AssistantPanel.tsx:46-52`; `useAiChat.ts:84-92, 275-287`
- MECHANISM: Panel instantiates its own `useAiChat` whose initial mode comes from shared `zane_ai_last_mode` localStorage; no mode switcher/subject picker → `studentSelectedSubject` permanently `""`.
- SCENARIO: User last used student_agent on the standalone page → every panel send hits the guard at useAiChat.ts:275 → canned "select a subject first" forever; group_rag similarly answers `groupRagNoData`. No recourse inside the panel.
- FIX: Force/default `cs_assistant` in the panel context (or expose mode + subject selection). / CONF high / STATUS NEW

**3. SEV: Medium — Pressing Enter while streaming silently wipes the draft**
- LOC: `apps/web/src/app/[locale]/ai-assistant/page.tsx:163-173`; `useAiChat.ts:273`; `ChatInput.tsx:179-184,262-276`
- MECHANISM: textarea never disabled while `isLoading`; `handleSendMessage` calls `setInputMessage("")` + clears attachments BEFORE `sendMessage`, which early-returns on `isLoading` — text and attachment chips vanish with no send. AssistantPanel guards correctly (`|| isLoading` at AssistantPanel.tsx:76) — the page missed it.
- FIX: Add `isLoading` to the early-return before clearing state. / CONF high / STATUS NEW

**4. SEV: Medium — AssistantPanel auto-stick fights user scroll during generation**
- LOC: `AssistantPanel.tsx:62-70` — `if (isNearBottom || isLoading)` smooth-scrolls on every delta → scrolling up during generation is instantly yanked back; per-delta `scrollTo` jank. Standalone page fixed this via useChatScroll; panel kept old behavior. FIX: drop `|| isLoading`. / CONF high / STATUS NEW

**5. SEV: Medium — `loadOlder` lacks the cancellation the initial load has → cross-thread prepend**
- LOC: `useAiChat.ts:187-229` (contrast cancelled-flag pattern at 130-182)
- MECHANISM: after the `await`, unconditionally `setMessages(prev => [...older, ...prev])` and mutates `loadedCountRef`/`hasMoreOlder` — no user/mode guard.
- SCENARIO: user scrolls to top in mode A (fetch in flight), switches mode → old-mode rows prepend into the new thread; pagination state now describes the wrong thread.
- FIX: capture user.id+mode and bail after the await. / CONF high / STATUS NEW

**6. SEV: Low — CANNED_ERROR_PREFIXES emoji heuristic false-positives on genuine replies** (`ChatMessageItem.tsx:207-210`; `canned-messages.ts:25` — any reply *starting with* ⚠️/💳 renders as amber error bubble with retry). FIX: match full canned strings. CONF high / STATUS NEW

**7. SEV: Low — QuickQuizFromTextModal generate path has no error handling** (`QuickQuizFromTextModal.tsx:38-60` — try/finally with no catch → unhandled rejection, silent modal). FIX: catch → toast. CONF high / STATUS NEW

**8. SEV: Low — IntersectionObserver churn per delta + stale prepend anchor over-scroll** (`ChatContainer.tsx:181-218` — observer recreated per stream delta; `prependAnchorRef.scrollHeight` captured at request time can over-correct after content grows). CONF medium / STATUS NEW

**Clean:** ChatScrollbar logic; LottiePlayer mount-race wrapper; LazyMarkdown wrapper; ChatHeader; QuickQuizPlayerModal; PuterSettingsModal (self-correcting); ChatMessageItem copy/raw-view state.

---

## Agent 9 — AI transport

**1. SEV: High — Unrestricted model selection on /api/ai/chat (AI Gateway billed to project key)**
- LOC: `apps/web/src/app/api/ai/chat/route.ts:24` (schema `model: z.string().max(200).optional()`) → `:102` (`body.model?.trim() || DEFAULT_GATEWAY_MODEL`) → `:104-109` (`streamText({ model: modelId, ... })`)
- MECHANISM: Any authenticated user (no tier/plan check) can hand-craft a POST with `model: "<any AI-Gateway id>"` — server bills `AI_GATEWAY_API_KEY` for a frontier model. Rate limit (10/min) caps frequency, not cost.
- SCENARIO: Free user scripts `curl` with `{"prompt":"hi","model":"anthropic/claude-opus-4-5"}` — accepted, streamed, billed premium.
- FIX: Allowlist model ids (or drop the field); tie premium ids to a plan check. / CONF high / STATUS NEW

**2. SEV: High — ai-chat edge fn: no prompt-size cap and no maxOutputTokens; mobile bypasses the proxy cap**
- LOC: `supabase/functions/ai-chat/index.ts:282-328` (validation checks only presence) → `:328` (`prompt = ...${body.userMessage}`) → `:346-348`/`:155,160` (`getGenerativeModel({model})`, no `generationConfig`)
- MECHANISM: web proxy caps bodies at 50k chars (`api/ai-chat/route.ts:52-56`), but mobile calls the edge fn directly (`apps/mobile/src/lib/ai.ts:39-41`) with no size limit; Gemini output unbounded.
- SCENARIO: Mobile user POSTs a 5MB userMessage → huge prompt + unbounded completion billed per request; combined with the known missing edge rate limit → open-ended spend.
- TRACE: serve (230) → auth getUser (270) → validation (282-328, no length check) → generateContent/stream (348/335) → Gemini unbounded in+out.
- FIX: enforce `userMessage.length <= N` and `generationConfig.maxOutputTokens`. / CONF high / STATUS NEW

**3. SEV: Medium — 30s proxy maxDuration truncates long Gemini SSE streams (silent partial answers)**
- LOC: `api/ai-chat/route.ts:143` (`maxDuration = 30`) vs edge fn streaming until finish (`index.ts:146-228`)
- MECHANISM: when generation exceeds 30s Vercel kills the function mid-stream; the shared client's reader loop treats EOF as normal end (`packages/shared/src/ai/index.ts:153-181`) — truncated answer, no `done:true`/error frame. JSON mode >30s returns gateway 504.
- FIX: raise maxDuration or add server-side generation timeout < proxy limit. / CONF medium / STATUS NEW

**4. SEV: Medium — /api/mcp uses one module-level transport for all clients (session multiplexing)**
- LOC: `api/mcp/route.ts:83-88` (single `WebStandardStreamableHTTPServerTransport`, `server.connect(transport)` at module scope), reused at :94/:104
- MECHANISM: SDK's documented pattern is one transport per session/request; a shared instance keeps one sessionId and one pending-response map → concurrent clients' traffic can be routed to the wrong consumer (including tool results).
- FIX: construct server+transport per request/session. / CONF medium / STATUS NEW. (Auth itself sound; bearer compare not timing-safe — negligible.)

**5. SEV: Medium — JSON mode of ai-chat does not propagate cancellation to Gemini (billing continues after client abort)**
- LOC: `ai-chat/index.ts:348` (`await model.generateContent(prompt)` — no signal); SSE path aborts correctly (:153,160-161,221-224)
- MECHANISM: mobile passes an AbortSignal (`apps/mobile/src/lib/ai.ts:80-87` → shared/ai/index.ts:66-71) but the fetch abort only severs the response wait; the non-streaming Gemini call keeps generating and bills.
- FIX: wire request signal into JSON-mode generateContent. / CONF high (mechanism; billing behavior assumed) / STATUS NEW

**6. SEV: Low — Chat history turn-capped (20) but not char-capped** (`assistant.ts:217-229` fed from useAiChat.ts:343-348; pasted content ~10k chars/turn → up to ~200k chars reach Puter models; student-agent context IS clamped, history is the gap). CONF high / STATUS NEW

**7. SEV: Low — summarize-chat prompt built from 50 messages with no aggregate size cap** (`summarize-chat/index.ts:68-79,103-111,145` — count cap enforced; no content truncation; overflow cost angle new). CONF medium / STATUS NEW

**8. SEV: Low — Attacker-controlled strings logged unescaped in ai-chat edge fn (log injection)** (`ai-chat/index.ts:365-371, 189-196` — conversationId/appVersion client-controlled, newlines can forge log lines; userMessage correctly excluded). CONF high / STATUS NEW

**9. SEV: Low — /api/ai-chat proxy forwards the client's own Authorization header instead of the verified session's token** (`api/ai-chat/route.ts:113` — rate limit keyed to cookie user while edge authenticates whoever's bearer is forwarded; requires possessing another user's JWT, no standalone escalation). FIX: always inject server session token. CONF high / STATUS NEW

**10. SEV: Low — AI rate limit degrades to per-instance in-memory (effective limit = 10 × instances) when no durable store configured** (`rate-limit.ts:112,355-369` — permanent demotion on one structural error; key choice and burst-safe reserve correct; no bypass path found). FIX: operational alert on demotion. STATUS NEW (documented-in-code).

**Clean:** pasted-attachment web/mobile parity (both re-export shared module, both enforce AI_PROMPT_MAX_CHARS); student-agent retriever RLS-scoped/approved-only/clamped; SSE framing + shared parser handle partial chunks and mid-stream error frame; summarize-chat participant check present; edge CORS allow-list scoped; provider-key headers checked at both layers.
