# Plan 024 — Mobile Smart Paste (for owner approval; no code until approved)

## 1. Edge-cap measurement (owner note 2) — DONE, with data

- Transport: `createAiRequest(userMessage)` → shared `sendAiMessage` → `POST {SUPABASE_URL}/functions/v1/ai-chat` (`apps/mobile/src/lib/ai.ts:67-90`).
- The function validates presence only (`index.ts:283`: missing `conversationId/userMessage/context` → 400). **No length check exists** in the function or in `packages/shared/src/ai/*`.
- Provider is Gemini (`AI_MODEL ?? 'gemini-pro'`, `generateContentStream`, `index.ts:63,160`). Even the smallest Gemini context (32k tokens ≈ 100k+ chars) dwarfs our traffic.
- **Conclusion:** no hard ceiling to hit — the binding constraints are cellular payload weight + AsyncStorage bloat, not server rejection. Keep the **10k parity cap** as the client guard (same `promptTooLong` string). No interim risk holding it.

## 2. Diff-based detection design (owner note 1)

RN `TextInput` has no `onPaste`; all input arrives via `onChangeText(prev → next)`. New handler `handleChangeText(next)`:

```
p = commonPrefixLen(prev, next)
s = commonSuffixLen(prev, next) bounded by p (p + s ≤ min(len))
inserted = next.slice(p, len(next) - s)
if shouldWrap(inserted):   // >4000 chars OR >15 lines, shared with 023
    setInput(prev[0:p] + next[len-s:])   // strip the chunk, keep context
    addAttachment(inserted)
    restore caret to p via onSelectionChange + selection prop
else:
    setInput(next)          // today's behavior, untouched
```

Edge cases factored in:

| Case | Delta shape | Verdict |
|---|---|---|
| Normal typing (1 char, incl. Arabic IME commits) | tiny insert | passes through — threshold is the guard |
| Autocorrect / autocomplete word swap | small replace (tens of chars) | passes through; 3 orders of magnitude under threshold |
| Selection overwrite + paste | large `inserted` via prefix/suffix split | wrapped; surrounding text preserved |
| Paste at caret (no selection) | large pure insert | wrapped |
| Key-repeat held down 4000+ chars | large insert | wrapped (harmless; effectively a paste) |
| IME composition intermediates (Android) | small deltas | pass through; final commit re-evaluated as one change |

Caret restore: track `onSelectionChange`, pass `selection` prop set to `{start: p, end: p}` only on the strip frame. If it proves flaky on either platform, fallback is cursor-at-strip-point (documented, not blocking).

## 3. Architecture

- **New:** `apps/mobile/src/lib/paste-attachments.ts` — pure port of the 023 helpers (`countLines`, thresholds, `extractInserted(prev, next)`, `createAttachment`, `buildAttachmentBlock`, `combine`). No `TextEncoder` (use char-length KB approximation); no DOM APIs. Single responsibility: text math.
- **Modified:** `AIAssistantScreen.tsx` only — `attachments` state beside `input`; chips `View` above `inputRow` (Palette colors, ✕ removes, clear-chat clears both); `send()` builds the combined string with the **identical 023 block format**; 10k guard reuses `t("aiAssistant", "promptTooLong")` (already in the mobile bundle via shared JSON); send enabled on input OR attachments.
- **Untouched:** `lib/ai.ts`, `chat-history.ts`, edge function, shared package. `retryText` and persisted `text` carry the combined string (retry-correctness over storage; same tradeoff as web — future improvement: chip-summary user bubbles, out of scope).

## 4. Regression strategy

- Deltas under threshold take the byte-identical `setInput(next)` path — typing, autocorrect, IME, selection editing provably unaffected (unit-covered matrix).
- No transport/persistence contract changes; offline + retry + event-driven persist flows untouched.
- Gates: `pnpm --filter mobile typecheck`, `eslint` on touched files, `vitest run` (existing `ai.test.ts`, `chat-history.test.ts` must stay green + new suite).

## 5. Test spec (`src/lib/__tests__/paste-attachments.test.ts`)

`extractInserted`: pure insert / selection-replace / deletion (no insert → passthrough) / identical / empty; threshold boundary (4000/4001 chars, 15/16 lines); Arabic multi-line paste; autocorrect-size replace passthrough; `combine` block format byte-identical to 023; empty-prompt + attachment allowed.

## 6. Atomic execution plan (3 commits, staged scope only)

1. `feat(mobile): add paste-attachment text helpers with unit tests` — lib + tests, zero UI change.
2. `feat(mobile): wire smart paste chips into AIAssistantScreen composer` — screen only (i18n keys already bundled, no JSON edits needed).
3. `docs(specs): mark 024 implemented` — flip spec status + acceptance to `[x]`.

Needs nothing beyond the approved MVP exception. The `023_*` rename stays a separate chore.
