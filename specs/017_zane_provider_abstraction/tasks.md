# Spec 017 — Tasks: Zane AI provider abstraction + graceful degradation

> **Hard rule (binding):** Maximum 3 polish rounds after the main implementation. After that, close the spec and open a new one for any remainder.
>
> **Per-commit gates (blocking):** `pnpm typecheck && pnpm --filter web lint` (≤52 ratchet) `&& pnpm --filter web test && pnpm --filter web test:e2e` (1 worker baseline).
>
> **Behavior preservation (AC11):** the 81 existing vitest cases in `apps/web/src/lib/__tests__/` + `apps/web/src/lib/ai/__tests__/` MUST pass unchanged in commit 3 (the abstraction wiring). If they regress, commit 3 is rejected.

## 1. Spec landing

- [x] 1.1 `specs/017_zane_provider_abstraction/spec.md` + `tasks.md` written before any code (this commit).

## 2. Commit 1 — `docs(ai): add specs/017 zane provider abstraction + graceful degradation`

- [x] 2.1 `specs/017_zane_provider_abstraction/spec.md` (31980 bytes, verified) and `tasks.md` (this file) committed.
- [x] 2.2 Spec covers Context, Scope, Architecture, Behavior preservation, Test spec, Atomic execution plan, Acceptance criteria → test mapping, Out of scope, Process rules, Final report — mirrors spec 011/012/016 format.
- [x] 2.3 Discovery notes recorded (six Puter call sites, taxonomy mapping, no `apps/desktop/**` Puter usage — Desktop untouched).

## 3. Commit 2 — `feat(ai): add AIProvider interface, error taxonomy, MockProvider (test-only, production-guarded)`

- [ ] 3.1 `apps/web/src/lib/ai/providers/types.ts` — `AIProvider`, `ChatRequest`, `CompletionRequest`, `AdapterResult`, `ChatChunk`, `NormalizedError`, `NormalizedErrorKind` (5 names exactly), `RunWithFallbackOptions`, `RunWithFallbackResult`, `MockMode` (streaming AND completion variants).
- [ ] 3.2 `apps/web/src/lib/ai/providers/errors.ts` — `classifyPuterError`, `isNormalizedError`, `isFallbackEligible`. Re-uses the existing classifiers in `errors.ts` for `QuotaExceeded`, `Unavailable`, `Fatal`. **Does NOT add a Puter-side RateLimited mapping** (owner note 4 — `RateLimited` is reserved in the taxonomy for future adapters; mock-only emission today).
- [ ] 3.3 `apps/web/src/lib/ai/providers/mock-provider.ts` — `createMockProvider(opts)`. Production guard at module top: throws if `NODE_ENV === 'production'`. Mock modes: `ok` / `fail-before-first-token` / `fail-mid-stream` / `slow`, **each with a completion-path variant**.
- [ ] 3.4 `apps/web/src/lib/ai/providers/__tests__/errors.test.ts` — Puter mapping cases (10+), `cause` preserved, `providerId` set, `instanceof Error` true, `isFallbackEligible` truth table, "Puter has no RateLimited rule" assertion.
- [ ] 3.5 `apps/web/src/lib/ai/providers/__tests__/mock-provider.test.ts` — all four modes (streaming + completion), production guard (`vi.stubEnv('NODE_ENV', 'production')` → throws), slow mode + abort → `Cancelled`.
- [ ] 3.6 **Behavior change: NO.** Module is not imported by `assistant.ts` yet; nothing in the app changes.
- [ ] 3.7 Gates: typecheck ✓, lint ≤52, vitest green, e2e green.

## 4. Commit 3 — `feat(ai): add PuterProvider adapter; rewire assistant.ts through runWithFallback (behavior preserved)`

This is the load-bearing commit. **AC11 + AC14 + AC18 + AC20 + AC21 are enforced here.**

