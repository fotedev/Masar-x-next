/**
 * Mobile Smart Paste helpers (spec 024, parity with web spec 023).
 *
 * Mobile re-export of the shared implementation in
 * `packages/shared/src/ai/paste-attachments.ts`. Behaviour preserved
 * byte-for-byte from the pre-refactor file, including:
 *   - Hermes-safe size formatting (TextEncoder auto-detect)
 *   - extractInserted() for React Native TextInput onChangeText diffs
 *
 * Pre-refactor this file had its own formatApproxSize(charCount) that
 * took a number. The shared version takes a string and computes the
 * length internally; callers pass `text` (not `text.length`).
 */
export {
  PASTE_CHAR_THRESHOLD,
  PASTE_LINE_THRESHOLD,
  AI_PROMPT_MAX_CHARS,
  hasTextEncoder,
  countLines,
  shouldWrapAsAttachment,
  formatApproxSize,
  createPastedAttachment,
  extractInserted,
  buildAttachmentBlock,
  combinePromptWithAttachments,
  type PastedAttachment,
} from 'masarx-shared/ai/paste-attachments';
