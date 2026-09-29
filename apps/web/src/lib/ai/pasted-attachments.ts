/**
 * Smart Paste Canvas helpers (spec 022, spec 015 US2).
 *
 * Web re-export. The actual implementation lives in
 * `packages/shared/src/ai/paste-attachments.ts` so web, mobile, and
 * future surfaces stay byte-identical. Thresholds approved by owner:
 * >4000 chars OR >15 lines. Server fallback `/api/ai/chat` enforces
 * a 10k-char Zod limit — callers must guard via AI_PROMPT_MAX_CHARS.
 *
 * Pre-refactor this file also exported `formatByteSize(charCount)` and
 * `formatTextSize(text)` — both were unused outside this file and
 * replaced by the shared `formatApproxSize(text)` which auto-detects
 * TextEncoder availability.
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
  buildAttachmentBlock,
  combinePromptWithAttachments,
  type PastedAttachment,
} from 'masarx-shared/ai/paste-attachments';
