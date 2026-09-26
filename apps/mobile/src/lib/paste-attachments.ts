/**
 * Mobile Smart Paste helpers (spec 024, parity with web spec 023).
 *
 * Pure text math only — no DOM, no clipboard, no TextEncoder (not
 * guaranteed on Hermes): sizes are char-length approximations.
 * React Native TextInput exposes no onPaste event, so the screen diffs
 * onChangeText values with extractInserted() and wraps only the
 * newly-inserted chunk when it clears the shared thresholds.
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

/** Conservative cross-surface cap (matches the web 10k guard; see plan.md §1). */
export const AI_PROMPT_MAX_CHARS = 10000;

export function countLines(text: string): number {
  if (!text) return 0;
  const parts = text.split("\n");
  if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
  return parts.length;
}

export function shouldWrapAsAttachment(text: string): boolean {
  if (!text) return false;
  return text.length > PASTE_CHAR_THRESHOLD || countLines(text) > PASTE_LINE_THRESHOLD;
}

export function formatApproxSize(charCount: number): string {
  if (charCount < 1024) return `${charCount} B`;
  const kb = charCount / 1024;
  if (kb < 1024) return `${kb >= 100 ? Math.round(kb) : kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function createPastedAttachment(text: string, now = Date.now()): PastedAttachment {
  return {
    id: `pasted-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name: `pasted-text-${now}.txt`,
    content: text,
    charCount: text.length,
    sizeLabel: formatApproxSize(text.length),
  };
}

/**
 * Split an onChangeText transition into the newly-inserted chunk and the
 * value with that chunk stripped. Pure insertions, selection overwrites,
 * and (small) autocorrect/IME swaps all reduce to a prefix/suffix split;
 * deletions yield an empty `inserted` and pass through.
 */
export function extractInserted(
  prev: string,
  next: string,
): { inserted: string; stripped: string; prefixLength: number } {
  const minLen = Math.min(prev.length, next.length);
  let p = 0;
  while (p < minLen && prev[p] === next[p]) p++;
  let s = 0;
  while (s < minLen - p && prev[prev.length - 1 - s] === next[next.length - 1 - s]) s++;
  return {
    inserted: next.slice(p, next.length - s),
    stripped: prev.slice(0, p) + next.slice(next.length - s),
    prefixLength: p,
  };
}

export function buildAttachmentBlock(attachment: PastedAttachment): string {
  return `[Attached Document: ${attachment.name}]\n\n${attachment.content}\n\n[End of Document]`;
}

/**
 * Combine the user's typed prompt with attachments for the AI call.
 * Byte-identical format to the web helper so prompts behave the same
 * on every surface. Empty typed prompt is allowed when attachments exist.
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
