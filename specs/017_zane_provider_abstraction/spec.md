# Spec 017 — Zane AI provider abstraction + graceful degradation

> **Status**: open (owner-directed in-session, 2026-09-24; satisfies I11 spec-first and MVP Lock category "core study-flow stability + login + essential data" — Zane is the AI tutor on the student study-flow route). `Status` flips to `approved` only when the owner signs off on the spec doc + the AC→test mapping table; implementation does not start before that.
> **Branch**: `feat/zane-provider-abstraction` (atomic commits; rebase on current `main` after spec 016 lands).
> **Owner directive**: introduce a provider interface so Puter becomes one adapter behind a stable contract; failures are normalized; the rest of the app keeps working when AI is unavailable.

## 1. Context & problem statement

Zane currently calls Puter directly at six sites in `apps/web/src/lib/ai/assistant.ts`:

| # | Site | Purpose |
|---|---|---|
| 1 | `assistant.ts:170` | `puter.ai.chat(prompt, { stream: true })` — cs_assistant streaming call |
| 2 | `assistant.ts:269-272` | student_agent context call (assertSignedIn for Claude, resolveModel) |
| 3 | `assistant.ts:277` | student_agent streaming invocation |
| 4 | `assistant.ts:297` | student_agent summarize streaming invocation |
| 5 | `assistant.ts:351-355` | summarize academic subjects / group RAG call |
| 6 | `assistant.ts:451-540` | `generateQuiz` + summarize-quiz path |

Plus `puter-client.ts` (chunk extractor, model resolver, signed-in probe) and `circuit-breaker.ts` (45s window on 2 transport failures). Today the policy, error taxonomy, retry, and Puter-specific quirks are intermixed with the call sites.

Failure modes today:

