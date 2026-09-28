# Contract: Smart Paste Canvas (Shared AI Attachment Helper)

**Generated**: 2026-09-28
**Phase**: 1
**Branch**: `015-consolidate-shared-abstractions`
**Source of truth (after refactor)**: `packages/shared/src/ai/paste-attachments.ts`

This contract describes the public surface of the merged Smart Paste Canvas helper. The shape is the union of today's web and mobile implementations, minus the byte-vs-char divergence (handled internally via `TextEncoder` detection).

---

## Public API

### Threshold constants (named exports)

```typescript
export const PASTE_CHAR_THRESHOLD = 4000;       // ≥ this → wrap as attachment
export const PASTE_LINE_THRESHOLD = 15;          // ≥ this many newlines → wrap
export const AI_PROMPT_MAX_CHARS = 10000;        // hard ceiling on combined prompt
export const ATTACHMENT_PREVIEW_LENGTH = 200;    // collapsed-view preview size
```

### Pure data type

```typescript
export interface PastedAttachment {
  id: string;                  // crypto.randomUUID() on web, fallback on mobile
  timestamp: number;           // Date.now()
  originalLength: number;      // text.length at paste time
  preview: string;             // first ATTACHMENT_PREVIEW_LENGTH chars
  content: string;             // full original text
  source: 'web' | 'mobile';    // platform tag
}
```

### Pure functions

```typescript
// Returns true if the text should be wrapped as an attachment rather than inlined
export function shouldWrapAsAttachment(text: string): boolean;

// Wraps text into a PastedAttachment record (does not mutate input)
export function buildAttachment(text: string, source: 'web' | 'mobile'): PastedAttachment;

// Counts lines (splits on \n, ignores trailing empty)
export function countLines(text: string): number;

// Combines a user prompt with N attachments into the final string sent to the AI
export function combinePromptWithAttachments(
  prompt: string,
  attachments: PastedAttachment[],
): string;

// Formats a byte-or-char count into a human-readable size string ("4.2 KB", "812 B")
export function formatApproxSize(bytesOrChars: number): string;

// True if TextEncoder is available (web yes, Hermes no)
export const hasTextEncoder: boolean;

// Mobile-only: diffs prev/next to extract a paste in onChangeText
export function extractInserted(prev: string, next: string): string | null;
```

---

## Behaviour contracts

### `shouldWrapAsAttachment(text)`
- Returns `true` if `text.length >= PASTE_CHAR_THRESHOLD` **OR** `countLines(text) >= PASTE_LINE_THRESHOLD`
- Returns `false` otherwise
- Empty string returns `false`

### `buildAttachment(text, source)`
- Throws `RangeError` if `text` is empty (callers should check `shouldWrapAsAttachment` first)
- Throws `RangeError` if `text.length < PASTE_CHAR_THRESHOLD && countLines(text) < PASTE_LINE_THRESHOLD` (same guard)
- `preview` is `text.slice(0, ATTACHMENT_PREVIEW_LENGTH)` if `text.length > ATTACHMENT_PREVIEW_LENGTH`, else `text`
- `id` uses `crypto.randomUUID()` on web; on mobile, falls back to `Math.random().toString(36).slice(2) + Date.now().toString(36)`
- `source` must be the literal `'web'` or `'mobile'` (typed as such)

### `combinePromptWithAttachments(prompt, attachments)`
- Throws `RangeError` if the resulting combined string exceeds `AI_PROMPT_MAX_CHARS` (callers must trim or reject the prompt)
- Attachment-block format (byte-identical to today's web helper):
  ```
  [Pasted text #1 — 4,512 bytes — 2026-09-28T14:22:31.123Z]
  <full content>
  [/Pasted text]

  [Pasted text #2 — …]
  …
  [/Pasted text]
  ```
- Empty attachments array returns the original prompt unchanged

### `formatApproxSize(bytesOrChars)`
- `0` → `'0 B'`
- `< 1024` → `'<n> B'`
- `< 1024 * 1024` → `'<n.n> KB'` (one decimal)
- Otherwise → `'<n.n> MB'`
- Uses `Intl.NumberFormat` with `maximumFractionDigits: 1`

### `extractInserted(prev, next)` (mobile only — web bundlers drop it via dead-code elimination)
- Returns `null` if `next.length <= prev.length` (deletion, not insertion)
- Returns `null` if `next.length - prev.length < 10` (treats as a keystroke)
- Returns the inserted substring if it's a single contiguous insertion at start or end
- Returns `null` otherwise (mid-string edit)

---

## Format divergence: byte vs char

**Today**:
- Web: `formatTextSize(text)` uses `new TextEncoder().encode(text).length` (byte count)
- Mobile: `formatApproxSize(text.length)` uses char count (Hermes lacks `TextEncoder`)

**After refactor**:
- `formatApproxSize(bytesOrChars)` always takes a number (caller's responsibility to provide the right count)
- Detection of `TextEncoder` happens at module load:
  - If `typeof TextEncoder !== 'undefined'` (web): caller's responsibility to pass byte count — but this is documented and the `buildAttachment` helper does it
  - If absent (mobile): caller passes `text.length`
- `hasTextEncoder` export lets tests assert the current environment

**Why not force byte count everywhere**: forcing `TextEncoder` on mobile crashes at module load. The polyfill adds bulk for no benefit (the user sees an approximate size, not a billing-grade byte count).

---

## What this contract is NOT

- **Not a UI contract** — this is a pure-function library; rendering decisions stay in the components
- **Not a persistence contract** — `PastedAttachment` is in-memory only; persisting drafts is the caller's job (chat input state in web, AsyncStorage in mobile)
- **Not coupled to the AI SDK** — `combinePromptWithAttachments` produces a plain string the AI SDK accepts; no SDK-specific knowledge

---

## Test coverage requirements (per spec SC-006)

| Function | Minimum tests |
|---|---|
| `shouldWrapAsAttachment` | 4 (empty, short, char-threshold, line-threshold) |
| `buildAttachment` | 3 (web source, mobile source, throws on empty) |
| `countLines` | 3 (empty, single line, multi-line with trailing empty) |
| `combinePromptWithAttachments` | 4 (empty attachments, single attachment, multiple, exceeds ceiling) |
| `formatApproxSize` | 5 (0 B, B boundary, KB, MB, MB ceiling) |
| `extractInserted` | 5 (insertion at start, at end, deletion, mid-string edit, < 10 chars diff) |
| Module-load `hasTextEncoder` | 1 (asserts the current env — may need to be skipped on web CI; check with skipIf at runtime) |