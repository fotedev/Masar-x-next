/**
 * Smart Paste Canvas helpers — shared cross-surface implementation.
 *
 * Spec 015 US2 — merged from:
 *   - apps/web/src/lib/ai/pasted-attachments.ts       (spec 022)
 *   - apps/mobile/src/lib/paste-attachments.ts        (spec 024)
 *
 * Web and mobile were ~90% identical with subtle differences in the
 * size-formatting helper. The web used `TextEncoder.encode().length`
 * (byte-accurate) when available; mobile fell back to char-length
 * (Hermes is the constraint — RN doesn't ship a TextEncoder polyfill
 * by default). The shared module now uses the web's strategy with
 * runtime detection: TextEncoder when present, char-length fallback
 * otherwise. Behaviour on each surface is unchanged from the
 * pre-refactor code on that surface.
 *
 * Pure functions only — no DOM, no clipboard, no React. Both consumers
 * (`apps/web/src/lib/ai/pasted-attachments.ts` and
 * `apps/mobile/src/lib/paste-attachments.ts`) re-export from here.
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

/**
 * True when `TextEncoder` is available in the current runtime.
 * Hermes (React Native) historically lacks a TextEncoder polyfill;
 * node ≥ 11 has it; modern browsers have it.
 */
export const hasTextEncoder: boolean = (() => {
  try {
    return typeof globalThis.TextEncoder !== 'undefined';
  } catch {
    return false;
  }
})();

export function countLines(text: string): number {
  if (!text) return 0;
  // Split on \n; a trailing newline does not create an extra logical line.
  const parts = text.split('\n');
  if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
  return parts.length;
}

export function shouldWrapAsAttachment(text: string): boolean {
  if (!text) return false;
  return text.length > PASTE_CHAR_THRESHOLD || countLines(text) > PASTE_LINE_THRESHOLD;
}

/**
 * Format a size for display. Uses byte-length when TextEncoder is
 * available (web, node); falls back to char-length approximation on
 * Hermes (mobile). Pure — takes the input text so it can pick the
 * appropriate measurement strategy.
 */
export function formatApproxSize(text: string): string {
  let bytes: number;
  if (hasTextEncoder) {
    try {
      bytes = new TextEncoder().encode(text).length;
    } catch {
      bytes = text.length;
    }
  } else {
    bytes = text.length;
  }
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb >= 100 ? Math.round(kb) : kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function createPastedAttachment(text: string, now: number = Date.now()): PastedAttachment {
  return {
    id: `pasted-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name: `pasted-text-${now}.txt`,
    content: text,
    charCount: text.length,
    sizeLabel: formatApproxSize(text),
  };
}

export function buildAttachmentBlock(attachment: PastedAttachment): string {
  return `[Attached Document: ${attachment.name}]\n\n${attachment.content}\n\n[End of Document]`;
}

/**
 * Combine the user's typed prompt with attachments for the AI call.
 * Empty typed prompt is allowed when attachments exist (caller enables send).
 * Byte-identical format to the pre-refactor web and mobile helpers.
 */
export function combinePromptWithAttachments(
  userPrompt: string,
  attachments: readonly PastedAttachment[],
): string {
  const trimmed = userPrompt.trim();
  if (attachments.length === 0) return trimmed;
  const blocks = attachments.map(buildAttachmentBlock).join('\n\n');
  if (!trimmed) return blocks;
  return `${trimmed}\n\n${blocks}`;
}

/**
 * Split an onChangeText transition into the newly-inserted chunk and the
 * value with that chunk stripped. Pure insertions, selection overwrites,
 * and (small) autocorrect/IME swaps all reduce to a prefix/suffix split;
 * deletions yield an empty `inserted` and pass through.
 *
 * Mobile-only helper (React Native TextInput has no onPaste event).
 * Kept here so the shared module has a single export surface; web code
 * will not call it. Signature is identical to the pre-refactor mobile
 * implementation.
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