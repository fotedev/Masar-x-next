# Spec 023 — Smart Paste Canvas (AI chat paste-to-attachment)

**Status:** Approved (owner, 2026-09-26 — MVP Lock exception granted in chat)
**Type:** Feature (owner-directed exception to MVP Lock; chat-input stability)
**Scope:** Web only (`apps/web`). Desktop (`AssistantPanel.tsx:170`) + mobile are parity follow-ups, not in this spec.

## Problem

Pasting large text into the ZANE AI composer floods the textarea, wrecks the layout, and risks breaching the 10k-char `/api/ai/chat` Zod limit with an opaque error. Claude.ai-style UX wraps big pastes in a neat container instead, while still delivering the full text to the model.

## Trigger (owner-approved)

Wrap as attachment when pasted text is **>4000 chars OR >15 lines**. (>15, not >4: a 5-line prompt is normal input and must never become an attachment.)

## Design

- `apps/web/src/lib/ai/pasted-attachments.ts` (new): `PASTE_CHAR_THRESHOLD`, `PASTE_LINE_THRESHOLD`, `shouldWrapAsAttachment`, `createPastedAttachment` (`pasted-text-[timestamp].txt` + `formatTextSize`), `buildAttachmentBlock`, `combinePromptWithAttachments`, `AI_PROMPT_MAX_CHARS = 10000`.
- State lives in `apps/web/src/app/[locale]/ai-assistant/page.tsx` (`pastedAttachments` alongside `inputMessage`); `ChatInput` stays presentational (props only). Send builds `combinePromptWithAttachments(input, attachments)`, toasts `promptTooLong` and aborts when >10k, then clears both states. Clear-chat also clears attachments.
- `ChatInput.tsx`: `onPaste` intercept (small pastes fall through to the default path untouched), chips rendered above the textarea (FileText icon + `pastedText` + size/chars + X → `removeAttachment`). Send is enabled when typed text OR attachments exist.
- Payload is string injection — `{prompt}\n\n[Attached Document: name]\n\n{content}\n\n[End of Document]` — because the Puter.js primary path takes a string prompt, not multipart files. No backend change; `useAiChat` / `assistant.ts` untouched, so no empty or broken attachment objects can reach the API.
- i18n: `pastedText`, `pastedChars`, `removeAttachment`, `promptTooLong` in `aiAssistant.json` (ar/en). No hardcoded strings.

## Non-goals

- Desktop `AssistantPanel.tsx` parity; mobile port.
- Multipart upload / new backend route.
- Multi-file drag-drop; editing attachment contents inline.

## Regression strategy

- Small pastes (<threshold) behave exactly as before (default paste path, no interception).
- No `useAiChat` / API contract changes; server fallback 10k limit unchanged.
- Gates at commit: `pnpm --filter web typecheck` clean, eslint clean on touched files, `src/lib/ai` + new `pasted-attachments` vitest suites green (17/17).

## Acceptance

- [x] Paste >4000 chars or >15 lines → chip appears, textarea stays clean.
- [x] X removes a chip; Clear chat removes all chips.
- [x] Send with chip + empty prompt works; full content reaches the model as a document block.
- [x] Combined >10000 chars → `promptTooLong` toast, nothing sent.
- [x] ar/en strings render; no new hardcoded-Arabic hits.