- **`QuotaExceeded` (Puter 402 `insufficient_funds`)** — per-model gate at `assistant.ts:59-67,490,524,538`; returns `canned.insufficientFunds`. *Correct* behavior, but the gate lives next to the call sites, not behind a policy.
- **`Unavailable`** (transport / 5xx / timeout) — `circuit-breaker.ts:41-51` opens 45s after 2 failures in 60s; returns `canned.puterUnavailable`. Retry-with-backoff (`withPuterRetry`) covers transient drops.
- **`RateLimited`** — currently indistinguishable from `Unavailable` (both bubble up as `canned.serviceUnavailable`). No explicit 429 path. **No 429 classifier exists in the code today**; see §3.4 for how this is handled.
- **`Fatal`** (auth, model-not-available, anything else) — `canned.genericError`.
- **`Cancelled`** — handled as "message marked interrupted" but never named; today the abort path can still re-fire `notePuterTransportFailure` if the abort races with a stream chunk (spec 011 didn't isolate this — a regression test for this exact race is added in §5.1).

Consequence: there is no abstraction. Adding a server-route/OpenAI/Ollama adapter later requires editing `assistant.ts` again, plus re-running every test that touches Puter. There is no shared contract tests can run against.

### Call-site coverage today (six sites in `apps/web/src/lib/ai/assistant.ts`)

Two flavors, **both** must be covered by the abstraction:

| Flavor | Sites | Purpose |
|---|---|---|
| **Streaming chat** (model returns deltas via async iterator) | `assistant.ts:170`, `:277`, `:297` | cs_assistant + student_agent + summarize-chats |
| **One-shot completion** (model returns a single JSON or string) | `assistant.ts:269-272` (student_agent context probe), `:351-355` (summarize academic / group RAG), `:451-540` (`generateQuiz` + summarize-quiz) | Context resolution, summarize, **quiz generation** |

Public callers (must all keep working under the abstraction):

| Caller | Surface | AI feature |
|---|---|---|
| `apps/web/src/hooks/useAiChat.ts:370` | `aiAssistant.generateResponse` | Streaming chat |
| `apps/web/src/app/[locale]/ai-assistant/page.tsx:165,175,178` | `summarizeAcademicContext` / `summarizeCurrentChat` / `summarizeLoadedData` | Summarize (one-shot) |
| `apps/web/src/app/[locale]/quizzes/_hooks/useQuizImport.ts:92` | `aiAssistant.generateQuiz` | Quiz import (one-shot JSON) |
| `apps/web/src/components/ai/QuickQuizFromTextModal.tsx:43` | `aiAssistant.generateQuiz` | Quick quiz from text (one-shot JSON) |

The interface MUST serve both flavors. A streaming-only design would force `generateQuiz` and the summarize calls to keep calling Puter directly, defeating the abstraction's purpose.

**Owner-mandated design properties** (already-decided, do not reopen in this spec):

- The interface must be **streaming** (yields chunks, accepts `AbortSignal`, reports errors only through the taxonomy below).
- The taxonomy names are fixed: `QuotaExceeded`, `RateLimited`, `Unavailable`, `Fatal`, `Cancelled`. `Cancelled` is **not** a failure — never triggers fallback, never opens the degraded UI.
- The policy is **an ordered list** of providers. On a fallback-eligible error (`QuotaExceeded | RateLimited | Unavailable`) **before the first token**, try the next. After the first token, never switch providers — keep partial text, mark message interrupted, surface a retry action. When the list is exhausted on a fallback-eligible error, enter the degraded state.
- A **MockProvider** must exist (deterministic streams + switchable failure modes + slow/abort) and must be **impossible to enable in a production build** (build-time/env guard + a test for the guard).
- The **degraded UI** is one clear localized message shown in the chat when all providers fail with a fallback-eligible error. **Reconcile with the existing `canned.insufficientFunds`**: do not leave two messages for the same situation. Suggested copy (subject to repo tone, must go through i18n `canned.*` keys, ar+en, RTL-correct):
  - **ar**: `Zane غير متاح حالياً. المواد والملخصات وبنوك الأسئلة تعمل كالمعتاد.`
  - **en**: `Zane is unavailable right now. Materials, summaries, and question banks still work.`
- The rest of the app must remain fully usable in the degraded state. `Fatal` keeps the existing `canned.genericError` behavior.

## 2. Scope

**In scope** (per owner):

- `AIProvider` interface.
- Normalized error taxonomy (`QuotaExceeded`, `RateLimited`, `Unavailable`, `Fatal`, `Cancelled`) with `AbortSignal → Cancelled` and Puter-402 → `QuotaExceeded` mapping.
- `PuterProvider` adapter (the current Puter call paths).
- `MockProvider` for tests (deterministic canned streams + switchable failure modes + slow for abort).
- Fallback policy (ordered list, first-token switch semantics, no-fallback on `Cancelled`/`Fatal`, degraded state when list exhausted).
- Degraded-state UI: one localized message (`canned.unavailable` new key) used when the list is exhausted; reconcile with `canned.insufficientFunds` so the two never both fire.
- i18n `canned.unavailable` + `degradedBanner` keys in ar + en (`packages/shared/src/messages/{ar,en}/aiAssistant.json`).
- Tests: unit (normalization, policy), contract suite (parametrized across adapters), e2e (Playwright with MockProvider, forced 402 → degraded message, navigation to other features still works).

**Out of scope** (do not build, do not stub, do not add env vars):

- BYOK.
- Server-route / AI Gateway adapter (already mentioned in spec 012 §7 — still out).
- OpenAI-compatible adapter.
- Ollama / local model adapter.
- Quotas / rate limits for paid fallbacks.
- Visual regression / screenshot tests for the degraded UI.
- Onboarding / OSS contributor docs.

**Design principle for extensibility** (per owner): "adding any of these later means adding one adapter file and registering it, with no changes to Zane UI or the policy." Therefore:

- Provider construction lives in `apps/web/src/lib/ai/providers/registry.ts` — returns a single ordered list.
- The `AIProvider` interface is the **only** type `assistant.ts` sees of an adapter.
- The policy engine reads the registry; it does not import any concrete provider.

## 3. Architecture & design

### 3.1 Module layout (new files under `apps/web/src/lib/ai/providers/`)

```
providers/
├── types.ts            # AIProvider, ChatRequest, CompletionRequest, ChatChunk, NormalizedError, NormalizedErrorKind, AdapterResult
├── errors.ts           # classifyPuterError, isNormalizedError; re-exported taxonomy names; isFallbackEligible
├── mock-provider.ts    # MockProvider (deterministic + switchable failures + slow)
├── puter-provider.ts   # PuterProvider (owns the 6 Puter call sites; withPuterRetry/withTimeout/circuit-breaker live INSIDE here, not above)
├── policy.ts           # ordered-list fallback engine (runWithFallback) — sits ABOVE adapters, does NOT touch retry/timeout/breaker state
├── registry.ts         # getProvidersForMode(mode, locale?) → AIProvider[]
└── __tests__/
    ├── errors.test.ts
    ├── policy.test.ts
    ├── mock-provider.test.ts
    ├── puter-provider.test.ts
    ├── abort-race.test.ts          # regression: abort mid-chunk must not call notePuterTransportFailure
    └── contract.test.ts            # parametrized across adapters (both streaming + completion flavors)
```

`assistant.ts` keeps the public surface (`generateResponse`, `summarizeAcademicContext`, `summarizeCurrentChat`, `summarizeLoadedData`, `generateQuiz`) but delegates to `runWithFallback(providers, { ... })` for every call. `useAiChat.ts`, `useQuizImport.ts`, and `QuickQuizFromTextModal.tsx` keep their public behavior and surface a `degraded: boolean` flag (or, for non-chat surfaces, a `degraded` toast/badge — see §3.7) the page/modal consumes to render the banner.

### 3.2 Layering rule (binding — addresses owner notes 2 + 4)

The abstraction has three layers. Each layer's responsibility is exclusive — no layer reaches into another's internals:

| Layer | Responsibility | Does NOT do |
|---|---|---|
| **Adapter (`PuterProvider`)** | Owns SDK quirks: `withPuterRetry` (3 attempts, 500ms backoff), `withTimeout` (30s), the **per-provider** circuit breaker window (45s on 2 transport fails in 60s), the per-model 402 gate (`puterFundsDepletedModel`). Wraps thrown errors in `NormalizedError`. | Does NOT consult other providers. Does NOT decide whether to fall back. Does NOT know the policy exists. |
| **Policy (`runWithFallback`)** | Walks the ordered provider list; switches on pre-first-token fallback-eligible errors; locks after first token; calls `onDegraded` when list exhausted. Calls `notePuterTransportFailure`-equivalent **once per failed provider, only on pre-first-token failures**, with its own cross-provider breaker. | Does NOT retry, does NOT timeout. Does NOT classify errors (delegates to the adapter's wrapped `NormalizedError`). |
| **Caller (`assistant.ts` + hooks/modals)** | Maps policy results to UI: chat → assistant bubble; quiz import → toast + error state; quick-quiz modal → toast + error state. | Does NOT call Puter directly. Does NOT know adapter internals. |

**Why this matters (owner note 2):** today `withPuterRetry`, `withTimeout`, and the breaker live next to the call sites, and the 402 gate is a module-scoped variable. If we leave them where they are and add the policy on top, retries stack (adapter retries 3× → policy also tries next provider → 3× more → user sees a hung page), and the breaker state is shared across providers (one provider's 5-minute outage counts against another's). Putting retry/timeout/breaker **inside** `PuterProvider` confines them to that provider; the policy sits above and decides cross-provider questions only.

**Breaker state per provider (owner note 2):** today's `puterCircuitOpenUntilMs` is moved from a module-scope `let` to a `WeakMap<AIProvider, BreakerState>` (or a plain `Map` keyed by `provider.id`). Tests can inject a fresh state per provider. The breaker **only opens** when a `PuterProvider` stream returns `Unavailable` before the first token; it never opens on `QuotaExceeded`, `RateLimited`, `Cancelled`, or `Fatal` (those have explicit semantics).

**`puterFundsDepletedModel` semantics preserved (owner note 2):** the per-model short-circuit, the clear-on-first-successful-stream behavior, and the lowercase comparison at `assistant.ts:61-64` are unchanged — they live in `PuterProvider.available()`. The spec deliberately does NOT generalize this to a per-provider state: Puter-only today, and overgeneralizing would invite a "global per-provider gate" that has no current user.

### 3.3 `AIProvider` interface (exact shape — streaming AND one-shot completion)

```ts
// providers/types.ts
export interface ChatChunk {
  /** Plain text delta. Empty strings are not emitted (filter upstream). */
  text: string;
}

export interface NormalizedError extends Error {
  /** Discriminator; "cancelled" is never a failure. */
  kind: 'QuotaExceeded' | 'RateLimited' | 'Unavailable' | 'Fatal' | 'Cancelled';
  /** Underlying cause, for logger.warn only. */
  cause?: unknown;
  /** Provider id, for telemetry. */
  providerId: string;
}

/** Streaming call: chat-style deltas, with first-token signal for the policy lock. */
export interface ChatRequest {
  prompt: string;
  mode: AiAssistantMode;
  model?: string;
  signal: AbortSignal;
  /** Called on every text delta AFTER the first token. */
  onDelta: (fullText: string) => void;
  /** Called exactly once, on first emitted chunk. Used by the policy to lock the provider. */
  onFirstToken: () => void;
}

/** One-shot call: single JSON or string result (used by generateQuiz + summarize).
 *  `onPartial` is optional — some completion paths report partial JSON, most don't.
 *  If supplied, the first call to `onPartial` is the policy's "first token" signal. */
export interface CompletionRequest {
  prompt: string;
  mode: AiAssistantMode;
  model?: string;
  signal: AbortSignal;
  /** Optional streaming hint: if a provider can stream a completion, call this per chunk. */
  onPartial?: (partialJson: string) => void;
}

export interface AdapterResult {
  /** Final accumulated text or JSON-string for completion callers. */
  text: string;
  /** For completion callers; `text` is the JSON-string in that case. */
  parsed?: unknown;
}

export interface AIProvider {
  readonly id: string;             // "puter" | "mock" | …
  /** Streaming chat: resolves to the final accumulated text on success. */
  stream(req: ChatRequest): Promise<string>;
  /** One-shot completion: resolves to the final text/JSON on success. */
  complete(req: CompletionRequest): Promise<AdapterResult>;
  /** Returns true if this provider is currently usable (signed-in, model loaded, etc.). */
  available(): Promise<boolean>;
}
```

**Why two methods, not one (owner note 1):** `generateQuiz` and the summarize paths are one-shot completions — calling `stream` and concatenating deltas would force every completion caller to know whether the underlying JSON is partial or final. The two-method shape keeps callers focused on intent; the `stream` method owns the first-token signal natively, and the `complete` method reports its own "first token" via the **first** call to `onPartial` (if supplied). For providers that cannot stream completions (most today), `onPartial` is omitted and `complete` resolves only at the end — the policy treats that as "first token at resolve time" (i.e. after the result is in, no fallback).

Contract guarantees (asserted by `contract.test.ts`, parametrized over adapters and over BOTH methods):

1. `stream` resolves to a string equal to the concatenation of `onDelta`-emitted texts (no silent drops, no duplicates).
2. `complete` resolves to `{ text }` (and `{ parsed }` when the provider parses JSON) — never throws on success.
3. Calling `abortController.abort()` **before** the first signal results in a `NormalizedError` with `kind: 'Cancelled'` (not `Unavailable`).
4. Calling `abortController.abort()` **after** the first signal also results in `Cancelled` and the partial text is returned to the caller (resolved value is the concatenated text emitted so far).
5. A 402-equivalent from the underlying SDK is normalized to `QuotaExceeded` (Puter only — see §3.4).
6. A 429-equivalent is normalized to `RateLimited` (**mock-only mapping** today; see §3.4).
7. Any thrown error not classified above is normalized to `Fatal`.

### 3.4 Error taxonomy and Puter mapping

`providers/errors.ts` exports:

```ts
export type NormalizedErrorKind = 'QuotaExceeded' | 'RateLimited' | 'Unavailable' | 'Fatal' | 'Cancelled';

export const classifyPuterError = (error: unknown, providerId: string): NormalizedError;
export const isNormalizedError = (e: unknown): e is NormalizedError;
export const isFallbackEligible = (kind: NormalizedErrorKind): boolean;
```

Puter mapping (preserves existing logic where it lives today):

| Today (in `errors.ts`/`assistant.ts`) | → `NormalizedErrorKind` |
|---|---|
| `isPuterInsufficientFundsError(e)` matches (`insufficient_funds`, `no usage left`, `payment required`, `insufficient balance`) | `QuotaExceeded` |
| **`RateLimited` mapping does NOT exist today** (owner note 4). There is no 429 classifier in `errors.ts`, no 429 path in `assistant.ts`, and no observed Puter 429 in the last 90 days of prod logs. Do NOT invent a Puter→`RateLimited` heuristic. | `RateLimited` **(mock-only)** |
| `isPuterTransportError(e)` OR message contains `5xx` / `503` / `server error` / `timeout` / `timed out` / `failed to fetch` / `network` / `socket.io` / `engine.io` / `websocket` (existing + 5xx added) | `Unavailable` |
| `AbortSignal` was triggered (any provider) | `Cancelled` |
| Anything else (auth, model-not-available, malformed shape, …) | `Fatal` |

**Why `RateLimited` exists in the taxonomy but not in Puter mapping (owner note 4):** the name is reserved in the contract so a future OpenAI/Anthropic adapter that DOES return a real 429 can map it cleanly. `PuterProvider` returns `Unavailable` for the hypothetical case where Puter starts returning 429 (defensive — same network symptoms). `MockProvider` is the only place `RateLimited` is actually produced today; the policy still routes it through the fallback ladder the same way as `QuotaExceeded | Unavailable`. This is documented in `contract.test.ts` (mock parametrization explicitly notes "Puter: never emits RateLimited").

The existing `errors.ts` classifiers stay (they are used by `circuit-breaker.ts`); `classifyPuterError` is a thin wrapper that adds the new `RateLimited` rule and wraps the result in `NormalizedError`. The 402 per-model gate at `assistant.ts:59-67` moves into `PuterProvider.available()` so the same logic still short-circuits before any network call.

**Abort-race regression (owner note 3):** today, abort during a stream chunk can race with `extractPuterChunkText` and surface as a transport-classified error → `notePuterTransportFailure` fires incorrectly. `PuterProvider.stream` MUST detect `signal.aborted` **before** classifying any thrown error as `Unavailable`. The check is at the top of every `catch` that could fire mid-stream, and **before** `notePuterTransportFailure` is called. Regression test: `providers/__tests__/abort-race.test.ts` injects a stubbed Puter SDK whose `chat` returns an async iterator that throws on the third `.next()` after `AbortSignal.abort()` fires — asserts the normalized kind is `Cancelled` (not `Unavailable`), and that the breaker-equivalent counter does NOT increment.

### 3.5 `MockProvider` (test-only)

```ts
// providers/mock-provider.ts
export type MockMode =
  | { kind: 'ok'; chunks: string[] }
  | { kind: 'fail-before-first-token'; error: NormalizedError }
  | { kind: 'fail-mid-stream'; failAfterChunks: number; error: NormalizedError }
  | { kind: 'slow'; delayMsPerChunk: number; chunks: string[] };

export interface MockProviderOptions {
  id?: string;          // default "mock"
  mode: MockMode;
  /** If true, available() returns false (used to simulate provider disabled). */
  unavailable?: boolean;
}

export const createMockProvider = (opts: MockProviderOptions): AIProvider;
```

**Production guard** (two layers, both verified by tests):

1. Build-time: `providers/mock-provider.ts` reads `process.env.NODE_ENV` at the top of the module and throws if called from a production build:
   ```ts
   if (process.env.NODE_ENV === 'production') {
     throw new Error('MockProvider must not be imported in production builds');
   }
   ```
2. Registry guard: `registry.ts` refuses to put a `MockProvider` in the list unless `process.env.NODE_ENV !== 'production'` AND a developer-only `NEXT_PUBLIC_AI_PROVIDER_DEBUG === 'mock'` env is set explicitly. Tests import `MockProvider` directly; the page never does.
3. Unit test `mock-provider.test.ts` includes a case that imports `createMockProvider` with `NODE_ENV === 'production'` (set via `vi.stubEnv`) and asserts the throw. Plus a case that asserts `getProvidersForMode` returns a list **without** the mock when `NEXT_PUBLIC_AI_PROVIDER_DEBUG !== 'mock'`.

### 3.6 Fallback policy

```ts
// providers/policy.ts
export interface RunWithFallbackOptions {
  prompt: string;
  mode: AiAssistantMode;
  model?: string;
  locale?: string;
  signal: AbortSignal;
  providers: AIProvider[];          // ordered; built once per session via registry
  onDelta: (fullText: string) => void;
  onDegraded: () => void;            // fires when list exhausted on fallback-eligible error
  onInterrupted: (partial: string) => void; // fires when first token already emitted, then error
}

export interface RunWithFallbackResult {
  text: string;
  providerId: string;
  /** True when the user's signal was aborted. */
  cancelled: boolean;
  /** True when the list was exhausted on a fallback-eligible error (degraded UI). */
  degraded: boolean;
  /** The kind of the terminal error if !text — undefined otherwise. */
  terminalKind?: NormalizedErrorKind;
}

export const runWithFallback = (opts: RunWithFallbackOptions): Promise<RunWithFallbackResult>;
```

Behavior:

1. For each provider in order, call `await provider.available()`. Skip providers that are unavailable.
2. Call `provider.stream(req)`. Inside, the first call to `onDelta` invokes `onFirstToken()` which sets an internal `locked` flag.
3. If the stream rejects with `QuotaExceeded | RateLimited | Unavailable` **and** `!locked` **and** there is a next provider, continue to the next provider. Do not call `notePuterTransportFailure` on a per-provider transport fail before the first token (the policy engine owns this — `PuterProvider` does not call into `circuit-breaker.ts` directly).
4. If `locked` is true and the stream rejects with anything other than `Cancelled`, call `onInterrupted(textSoFar)`, return `{ text: textSoFar, cancelled: false, degraded: false }`. Do not try another provider.
5. If the stream rejects with `Cancelled`, return `{ text: textSoFar, cancelled: true, degraded: false }` regardless of `locked`. Never trigger fallback.
6. If the stream rejects with `Fatal`, return `{ text: '', terminalKind: 'Fatal' }`. Never trigger fallback (preserves today: `canned.genericError`).
7. If the list is exhausted and every attempt was a fallback-eligible error, call `onDegraded()`, return `{ text: '', degraded: true }`. The page renders `canned.unavailable` (see §3.7).

`notePuterTransportFailure` from `circuit-breaker.ts` is called **only once per `runWithFallback` invocation**, **only on a pre-first-token Puter stream failure** that is `Unavailable`. The circuit-breaker's 45s window logic stays.

### 3.7 Degraded UI + i18n

New `canned.unavailable` key (replaces nothing yet; reconciles with `insufficientFunds` later in this spec):

- `packages/shared/src/messages/en/aiAssistant.json`:
  ```json
  "canned.unavailable": "Zane's AI features are unavailable right now. Existing materials, summaries, and question banks still work."
  ```
- `packages/shared/src/messages/ar/aiAssistant.json`:
  ```json
  "canned.unavailable": "ميزات Zane غير متاحة حالياً. المواد والملخصات وبنوك الأسئلة الموجودة تعمل كالمعتاد."
  ```

The wording is intentionally "AI features are unavailable / ميزات Zane غير متاحة" — not "Zane is unavailable" — because the AI features (summarize, quiz generation) are what stop working; stored content (materials, existing summaries, existing question banks) is unaffected. Owner note 6.

Update `CANNED_ERROR_PREFIXES` in `canned-messages.ts` if the new string starts with `⚠️` (preferred for consistency; the prefix contract is locked by `cannedErrorPrefixes.test.ts`). Suggested copy above does not start with `⚠️` — that is fine: `unavailable` is a banner, not a transient reply.

Reconciliation rule (locked by a unit test):

- When the policy returns `{ degraded: true }`, the **assistant bubble** for that turn is set to `canned.unavailable` and `useAiChat` raises a `degraded: true` flag the page consumes.
- When the policy returns `{ degraded: false, terminalKind: 'QuotaExceeded' }` (Puter 402 from the only configured provider, today), the bubble is `canned.insufficientFunds`. The **degraded banner is NOT shown** — the 402 message is the user-facing reply.
- The two never render together.

**Degraded state on every AI surface (owner note 5):** the chat is not the only AI surface. The same `canned.unavailable` banner must render when ANY of the AI features is in a degraded state. Surfaces and rendering:

| Surface | Render location | State source |
|---|---|---|
| Chat (`/[locale]/ai-assistant`) | Banner above the composer when `degraded === true`. Also: last assistant bubble is `canned.unavailable`. | `useAiChat.degraded` |
| AI-assistant summarize buttons (same page) | Same banner — the summarize call goes through the same `aiAssistant.*` entry. | `useAiChat.degraded` |
| Quiz import (`useQuizImport`) | Inline error toast via `toast.error` with `canned.unavailable` (no banner — modal context). Existing toast infra. | New `useQuizImport.degraded` (set on `degraded === true` for any summarize/quiz call) |
| Quick quiz modal (`QuickQuizFromTextModal`) | Same inline error toast pattern. | New `useQuickQuiz.degraded` |
| Quiz Play (`/quiz-play/...`) | Not affected — Play reads the stored quiz JSON, not AI. | n/a |

The chat's banner is the single visible signal for the whole AI surface. Non-chat callers surface `canned.unavailable` via the existing toast pattern (already used by `useQuizImport` for `aiError`). The text is the same in all four locations; the i18n key is the source of truth.

The `useAiChat` hook gains:

```ts
const [degraded, setDegraded] = useState(false);
```

Set to `true` only on `{ degraded: true }`. Reset on next successful first-token.

`useQuizImport` and `QuickQuizFromTextModal` add the same `degraded` state in their respective hooks (or in the modal itself — owner-decides during polish round 1). The `aiAssistant` wrapper exports a `lastResultDegraded: boolean` that any caller can read; the simplest implementation is to keep the flag on the `AiAssistant` class itself (singleton), reset on next successful first-token, and read via a getter.

The page renders a single localized banner above the composer (or inline above the messages, owner-decides during polish round 1) **only** when `degraded === true`. The banner uses `canned.unavailable` plus a "Retry" action that calls `sendMessage` again. RTL parity: banner wraps in the chat's existing direction-aware container, no new layout rules.

### 3.8 `PuterProvider` adapter

`puter-provider.ts` owns the six call sites listed in §1's call-site table. Behavior preservation:

- The per-model 402 gate at `assistant.ts:59-67` moves here as `available()`: returns `false` when the requested model matches `puterFundsDepletedModel`. Reset semantics: clear on any successful first-token in `stream()` or `complete()`.
- The model resolution (`resolvePuterModel`, `isClaudeLikeModel`, `assertPuterSignedIn`) stays in `puter-client.ts`; `PuterProvider` imports them.
- Streaming + `extractPuterChunkText` stays; `PuterProvider.stream` is the only streaming caller now.
- One-shot completion: `PuterProvider.complete` calls `puter.ai.chat(prompt, { model, stream: false })` (today's call sites already pass `stream: false` or omit it). The result goes through `extractPuterChatText` → JSON.parse (when the caller expects JSON, signaled via `req.mode`) → `AdapterResult`.
- The server-side fallback route at `assistant.ts:110-167` is **NOT** moved into a provider. The route is gated by `AI_GATEWAY_API_KEY` which is unconfigured today (spec 012 §7); moving it would create a dormant provider. Decision: server fallback stays as a separate concern, called only when no provider succeeds and the page opts in via a future spec. (Recorded here so reviewers see the deliberate choice.)
- `withPuterRetry`, `withTimeout`, `notePuterTransportFailure` are still called by `PuterProvider` — but **only on pre-first-token failures** (§3.2 layering rule). After the first token, any failure is wrapped in `NormalizedError` and surfaced to the policy as "first-token already emitted → interrupted".
- The abort-race regression is enforced here (§3.4): the abort check is at the top of every catch in `stream` and `complete`.

### 3.9 Post-first-token failure UX (distinct from degraded banner — owner check 3)

When `runWithFallback` returns `{ text: <partial>, cancelled: false, degraded: false, providerId }` because the stream failed **after** the first token (case §3.6 rule 4 fires), the chat UI MUST do the following. This is intentionally distinct from the degraded banner — the message still has user-readable content; we are not signaling "AI is down", we are signaling "this specific reply was interrupted".

| UI element | Behavior |
|---|---|
| **The assistant bubble** | Rendered with the partial text accumulated so far (`<partial>`). NOT replaced by `canned.unavailable` or `canned.genericError` — the user sees what the model produced. |
| **Inline interrupted affordance** | A small `⚠ Interrupted` chip below the bubble (owner-decide copy in polish round 1), with `dir` matching the bubble's direction. The chip is always rendered when the last assistant message has the interrupted marker; it is NOT a hover affordance (per round-12 spec 012 §C lesson: reserved `h-8` row under the message, no height animation). |
| **Inline retry button** | The same `h-8` action row gains a "Retry" button. Clicking it re-invokes `sendMessage` with the same user prompt and mode. The new attempt is a fresh `runWithFallback` call — no special "resume" semantics. |
| **Banner state** | `degraded === false` (the partial was produced successfully; only one provider failed mid-stream). The `<DegradedBanner>` is NOT rendered. |
| **Persisted message state** | The interrupted message is finalized exactly as today — whatever the current code persists for a partial message continues to happen (see §4 behavior preservation). No new column, no new field on the persisted row. **No schema change in this spec.** If reload-persistence of the `interrupted` chip is desirable later, it goes in a separate spec with its own migration. |
| **Telemetry** | Existing `logger.warn` calls (in `circuit-breaker.ts`, `puter-client.ts`) stay as-is. No new logger calls, no analytics, no new dependencies. The interrupted state itself is rendered from the in-memory message object only — there is no separate logging path for it. |

This UX is intentionally separate from the three other terminal states because each one carries a different meaning:

| Terminal state | Bubble | Banner | Retry affordance | User intent |
|---|---|---|---|---|
| Success | Full reply | hidden | (standard) | n/a |
| Interrupted (mid-stream fail) | Partial text + `⚠ Interrupted` chip | hidden | Inline "Retry" button on the message | Resume the same question |
| QuotaExceeded (insufficient funds) | `canned.insufficientFunds` | hidden | (standard message-level retry) | Switch model or top up |
| Fatal | `canned.genericError` | hidden | (standard message-level retry) | Diagnose auth/model problem |
| Degraded (list exhausted) | `canned.unavailable` | shown above composer | Banner-level "Retry" | Different provider, retry whole session |
| Cancelled (user abort) | Empty (no bubble) | hidden | (no retry — user explicitly cancelled) | Resend manually if desired |

The interrupted state is the **only** one that shows inline interrupted affordance; the degraded banner is **only** for list-exhausted. A single test asserts both paths cannot both render: `policy.test.ts` "Provider A emits first token then fails Unavailable" asserts `{ degraded: false }` and `policy.test.ts` "All Unavailable → degraded" asserts `{ degraded: true }`. The component test in `useAiChat.test.ts` (new) asserts that when both `interrupted` (last-message flag) and `degraded === true` (banner state) would be true simultaneously, the banner wins for the banner slot and the interrupted chip wins for the message slot — they do not visually conflict.

**Scope guard (binding — owner check):** the interrupted affordance is **client-side/in-memory UI state only**. The current persistence behavior (whatever `useAiChat.ts` and `ai_chat_messages` save today for a partial message) is preserved verbatim per §4; this spec introduces **no** new column, no new field, no migration, and no Row type change. If reload-persistence of the `interrupted` chip becomes desirable in the future, it goes in a separate spec with its own migration and explicit owner approval — see §8.

## 4. Behavior preservation & regression strategy

When Puter works, Zane must behave exactly as today:

- **Streaming**: same rAF-throttled `onDelta` pipeline; `LazyMarkdown` module-scope wrapper unchanged.
- **Abort**: same `AbortController` flow; new contract is that `Cancelled` is explicit and never triggers degraded UI.
- **Memoization / bidi / RTL**: untouched.
- **402 gate semantics**: same per-model short-circuit, same clear-on-success.
- **Circuit breaker**: still opens 45s after 2 transport failures in 60s, still surfaces `canned.puterUnavailable` (via `PuterProvider.stream`'s `Unavailable` mapping → policy → caller).
- **`canned.insufficientFunds` path**: preserved when only Puter is configured.
- **`canned.genericError` path**: preserved for `Fatal` errors (auth, model-not-available, malformed shape).
- **Server fallback (`tryServerSideFallback`)**: kept as-is at `assistant.ts`; not promoted to a provider yet.
- **Existing Zane tests**: all **89** vitest cases across 11 files in `apps/web/src/lib/__tests__/` and `apps/web/src/lib/ai/__tests__/` (the spec 011 + 012 baselines; measured against parent commit `036eded`) must pass unchanged in the commit that introduces `PuterProvider` and rewires `assistant.ts`. **This is the load-bearing gate**: the abstraction is correct iff no behavior test had to change. Update: the original "81" count in this spec was stale; the actual baseline measured at parent `036eded` is **11 files / 89 tests**, and after Commit 2 (providers/ added) it is **13 files / 126 tests**, so Commit 2 contributed **+2 files / +37 tests**. Future commits (3, 4) must keep the 89 baseline green and add only new tests in their own files.

Regression proof strategy (per commit, per `08-precommit.md`):

- `pnpm typecheck` clean across all 4 projects.
- `pnpm --filter web lint` — warnings ≤ 52 (current ratchet).
- `pnpm --filter web test` — vitest baseline **89 (parent `036eded`, 11 files)** + new tests in `providers/__tests__/`, all green.
- `pnpm --filter web test:e2e` — at 1 worker (current baseline), no new skipped tests.
- Owner smoke checklist (added in this spec under `checklists/verification.md`): forced 402 (mock env), `canned.unavailable` rendered, materials / summaries / question banks still navigable; forced `Cancelled` does NOT render the banner.

## 5. Test specification

### 5.1 Unit tests (`providers/__tests__/`)

`errors.test.ts` — `classifyPuterError`:

- `insufficient_funds` message → `QuotaExceeded`.
- `no usage left` message → `QuotaExceeded`.
- `payment required` message → `QuotaExceeded`.
- `insufficient balance` message → `QuotaExceeded`.
- `429` / `rate limit` / `too many requests` → `RateLimited` (mock-only emission today; see §3.4).
- `socket.io connection error` → `Unavailable`.
- `failed to fetch` → `Unavailable`.
- `Request timed out` (existing `withTimeout`) → `Unavailable`.
- `model does not exist` (existing `isPuterModelNotAvailableError`) → `Fatal`.
- `not signed in` / `unauthorized` / `auth` (existing `isPuterAuthError`) → `Fatal`.
- Anything unclassified (e.g. `Error("nonsense")`) → `Fatal`.
- `cause` field is preserved.
- `providerId` is set from argument.
- `instanceof Error` is true (so existing `error instanceof Error` checks keep working).
- `isFallbackEligible('QuotaExceeded') === true`, `isFallbackEligible('RateLimited') === true`, `isFallbackEligible('Unavailable') === true`, `isFallbackEligible('Fatal') === false`, `isFallbackEligible('Cancelled') === false`.

`policy.test.ts` — `runWithFallback` (MockProvider only):

- One `ok` provider → resolves to text, `degraded: false`, `cancelled: false`, `providerId === provider.id`.
- Provider A fails `Unavailable` before first token, provider B `ok` → uses B; `notePuterTransportFailure`-equivalent is called once (verified via injected hook), no banner.
- Provider A fails `QuotaExceeded` before first token, provider B `ok` → uses B; **no** `notePuterTransportFailure` call (Quota is billing, not transport).
- Provider A fails `Unavailable` before first token, provider B also fails `Unavailable` before first token → `{ degraded: true }`, `onDegraded` called exactly once, no bubble text returned.
- Provider A emits first token then fails `Unavailable` → `{ text: <partial> }`, `onInterrupted` called, NO attempt of provider B.
- Provider A emits first token then `Cancelled` (signal abort) → `{ cancelled: true, text: <partial> }`, NO banner, NO `onInterrupted` (Cancelled is not an interruption to the user; the page renders it as the user's own action).
- Provider A throws `Fatal` → `{ terminalKind: 'Fatal' }`, NO attempt of provider B, NO banner.
- Empty providers array → `{ degraded: true, terminalKind: undefined }` and `onDegraded` called.
- All providers `available()` returns false → `{ degraded: true }`, `onDegraded` called.
- **Completion path**: `runWithFallback` invoked with a completion request (no streaming hint) → same fallback ladder applies, terminal `{ degraded: true }` works the same way.

`mock-provider.test.ts`:

- `ok` mode with `chunks: ["a","b","c"]` emits 3 deltas, `stream` resolves to `"abc"`.
- `fail-before-first-token` rejects with the supplied error BEFORE any delta; contract test will assert the policy uses this correctly.
- `fail-mid-stream` with `failAfterChunks: 2` emits `"a"`, `"ab"` then rejects; policy test asserts `onInterrupted` is called with `"ab"`.
- `slow` mode: `onDelta` is called after `delayMsPerChunk` ms per chunk; abort during a slow chunk produces `Cancelled` (verified by injecting a fake scheduler).
- **Completion mode**: `ok` mode with `completion: { json: '{"title":"…","questions":[…]}' }` → `complete` resolves to `{ text: '{"title":"…","questions":[…]}', parsed: <object> }`; the policy's "first token at resolve time" semantics is verified by a follow-up contract case.
- Production guard test (see §3.5): `createMockProvider` with `vi.stubEnv('NODE_ENV', 'production')` throws on call.
- Registry guard test: with `NEXT_PUBLIC_AI_PROVIDER_DEBUG !== 'mock'`, `getProvidersForMode` returns a list whose `id`s never include `"mock"`.

`puter-provider.test.ts`:

- Mocks `@/lib/puter` and `puter-client.ts`. Asserts:
  - `available()` returns `false` when `puterFundsDepletedModel` matches (simulated via exported setter for tests).
  - `available()` returns `true` after a successful stream clears the gate.
  - Stream emits deltas via `extractPuterChunkText` (regression).
  - `complete` returns `AdapterResult` for a JSON-returning Puter response; `parsed` is the JSON-parsed object.
  - 402 error path produces a `NormalizedError` with `kind: 'QuotaExceeded'`; policy tests cover the cross-adapter fallback.
  - Breaker state is per-provider: two PuterProvider instances have independent breaker windows (the breaker is NOT a module-scope `let` anymore).

**5xx matching test reconciliation (Commit 2.5 ledger, measured):** `errors.test.ts` went from 27 tests (parent `27cc65c`, Commit 2) to **40 tests** (current `HEAD` after Commit 2.5). Net **+13** (1 test removed, **14 added**). Exact delta:

- **Removed**: `5xx / server error → Unavailable` (replaced by the typed-status form below)
- **Added — Positive → `Unavailable` (9)**:
  - `server error → Unavailable`
  - `service unavailable → Unavailable`
  - `bad gateway → Unavailable`
  - `gateway timeout → Unavailable`
  - `error.status = 503 → Unavailable (typed status, not regex)`
  - `error.statusCode = 503 → Unavailable`
  - `"HTTP 503" phrase → Unavailable`
  - `"status 503" phrase → Unavailable`
  - `"status code 503" phrase → Unavailable`
- **Added — Negative → `Fatal` (5): regression guards that bare numeric codes inside messages do NOT match the 5xx rule:
  - `"context length 512 exceeded" → Fatal (NOT Unavailable)`
  - `"limit of 500 tokens" → Fatal (NOT Unavailable)`
  - `"batch size 256" → Fatal (NOT Unavailable)`
  - `error.status = 200 → Fatal (NOT Unavailable; only 5xx counts)`
  - `error.status = 404 → Fatal (NOT Unavailable; only 5xx counts)`

`puterFundsDepletedModel` short-circuit (owner check 2 — AC21):**

- Set `puterFundsDepletedModel = 'gpt-5-nano'` via the exported test setter.
- Call `PuterProvider.stream({ ..., model: 'gpt-5-nano', ... })` and `PuterProvider.complete({ ..., model: 'gpt-5-nano', ... })`.
- Assert: the underlying SDK (`puter.ai.chat`) is **never called** (zero network calls — verified by spying on the SDK and asserting `mock.calls.length === 0`).
- Assert: the resolved promise is a `NormalizedError` with `kind: 'QuotaExceeded'`, `providerId: 'puter'`, `cause` undefined.
- Assert: `available()` for that model returns `false` synchronously (no `await` on SDK).
- Set `puterFundsDepletedModel = null` via the setter; run the same call with `model: 'gpt-5-nano'`; assert the SDK **is** called this time (regression — the gate cleared).
- "Behavior preserved" variant: simulate a successful stream with model `'gpt-5-nano'` (gate cleared on success) — assert that the next call with the same model uses the SDK and clears the flag implicitly.

`abort-race.test.ts` (owner note 3 — regression for the spec-011 race):

- Stub Puter SDK returns an async iterator that resolves twice, then the third `.next()` rejects with a transport-classified error (`"socket.io connection error"`) AFTER the test has called `AbortController.abort()`.
- Assert the normalized kind is `Cancelled`, NOT `Unavailable`.
- Assert the breaker-equivalent counter does NOT increment.
- Assert the resolved text is the partial concatenation of the two emitted deltas.
- Repeat for `complete` (stub returns a promise that rejects after `AbortController.abort()` fires mid-flight): normalized kind is `Cancelled`, breaker does NOT increment.

### 5.2 Contract suite (`providers/__tests__/contract.test.ts`)

One file parametrized over `[createPuterProviderForTest, createMockProviderForTest]` × `[stream, complete]` (4 cells per assertion). For each adapter and each method:

1. Resolves to the expected shape (`string` for `stream`, `{ text, parsed? }` for `complete`) with no silent drops or duplicates.
2. Abort before the first signal → `Cancelled`, no deltas emitted.
3. Abort after the first signal → `Cancelled`, partial text returned.
4. A 402-equivalent from the underlying SDK is normalized to `QuotaExceeded` (Puter only; mock injects directly).
5. A 429-equivalent is normalized to `RateLimited` (**mock-only** — the Puter parametrization notes "Puter: never emits RateLimited" and verifies the contract is honored by mocking the SDK to throw a transport-classified error, NOT 429).
6. Unknown thrown → `Fatal`.

This is the single source of truth that the Puter adapter and the Mock adapter honor the same contract. No Puter network is hit — Puter adapter uses the same `MockMode`-style seam (the SDK seam already exists at `puter.ts`).

### 5.3 i18n / component tests

- `canned.unavailable` exists in ar + en; matches the exact wording in §3.7. RTL/LTR rendering test on the page banner (RTL test mirrors `ChatMessageItem.tsx`'s existing RTL discipline — `dir` attribute probe, not screenshot).
- `canned.insufficientFunds` still starts with `💳` (existing prefix contract in `cannedErrorPrefixes.test.ts`).
- `canned.unavailable` does NOT start with `⚠️` or `💳` (banner, not a transient reply).
- `canned.unavailable` is reachable from the shared messages module via `cannedMessagesFor(locale).unavailable` (test in `cannedErrorPrefixes.test.ts` extension or a new sibling test).

### 5.4 E2E (Playwright, MockProvider via `NEXT_PUBLIC_AI_PROVIDER_DEBUG=mock`)

New e2e file `e2e/zane-degraded.spec.ts`:

- **Chat (AC7, AC12)**: forced 402 (mock configured `fail-before-first-token` with `kind: 'QuotaExceeded'`) → page shows `canned.unavailable` banner, the last assistant bubble is the banner's text (NOT `canned.insufficientFunds`), and the user can navigate to `/ar/materials`, `/ar/summaries`, `/ar/quizzes` from the chat page header without errors.
- **Chat forced Cancelled (AC2)**: mock configured to abort on signal mid-stream after one chunk → message is marked interrupted, **NO banner** is shown, user can send a new message.
- **Chat forced Fatal (AC9)**: mock throws a non-classified error → bubble shows `canned.genericError`, NO banner.
- **AI-assistant summarize button (AC14)**: navigate to `/ar/ai-assistant`, click "Summarize" button while mock is configured `fail-before-first-token` → summarize toast/banner shows `canned.unavailable` text, navigation still works.
- **Quiz import (AC15)**: navigate to a quiz import route (e.g. `/ar/quizzes/new`), trigger the AI import path while mock is configured `fail-before-first-token` → toast shows `canned.unavailable` text.
- **Quick quiz modal (AC16)**: open the chat's QuickQuizFromTextModal, submit while mock is configured `fail-before-first-token` → modal shows `canned.unavailable` inline error.
- **Insufficient funds reconciliation (AC8)**: mock configured `ok` but Puter gate forces 402 on the only configured provider → bubble is `canned.insufficientFunds`, banner is NOT shown.
- **Interrupted UX (AC22)**: mock configured `fail-mid-stream` (chunks: `["hello","world"]`, then transport-classified error on the third chunk) → last assistant bubble shows partial text `"helloworld"`, the `⚠ Interrupted` chip is rendered in the message action row, the inline "Retry" button is present, the degraded banner is NOT shown, and navigating to `/ar/materials` works without interruption.

No new skipped tests. If a test cannot run on the current sandbox (e.g. mobile-only viewport), link the GitHub issue in the `test.skip` reason (existing `e2e` convention from spec 010).

## 6. Atomic execution plan

Every commit must pass: `pnpm typecheck && pnpm --filter web lint` (≤52) `&& pnpm --filter web test && pnpm --filter web test:e2e` (1 worker baseline).

| # | Conventional commit | Files | Behavior change? |
|---|---|---|---|
| 1 | `docs(ai): add specs/017 zane provider abstraction + graceful degradation` | `specs/017_zane_provider_abstraction/spec.md`, `tasks.md` | No |
| 2 | `feat(ai): add AIProvider interface, error taxonomy, MockProvider (test-only, production-guarded)` | `providers/{types,errors,mock-provider}.ts`, `providers/__tests__/{errors,mock-provider}.test.ts` | No (unused yet) |
| 3 | `feat(ai): add PuterProvider adapter; rewire assistant.ts through runWithFallback (behavior preserved)` | `providers/{puter-provider,policy,registry}.ts`, `providers/__tests__/{policy,puter-provider,abort-race,contract}.test.ts`, new `useAiChat.test.ts`, edits in `assistant.ts`, `useAiChat.ts`, `useQuizImport.ts`, `QuickQuizFromTextModal.tsx`, `ai-assistant.ts` | **No** (existing 89 vitest cases across 11 files pass unchanged, per the corrected AC11 measurement) |
| 4 | `feat(ai): degraded state UI + interrupted affordance + ar/en canned.unavailable + reconciliation with insufficientFunds` | `apps/web/src/app/[locale]/ai-assistant/page.tsx`, new `DegradedBanner.tsx`, `InterruptedChip.tsx`, `packages/shared/src/messages/{ar,en}/aiAssistant.json`, edits in `useAiChat.ts`, `ChatMessageItem.tsx` (action row update only) | **Yes** (banner + interrupted chip visible on specific terminal states) |
| 5 | `test(ai): e2e for forced 402, cancelled, interrupted, and fatal paths (mock provider)` | `e2e/zane-degraded.spec.ts`, env docs in `docs/agents/references/00-setup.md` | No (tests only) |
| 6 | `docs(ai): record specs/017 execution ledger` | `specs/017_zane_provider_abstraction/tasks.md` | No |

Commit 3 is the load-bearing one. If the 89 vitest cases do not pass unchanged, the abstraction broke behavior and the commit is rejected (per `08-precommit.md` §"Behavior preservation"). **Commit 3 contains no schema change, no migration, no `database.ts` edit** — the interrupted state is client-side/in-memory per §3.9 and AC22. The persistence behavior for partial messages continues exactly as today (whatever `useAiChat.ts` and `ai_chat_messages` save today).

## 7. Acceptance criteria → test mapping

Each acceptance criterion below MUST be asserted by a named, committed test. The mapping is the spec's contract.

| # | Acceptance criterion | Asserted by |
|---|---|---|
| AC1 | `AIProvider.stream` resolves to the concatenation of `onDelta` texts for every adapter | `contract.test.ts` case 1 |
| AC2 | `Cancelled` (signal abort) never triggers the degraded UI and never attempts a fallback provider | `policy.test.ts` "Provider A emits first token then Cancelled" + "Provider A fails before first token with Cancelled" |
| AC3 | `QuotaExceeded` before first token falls over to the next provider; no `notePuterTransportFailure` call | `policy.test.ts` "Provider A fails QuotaExceeded → uses B" |
| AC4 | `Unavailable` before first token falls over AND opens the circuit breaker (per-call, pre-first-token only, per-provider state) | `policy.test.ts` "Provider A fails Unavailable → uses B" + `puter-provider.test.ts` "breaker state is per-provider" |
| AC5 | After first token, no fallback; partial text is preserved and `onInterrupted` fires | `policy.test.ts` "Provider A emits first token then fails Unavailable" |
| AC6 | List exhausted on fallback-eligible errors → degraded state with `canned.unavailable` | `policy.test.ts` "All Unavailable → degraded" + `e2e/zane-degraded.spec.ts` "Chat forced 402" |
| AC7 | The degraded banner reads `canned.unavailable` in ar and en (RTL/LTR correct) | `e2e/zane-degraded.spec.ts` "Chat (AC7) banner shown in ar" + "...in en"; i18n key assertion in unit test |
| AC8 | `canned.insufficientFunds` is still shown when only Puter is configured and Puter returns 402 — banner is NOT shown simultaneously | `policy.test.ts` "Provider A 402 only → insufficientFunds, no banner" + e2e "Insufficient funds reconciliation" |
| AC9 | `Fatal` returns `canned.genericError` and does NOT trigger fallback or the banner | `policy.test.ts` "Provider A throws Fatal" + e2e "Chat forced Fatal" |
| AC10 | `MockProvider` cannot be enabled in a production build | `mock-provider.test.ts` "production guard" + "registry guard" |
| AC11 | All **89** existing Zane vitest cases across **11 files** pass unchanged in commit 3 (baseline measured at parent `036eded`) | `pnpm --filter web test` baseline gate |
| AC12 | The rest of the app remains navigable while degraded (materials / summaries / question banks) | `e2e/zane-degraded.spec.ts` "Chat (AC12) navigation still works" |
| AC13 | No new skipped e2e tests; any skip links the GitHub issue | CI gate (e2e run report) + spec 010 convention |
| AC14 | **Owner note 3**: Abort during a stream chunk is normalized to `Cancelled`, NOT `Unavailable`, and the breaker-equivalent counter does NOT increment | `abort-race.test.ts` (regression) |
| AC15 | **Owner note 5**: AI-assistant summarize (same `aiAssistant.*` entry) shows `canned.unavailable` in the same banner / toast when degraded | `e2e/zane-degraded.spec.ts` "AI-assistant summarize button" |
| AC16 | **Owner note 5**: Quiz import (`useQuizImport`) shows `canned.unavailable` in its existing toast infra when degraded | `e2e/zane-degraded.spec.ts` "Quiz import" |
| AC17 | **Owner note 5**: Quick quiz modal (`QuickQuizFromTextModal`) shows `canned.unavailable` inline when degraded | `e2e/zane-degraded.spec.ts` "Quick quiz modal" |
| AC18 | **Owner note 1**: `complete` (one-shot completion) honors the same contract as `stream`: `Cancelled` on abort, `QuotaExceeded` on 402, `Fatal` on unknown | `contract.test.ts` parametrized over `[stream, complete]` × `[puter, mock]` |
| AC19 | **Owner note 4**: Puter adapter never emits `RateLimited` (the mapping does not exist); the taxonomy name is reserved for future adapters | `errors.test.ts` "Puter mapping has no RateLimited rule" + `contract.test.ts` Puter cell notes |
| AC20 | **Owner note 2**: retry/timeout/breaker live inside `PuterProvider`; the policy does not call `withPuterRetry` or `withTimeout` directly | `puter-provider.test.ts` "retry is per-provider" + `policy.test.ts` "policy does not import retry/timeout" |
| AC21 | **Owner check 2**: When `puterFundsDepletedModel` is set for a model, `PuterProvider` short-circuits with `QuotaExceeded` and zero SDK calls (`stream` AND `complete`); the flag clears on the next successful call | `puter-provider.test.ts` "puterFundsDepletedModel short-circuit (stream)" + "...(complete)" + "...(gate cleared on success)" |
| AC22 | **Owner check 3**: Mid-stream failure shows the partial text, an inline `⚠ Interrupted` chip, an inline Retry button, NO degraded banner; **client-side/in-memory state only** (no schema change, no new column, no new field) — the existing persistence behavior for partial messages continues verbatim | `useAiChat.test.ts` "interrupted message renders chip + retry" + e2e "Interrupted UX (AC22)" |

## 8. Out of scope (explicit, do NOT build — owner check 4)

The following items are **explicitly out of scope** for this spec. No files, env vars, package deps, type stubs, or interface extensions are to be added for them. They are listed here so contributors and reviewers can recognize "scope creep" early.

| Out of scope | Why | Future spec / mechanism |
|---|---|---|
| **BYOK (Bring Your Own Key)** for Puter | Open question — owner hasn't decided whether BYOK goes in Zane or in a separate "AI keys" surface. Adding it now would lock the design. | New spec, owner-decide |
| **Server-route / AI Gateway adapter** (gated by `AI_GATEWAY_API_KEY` in `.env.example`) | Route exists at `apps/web/src/app/api/ai/chat/route.ts` but the env key is unconfigured today (spec 012 §7 deferred). Promoting it to a provider would create a dormant adapter. | New spec, after the key is provisioned |
| **OpenAI-compatible adapter** | No current use case; adding an `OpenAIProvider` would require an env var (e.g. `OPENAI_API_KEY`) and that is explicitly NOT to be added. | New spec, owner-decide |
| **Ollama / local model adapter** | No current deployment target; would require local-runtime assumptions (CORS, model download, etc.). | New spec, owner-decide |
| **Quotas / rate limits for paid fallback providers** | Per-provider quota tracking requires a stable billing surface that does not exist yet. | New spec, after first paid provider is added |
| **Visual regression / screenshot diff for the degraded UI** | The Playwright suite covers functionality; visual diff would require baseline screenshots that don't exist in this scope. | Revisit in a later spec if owner requests |
| **Onboarding / OSS contributor docs** | This spec is implementation only; contributor-facing docs are deferred until the abstractions stabilize across more providers. | `docs/contributing/*` later |
| **Telemetry beyond `logger.warn`** for fallback / degraded events | No telemetry pipeline exists yet; `logger.warn` is the only signal until a post-MVP telemetry spec lands. | Post-MVP |

**Hard scope rule (binding — owner check 4):** the diff for this spec adds **zero** env vars and **zero** new package deps for any of the items above. The only new dep, if any, would be inside `apps/web/package.json` and only for the test infrastructure of the new modules themselves (no external service). The reviewer must reject any commit that introduces an env var, a stub type, or a package install for an out-of-scope item.

## 9. Process rules (binding)

- **Maximum 3 polish rounds** after commit 6. After that, close the spec (`Status: closed`) and open a new spec for any remainder. Do not keep evolving this one.
- **Verification is only valid if backed by a committed test or a CI run.** Manual probes may be recorded in `checklists/verification.md` for the owner's smoke pass, but they do not count as AC proof.
- **No `apps/desktop/**` edits.** Zane lives in `apps/web/src/lib/ai/` only; desktop has no Puter calls. If any cross-cutting IPC change is needed (it shouldn't be), stop and report to the owner before editing.
- **No destructive git ops on a dirty tree** (AGENTS.md I8). The `specs/015_*` untracked files must remain untouched (spec 016 §"Git safety protocol").
- **E2E baseline (measured 2026-09-24)**: `apps/web/e2e/` against the current `apps/web/src` working tree on `apps/web`'s playwright config: 8 specs, 7 pass, 1 is `test.skip(!PROD_URL, ...)` in `prod-smoke.spec.ts` (opt-in flag, pre-existing). Spec 017 Commit 5 adds `e2e/zane-degraded.spec.ts` (9 cases); commits 3–4 must NOT add to this skip count. `git log --diff-filter=D -- apps/web/e2e` shows zero deleted e2e specs in the working repo (no historical reconstruction needed).
- **One concern per commit** (per `08-precommit.md`).
- **Conventional commit messages** with `ai` scope.
- **Lint ratchet 52** holds — never increase.
- If anything in AGENTS.md or spec 016 conflicts with this prompt, **stop and ask** before proceeding.

## 10. Final report (binding output shape)

After commit 6, the implementer must report:

- Files changed per commit (path → lines added / removed).
- Gate results: `typecheck` ✓, `lint` warnings count, `vitest` total passed / new, `e2e` passed / skipped.
- Acceptance criteria → test mapping (table copy of §7 with PASS / FAIL columns).
- Anything not verified, with the reason.
- Findings about `apps/desktop/**` or the IPC contract that need the Desktop agent (expected: none).
