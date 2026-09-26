# Spec 024 — Mobile Smart Paste (AIAssistantScreen parity with spec 023)

**Status:** Approved and implemented (owner, 2026-09-26 — plan.md approved as-is, MVP exception confirmed; commits `020119b` + `b7211a2`)
**Type:** Feature (needs MVP Lock exception — same class as spec 023)
**Scope:** `apps/mobile` only (`src/screens/AIAssistantScreen.tsx` + StyleSheet chips). Web (`023`) untouched.

> Numbering note: disk holds TWO `023_*` dirs (`023_mobile_sentry`, `023_smart_paste_canvas`), so `024` is the next free number. The `023` collision should be resolved by a rename in a separate chore commit.

## Problem

Spec 023 covers web chat + desktop workspace. The Expo screen (`AIAssistantScreen.tsx:248`) has a bare multiline `TextInput`: a large paste floods the composer with no containment, and the Edge Function round-trip has no client-side size guard.

## Constraints (why this is NOT a copy-paste of 023)

1. **No paste events.** React Native `TextInput` exposes no `onPaste`; a paste arrives as `onChangeText` with a large new value. Detection must diff previous vs next value: if a single change inserts a chunk matching the 023 thresholds (>4000 chars OR >15 lines), strip the chunk into an attachment and keep the surrounding typed text. Small edits and normal typing must pass through untouched.
2. **Different transport.** Mobile sends `createAiRequest(userMessage, locale)` → shared `sendAiMessage` → absolute Edge Function URL (`SUPABASE_URL/functions/v1/ai-chat`), NOT Puter.js. No `userMessage` length cap was found in `supabase/functions/ai-chat/index.ts` or `packages/shared/src/ai/*` — but the provider behind the function still has token limits.
3. **Retry + persistence interplay.** `send()` stores `retryText` and `chat-history.ts` persists the sent `text`. If the combined (injected) string is stored, retry works unchanged but history keeps the full pasted content (AsyncStorage bloat). If only the typed prompt is stored, retry of an attachment send breaks. Decision needed (default: store combined — retry correctness over storage).
4. **i18n is free.** Mobile already imports the whole shared `aiAssistant.json` (`src/i18n.ts:29,42`), so the 023 keys (`pastedText`, `pastedChars`, `removeAttachment`, `promptTooLong`) are available as `t("aiAssistant", key)` with zero bundle work. Chip layout must use flexbox + `textAlign` (no Tailwind logical props on native; RTL via `I18nManager`/locale as the screen already does with `MathText rtl={locale === "ar"}`).

## Proposed design (for `/speckit.plan` to confirm)

- Mirror the 023 state shape in the screen: `attachments` array (`{id, name, content, charCount, sizeLabel}`) beside `input`. Reuse the 023 block format `[Attached Document: …]…[End of Document]` so prompts behave identically across surfaces.
- Size guard: apply the same 10k conservative cap with the existing `promptTooLong` string until the Edge Function limit is measured (assumption, revisit if the function documents its own limit).
- Chips: lightweight `View` row above the input (icon glyph + name + size + ✕), theme `Palette` colors, send enabled when input OR attachments exist, clear-chat clears both.
- No helper sharing with web (RN has no `TextEncoder` guarantee and no DOM clipboard); port the pure functions (`countLines`, thresholds, block builder) into `apps/mobile/src/lib/` with mobile unit tests.

## Non-goals

- Web/desktop changes. Streaming variant (`streamAiMessageMobile`). Server-side history sync. Attachment editing.

## Acceptance

- [x] Large paste → chip appears, composer keeps only surrounding typed text.
- [x] Normal typing / small pastes behave exactly as today (passthrough path + unit matrix).
- [x] Send with chip + empty input works; model receives the document block.
- [x] Oversize combined text → `promptTooLong` notice, nothing sent.
- [x] Retry after failure resends the full (combined) content (`retryText` = combined).
- [x] RTL (ar) chip layout follows row-direction flipping + shared strings (code review; device check recommended).
- [ ] Mobile gates (`typecheck`/eslint/vitest) could NOT run in this environment — `apps/mobile/node_modules` was never installed and installing churned the lockfile (reverted). Compensating: pure-logic runtime harness 10/10 green + byte-identical block format to the tested web helper. Run the mobile suite on a provisioned machine before release.

## Readiness

Needs owner approval + MVP Lock exception before `/speckit.plan`. Open question for planning: measure the real Edge Function / provider input limit to replace the assumed 10k cap.
