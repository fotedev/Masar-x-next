/**
 * Smart Paste Canvas helpers (spec 022).
 *
 * Web is source of truth; desktop/mobile port later.
 * Thresholds approved by owner: >4000 chars OR >15 lines.
 * Payload strategy: string injection into the Puter prompt
 * (puter.ai.chat takes a string, not multipart). Server fallback
 * `/api/ai/chat` enforces a 10k-char Zod limit — callers must guard.
 */

export interface PastedAttachment {
  id: string;
  /** Display name, e.g. "pasted-text-1727260800000.txt" */
  name: string;
  content: string;
  charCount: number;
  sizeLabel: string;
}

export const PASTE_CHAR_THRESHOLD = 4000;
export const PASTE_LINE_THRESHOLD = 15;

/** Max prompt chars accepted by POST /api/ai/chat (route.ts Zod schema). */
export const AI_PROMPT_MAX_CHARS = 10000;

export function countLines(text: string): number {
  if (!text) return 0;
  // Split on \n; a trailing newline does not create an extra logical line.
  const parts = text.split("\n");
  if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
  return parts.length;
}

export function shouldWrapAsAttachment(text: string): boolean {
  if (!text) return false;
  return text.length > PASTE_CHAR_THRESHOLD || countLines(text) > PASTE_LINE_THRESHOLD;
}

export function formatByteSize(charCount: number): string {
  const bytes = charCount;
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb >= 100 ? Math.round(kb) : kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function formatTextSize(text: string): string {
  let bytes: number;
  try {
    bytes =
      typeof TextEncoder !== "undefined"
        ? new TextEncoder().encode(text).length
        : text.length;
  } catch {
    bytes = text.length;
  }
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb >= 100 ? Math.round(kb) : kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function createPastedAttachment(text: string, now = Date.now()): PastedAttachment {
  const content = text;
  return {
    id: `pasted-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name: `pasted-text-${now}.txt`,
    content,
    charCount: content.length,
    sizeLabel: formatTextSize(content),
  };
}

export function buildAttachmentBlock(attachment: PastedAttachment): string {
  return `[Attached Document: ${attachment.name}]\n\n${attachment.content}\n\n[End of Document]`;
}

/**
 * Combine the user's typed prompt with attachments for the AI call.
 * Empty typed prompt is allowed when attachments exist (caller enables send).
 */
export function combinePromptWithAttachments(
  userPrompt: string,
  attachments: readonly PastedAttachment[],
): string {
  const trimmed = userPrompt.trim();
  if (attachments.length === 0) return trimmed;
  const blocks = attachments.map(buildAttachmentBlock).join("\n\n");
  if (!trimmed) return blocks;
  return `${trimmed}\n\n${blocks}`;
}
