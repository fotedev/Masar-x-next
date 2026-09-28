# Data Model: Consolidate Cross-Surface Abstractions (Spec 015)

**Generated**: 2026-09-28
**Phase**: 1
**Branch**: `015-consolidate-shared-abstractions`

This refactor is **structurally internal** — no new persistent entities, no schema migrations, no storage changes. The data-model.md documents the **TypeScript types** that move, not database tables.

---

## Entity: `MasarxDesktopBridge`

**Location (after refactor)**: `packages/shared/src/types/desktop-bridge.ts`

**Origin**: Inferred from `apps/desktop/src/main/preload.ts` where the `api` object literal is constructed and passed to `contextBridge.exposeInMainWorld('masarxDesktop', api)`.

**Shape (5 namespaces, ~10 method signatures each)**:

| Namespace | Methods (representative) | Source line in preload |
|---|---|---|
| `auth` | `signIn(email, password)`, `signOut()`, `getSession()`, `onAuthChange(cb)` | ~line 28 |
| `session` | `getLocal()`, `setLocal(k,v)`, `clear()` | ~line 36 |
| `profile` | `getCurrent()`, `upsert(profile)`, `onUpdate(cb)` | ~line 44 |
| `updates` | `checkFor()`, `downloadAndInstall()`, `onError(cb)`, `onProgress(cb)`, `onInstallProgress(cb)` *(added in this refactor as a test fixture)* | ~line 52 |
| `server` | `getPort()`, `getRecoveryPageUrl()`, `restart()` | ~line 64 |

**Relationships**:
- **Imported by** `apps/desktop/src/main/preload.ts` (the literal source of truth)
- **Re-exported by** `apps/web/src/lib/desktop/runtime.ts` (for renderer consumption, ≤10 LOC after refactor)
- **Imported by** `apps/web/src/components/desktop/*` and `apps/web/src/contexts/AuthContext.tsx` (the actual consumers)

**Validation rules**:
- The TypeScript compiler enforces shape parity at compile time (object literal must satisfy `typeof api` exported type)
- A regression test (`packages/shared/src/types/desktop-bridge.test.ts`) snapshots the expected channel names and asserts preload's literal has the same keys

**State transitions**: None — pure type descriptor.

---

## Entity: `PastedAttachment`

**Location (after refactor)**: `packages/shared/src/ai/paste-attachments.ts`

**Origin**: Merged from `apps/web/src/lib/ai/pasted-attachments.ts` + `apps/mobile/src/lib/paste-attachments.ts`. The shape is byte-identical-by-convention between the two source files (the mobile file even has a comment to that effect).

**Shape**:

| Field | Type | Description |
|---|---|---|
| `id` | `string` (UUID v4 or `crypto.randomUUID()` on web; RN fallback on mobile) | Stable identifier for the attachment block |
| `timestamp` | `number` (epoch ms) | When the paste happened |
| `originalLength` | `number` | Char count of the original pasted text |
| `preview` | `string` | First ~200 chars of the original (used in collapsed view) |
| `content` | `string` | Full original text |
| `source` | `'web' \| 'mobile'` | Platform tag (helps telemetry + debugging) |

**Relationships**:
- **Consumed by** `apps/web/src/components/ai/ChatInput.tsx` and `apps/web/src/components/ai/ChatMessageItem.tsx`
- **Consumed by** `apps/mobile/src/screens/AIAssistantScreen.tsx`
- **Used in** the `combinePromptWithAttachments` and `buildAttachmentBlock` helpers (same module)

**Validation rules**:
- `originalLength > 0` (no empty pastes)
- `content.length === originalLength`
- `preview.length <= 200`
- `source` must be one of the two literal strings (Zod enum)

**State transitions**: None — plain data record.

---

## Entity: Threshold Constants

**Location (after refactor)**: `packages/shared/src/ai/paste-attachments.ts` (named exports)

**Shape**:

| Constant | Value | Semantics |
|---|---|---|
| `PASTE_CHAR_THRESHOLD` | `4000` | Pastes ≥ this many chars are wrapped as an attachment |
| `PASTE_LINE_THRESHOLD` | `15` | Pastes with ≥ this many newlines are also wrapped |
| `AI_PROMPT_MAX_CHARS` | `10000` | Hard ceiling on combined prompt + attachments in a single AI call |
| `ATTACHMENT_PREVIEW_LENGTH` | `200` | Char count of the collapsed-view preview |

**Validation rules**:
- All four must be positive integers
- `PASTE_CHAR_THRESHOLD <= AI_PROMPT_MAX_CHARS`
- `ATTACHMENT_PREVIEW_LENGTH < PASTE_CHAR_THRESHOLD`

These become the single source of truth for both web and mobile. Today they are duplicated in two files with no enforcement.

---

## Entity: `extractInserted(prev, next)` helper (mobile-only)

**Location (after refactor)**: `packages/shared/src/ai/paste-attachments.ts` (named export, ignored by web bundlers)

**Signature**:
```typescript
export function extractInserted(prev: string, next: string): string | null
```

**Returns**: The substring of `next` that does not exist in `prev`, or `null` if the difference is not a single contiguous insertion (i.e. the user is editing mid-string, not pasting).

**Validation rules**:
- Returns `null` if `prev.length > next.length` (deletion)
- Returns `null` if `next.length - prev.length < 10` (treats as a keystroke, not a paste)
- Otherwise returns the inserted substring

**Platform note in JSDoc**: "Used by mobile `onChangeText` to detect pastes for Smart Paste Canvas. Not used by web because web's `onPaste` event provides the inserted text directly. Bundlers with dead-code elimination (Turbopack, Metro) will drop this from web bundles."

---

## Migration Map (the actual diff the plan produces)

| Before | After | LOC delta |
|---|---|---|
| `apps/desktop/src/main/preload.ts` (inline `api` literal + `export type MasarxDesktopApi = typeof api`) | `apps/desktop/src/main/preload.ts` imports the `api` literal from shared | -0 (same LOC; just `from` keyword added) |
| (no shared bridge file) | `packages/shared/src/types/desktop-bridge.ts` exports the `api` literal + `MasarxDesktopBridge` type | +~85 LOC |
| `apps/web/src/lib/desktop/runtime.ts` (~70 LOC bridge redeclaration) | imports `MasarxDesktopBridge` from shared, re-exports it | -60 LOC |
| `apps/web/src/lib/ai/pasted-attachments.ts` (91 LOC) | imports from shared | -80 LOC |
| `apps/mobile/src/lib/paste-attachments.ts` (95 LOC) | imports from shared | -85 LOC |
| (no shared paste-attachments file) | `packages/shared/src/ai/paste-attachments.ts` exports the merged helper | +~110 LOC |
| `packages/shared/src/types/schemas/index.ts` + `database.ts` (with 20 unused `Validated*`/`Waitlist*`) | same files, dead exports removed | -~120 LOC |

**Net delta**: ~150 LOC removed from web/mobile, ~195 LOC added to shared, ~120 LOC removed from schemas. Repository grows by ~75 LOC of *better-organised* code with a regression test suite attached.

---

## What this plan does NOT touch

- Database schema (no migrations)
- Supabase Edge Functions (no changes)
- Mobile `onChangeText` event wiring (just imports the helper)
- Desktop `ipcMain.handle` registration (already correct per the audit — no bridge method mismatches found)
- Web `apps/web/src/components/desktop/*` (consumer code, only the import path changes)