- [ ] 4.1 `apps/web/src/lib/ai/providers/puter-provider.ts` — wraps the six Puter call sites listed in spec §1. Owns the per-model 402 gate (`available()`), `extractPuterChunkText`, model resolution, `assertPuterSignedIn`, streaming. **`stream` AND `complete` methods**; abort check at the top of every catch. **The `puterFundsDepletedModel` short-circuit (AC21) lives here**: when the model matches the flag, throw `QuotaExceeded` synchronously with zero SDK calls.
- [ ] 4.2 `apps/web/src/lib/ai/providers/policy.ts` — `runWithFallback(opts)` implementing the seven behavior rules in spec §3.5. **Does NOT import `withPuterRetry`, `withTimeout`, or `circuit-breaker.ts`** — those are adapter-internal (AC20). `notePuterTransportFailure`-equivalent is called by the policy once per failed provider on pre-first-token failures only.
- [ ] 4.3 `apps/web/src/lib/ai/providers/registry.ts` — `getProvidersForMode(mode, locale?)` returns the ordered list (today: `[puter]`). Refuses to include `mock` unless `NEXT_PUBLIC_AI_PROVIDER_DEBUG === 'mock'` AND `NODE_ENV !== 'production'`.
- [ ] 4.4 `apps/web/src/lib/ai/providers/__tests__/policy.test.ts` — 10 cases listed in spec §5.1 (including the completion-path case).
- [ ] 4.5 `apps/web/src/lib/ai/providers/__tests__/puter-provider.test.ts` — mocks `@/lib/puter` and `puter-client.ts`; asserts `available()` gate, `stream` deltas, `complete` JSON return + `parsed` field, 402 → `QuotaExceeded` mapping, **breaker state is per-provider (two PuterProvider instances have independent breaker windows)**, and the **AC21 short-circuit** (zero SDK calls when `puterFundsDepletedModel` matches; flag clears on success).
- [ ] 4.6 `apps/web/src/lib/ai/providers/__tests__/abort-race.test.ts` — regression for the spec-011 race. Asserts abort-mid-chunk normalizes to `Cancelled` (NOT `Unavailable`) for both `stream` and `complete`, and that the breaker-equivalent counter does NOT increment.
- [ ] 4.7 `apps/web/src/lib/ai/providers/__tests__/contract.test.ts` — parametrized over Puter and Mock adapters × `[stream, complete]` (4 cells per assertion), six assertions per spec §5.2.
- [ ] 4.8 **Edit `assistant.ts`**: keep the public surface (`generateResponse`, `summarizeAcademicContext`, `summarizeCurrentChat`, `summarizeLoadedData`, `generateQuiz`). Inside, delegate to `runWithFallback`. The per-model 402 gate at `assistant.ts:59-67` is **deleted** (it lives in `PuterProvider.available()` now). `tryServerSideFallback` stays at `assistant.ts` (NOT promoted to a provider per spec §3.7).
- [ ] 4.9 **Edit `useAiChat.ts`**: `sendMessage` consumes `runWithFallback`'s `{ text, degraded, cancelled, interrupted, terminalKind }`. New `degraded` state and new `interrupted` per-message flag (AC22). On `degraded === true`, the last assistant bubble is replaced with `canned.unavailable`. On `terminalKind === 'QuotaExceeded'`, it's `canned.insufficientFunds`. On `terminalKind === 'Fatal'`, `canned.genericError`. On `interrupted === true`, the message keeps partial text + renders `InterruptedChip` + inline retry button (§3.9). On `cancelled === true`, no bubble.
- [ ] 4.10 **Edit `useQuizImport.ts` and `QuickQuizFromTextModal.tsx`**: `generateQuiz` calls go through `runWithFallback`; on `{ degraded: true }`, the existing `toast.error(aiError)` becomes `toast.error(cannedMessagesFor(locale).unavailable)` (i18n key from `useAiChat`'s already-loaded messages). No new UI surface — the existing toast infra is the signal.
- [ ] 4.11 **Edit `ai-assistant.ts`**: re-exports unchanged.
- [ ] 4.12 **NO schema change** — no migration, no `database.ts` edit. The interrupted affordance is client-side/in-memory per spec §3.9 and AC22. The persistence behavior for partial messages continues exactly as today.
- [ ] 4.13 **New test `apps/web/src/hooks/__tests__/useAiChat.test.ts`** (or `apps/web/src/lib/__tests__/useAiChat.test.ts` — check existing location) — at minimum one case asserting "interrupted message renders chip + retry" per AC22.
- [ ] 4.14 **AC11 enforced**: `pnpm --filter web test` returns 81 + new tests, all 81 pre-existing tests pass **unchanged**. The diff to existing test files is empty.
- [ ] 4.15 Gates: typecheck ✓, lint ≤52, vitest green (81 + new), e2e green.

## 5. Commit 4 — `feat(ai): degraded state UI + interrupted affordance + ar/en canned.unavailable + reconciliation with insufficientFunds`

- [ ] 5.1 New `apps/web/src/components/ai/DegradedBanner.tsx` — single localized message + "Retry" button. RTL/LTR via `useLocale`; no new layout rules.
- [ ] 5.2 New `apps/web/src/components/ai/InterruptedChip.tsx` — small `⚠ Interrupted` chip + inline "Retry" button rendered under the bubble when `message.interrupted === true`. Always visible (not hover-only), reserved `h-8` row (per round-12 spec 012 §C lesson). `dir` matches bubble direction.
- [ ] 5.3 `packages/shared/src/messages/en/aiAssistant.json` — new `canned.unavailable`:
  - `"canned.unavailable": "Zane's AI features are unavailable right now. Existing materials, summaries, and question banks still work."`
- [ ] 5.4 `packages/shared/src/messages/ar/aiAssistant.json` — new `canned.unavailable`:
  - `"canned.unavailable": "ميزات Zane غير متاحة حالياً. المواد والملخصات وبنوك الأسئلة الموجودة تعمل كالمعتاد."`
- [ ] 5.5 `apps/web/src/hooks/useAiChat.ts` — `const [degraded, setDegraded] = useState(false)`. Set on `{ degraded: true }`. Reset on next successful first-token. `interrupted` flag per message set on `{ interrupted: true, text: <partial> }`.
- [ ] 5.6 `apps/web/src/app/[locale]/ai-assistant/page.tsx` — renders `<DegradedBanner>` above the composer only when `degraded === true`. The page header navigation (materials / summaries / question banks) is independent and unaffected.
- [ ] 5.7 `apps/web/src/components/ai/ChatMessageItem.tsx` — action row gains `<InterruptedChip>` rendering when `message.interrupted === true` (owner-decide exact chip copy + button label during polish round 1; commit 4 ships a minimal `⚠ Interrupted` + "Retry" pair).
- [ ] 5.8 Update `cannedErrorPrefixes.test.ts` if `canned.unavailable` starts with `⚠️` or `💳`. (Current copy starts with plain text — no update needed; verify in CI.)
- [ ] 5.9 i18n key assertion unit test: `canned.unavailable` exists in ar + en, exact wording matches §3.7; `canned.insufficientFunds` still starts with `💳`.
- [ ] 5.10 Gates: typecheck ✓, lint ≤52, vitest green, e2e green.

## 6. Commit 5 — `test(ai): e2e for forced 402, cancelled, interrupted, and fatal paths (mock provider)`

- [ ] 6.1 New `apps/web/e2e/zane-degraded.spec.ts` — cases covering each AC15/16/17/22 surface:
  1. **Chat (AC7 + AC12)**: Mock configured `fail-before-first-token` with `kind: 'QuotaExceeded'` → banner visible, last assistant bubble is `canned.unavailable`, navigation to `/ar/materials`, `/ar/summaries`, `/ar/quizzes` works.
  2. **Chat forced Cancelled (AC2)**: Mock configured `ok` then abort mid-stream → NO banner, message marked interrupted, can send a new message.
  3. **Chat forced Fatal (AC9)**: Mock configured `fail-before-first-token` with `kind: 'Fatal'` → bubble shows `canned.genericError`, NO banner.
  4. **AI-assistant summarize (AC15)**: On `/ar/ai-assistant`, click Summarize while mock fails → summarize signal surfaces `canned.unavailable`, navigation still works.
  5. **Quiz import (AC16)**: On `/ar/quizzes/new`, trigger AI import while mock fails → toast shows `canned.unavailable`.
  6. **Quick quiz modal (AC17)**: Open QuickQuizFromTextModal, submit while mock fails → modal shows `canned.unavailable` inline error.
  7. **Insufficient funds reconciliation (AC8)**: Mock configured `ok` but Puter gate forces 402 on the only configured provider → bubble is `canned.insufficientFunds`, banner NOT shown.
  8. **Interrupted UX (AC22)**: Mock configured `fail-mid-stream` (chunks: `["hello","world"]`, then transport-classified error on the third chunk) → last assistant bubble shows partial text `"helloworld"`, the `⚠ Interrupted` chip is rendered in the message action row, the inline "Retry" button is present, the degraded banner is NOT shown, and navigating to `/ar/materials` works without interruption.
  9. **Regression**: Mock configured `ok` only → no banner, chat works end-to-end.
- [ ] 6.2 `docs/agents/references/00-setup.md` — append note: setting `NEXT_PUBLIC_AI_PROVIDER_DEBUG=mock` enables MockProvider in non-production builds (used by e2e only).
- [ ] 6.3 **No new skipped tests.** If a case must skip, link the GitHub issue in `test.skip` reason.
- [ ] 6.4 Gates: typecheck ✓, lint ≤52, vitest green, **e2e at 1 worker**, e2e report shows the new spec fully passing.

## 7. Commit 6 — `docs(ai): record specs/017 execution ledger`

- [ ] 7.1 Append a `## Status ledger` section to this file with: commit SHAs, gate results (typecheck/lint count/vitest total/e2e passed+skipped), AC mapping status (PASS/FAIL per AC1–AC22), any unverified items with reasons.
- [ ] 7.2 Gates: typecheck ✓, lint ≤52.

## 8. Polish rounds (maximum 3)

Polish rounds start AFTER commit 6 lands. Owner feedback is collected; each round is ≤5 commits; each round ends with a gate pass and a ledger update. **After 3 rounds, close the spec** and open a new one for any remainder. Do not keep evolving this one.

- [ ] 8.1 Round 1 — banner placement / interrupted chip styling / retry affordance + non-chat surface (toast on quiz import / modal inline) placement (owner smoke feedback).
- [ ] 8.2 Round 2 — i18n tone + RTL/LTR verification (if any drift).
- [ ] 8.3 Round 3 — last-call polish.

## 9. Verification matrix (final report shape)

The final report must list, per commit:

- Files changed (path → lines +/-).
- Gates: typecheck ✓, lint warnings count, vitest total passed / new, e2e passed / skipped.
- AC mapping: PASS/FAIL for AC1–AC22 (per spec §7 table).
- Anything NOT verified, with reason.
- Findings about `apps/desktop/**` or the IPC contract (expected: none).
