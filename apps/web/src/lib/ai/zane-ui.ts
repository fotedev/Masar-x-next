/**
 * zane-ui payload validation (spec 050, issue #242).
 *
 * ZANE_UI_INSTRUCTION (prompts.ts) makes the model emit ```zane-ui``` button
 * blocks, and the model's OUTPUT can become future INPUT — a reply shaped by
 * injected content could otherwise plant arbitrary follow-up prompts as
 * clickable buttons with unbounded `message` values. extractZaneUiBlocks
 * (ChatMessageItem) routes parsed payloads through validateZaneUiPayload:
 * invalid blocks stay stripped from the text but produce no buttons — the
 * same disposition malformed JSON already gets.
 *
 * No predefined-action sandbox: the feature's contract is free-text button
 * messages (rejected in spec 050 §D5). Pure module — no React, no i18n.
 */

export type ZaneUiButton = { label: string; message: string };
export type ZaneUiPayload = { type: "buttons"; title?: string; buttons: ZaneUiButton[] };

export const ZANE_UI_BUTTONS_MIN = 2;
export const ZANE_UI_BUTTONS_MAX = 4;
export const ZANE_UI_LABEL_MAX = 60;
export const ZANE_UI_MESSAGE_MAX = 300;
export const ZANE_UI_TITLE_MAX = 80;

// Instruction-override phrases: a button whose label/message carries one is
// treated as an injection attempt, not a suggestion the user asked for.
// The verb→noun gap tolerates up to 3 filler words ("ignore ALL PREVIOUS
// instructions", "disregard any of the rules above") — a single-adjective
// pattern misses "disregard all prior prompts".
const INJECTION_PATTERNS: readonly RegExp[] = [
  /(?:ignore|disregard|forget)\s+(?:\w+\s+){0,3}(?:instructions?|prompts?|rules?)/i,
  /تجاهل\s+(?:\S+\s+){0,3}(?:التعليمات|القواعد|ما\s+سبق)/,
  /تغيير\s+قواعدك|غيّر\s+قواعدك/,
  /system\s+prompt/i,
];

// Channel-marker lookalikes: a button must never carry prompt-channel
// delimiters (spec 050) — those belong to the assistant's own framing.
const MARKER_TAG_PATTERN = /<\s*\/?\s*(platform_context|conversation_history|user_message)\b/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Validate one parsed ```zane-ui``` payload. Returns a normalized payload,
 * or null when the block must be dropped (no buttons rendered).
 */
export const validateZaneUiPayload = (parsed: unknown): ZaneUiPayload | null => {
  if (!isRecord(parsed)) return null;
  if (parsed.type !== "buttons") return null;
  if (!Array.isArray(parsed.buttons)) return null;
  if (parsed.buttons.length < ZANE_UI_BUTTONS_MIN || parsed.buttons.length > ZANE_UI_BUTTONS_MAX) {
    return null;
  }

  const buttons: ZaneUiButton[] = [];
  for (const button of parsed.buttons) {
    if (!isRecord(button)) return null;
    const { label, message } = button;
    if (typeof label !== "string" || typeof message !== "string") return null;
    if (!label.trim() || label.length > ZANE_UI_LABEL_MAX) return null;
    if (message.length > ZANE_UI_MESSAGE_MAX) return null;
    const haystack = `${label}\n${message}`;
    if (INJECTION_PATTERNS.some((pattern) => pattern.test(haystack))) return null;
    if (MARKER_TAG_PATTERN.test(haystack)) return null;
    buttons.push({ label, message });
  }

  let title: string | undefined;
  if (parsed.title !== undefined) {
    if (typeof parsed.title !== "string" || parsed.title.length > ZANE_UI_TITLE_MAX) return null;
    title = parsed.title;
  }

  return title !== undefined ? { type: "buttons", title, buttons } : { type: "buttons", buttons };
};
