/**
 * Pure helpers extracted from index.ts (spec 040 Wave 6) so they can be unit
 * tested offline (see ../_shared/tests/ai-chat-helpers.test.ts). This module
 * deliberately does NOT read Deno.env and does NOT import the Gemini SDK —
 * importing index.ts would snapshot env vars and fetch remote types, which
 * the offline harness cannot do. Behavior is identical to the inline
 * originals; index.ts calls these.
 */

// Headers that should NEVER appear in a client request. Their presence
// signals the client has the AI provider key and is trying to make a
// direct call (per contracts/ai-boundary.md §"What the apps are NOT
// allowed to do"). The Next.js proxy also checks these — this is the
// trust-boundary check, the proxy is defense-in-depth.
export const FORBIDDEN_HEADERS = [
  'x-ai-provider-key',
  'x-openai-api-key',
  'x-anthropic-api-key',
  'x-gemini-api-key',
] as const;

/**
 * Return the first forbidden header present (by `get`), or null. Mirrors the
 * serve() guard loop exactly (truthy header value = present).
 */
export const findForbiddenHeader = (
  get: (name: string) => string | null,
): string | null => {
  for (const header of FORBIDDEN_HEADERS) {
    if (get(header)) {
      return header;
    }
  }
  return null;
};

const SSE_ENCODER = new TextEncoder();

/** Encode one SSE frame: `data: <payload>` + blank line. */
export const sseFrame = (payload: string): Uint8Array =>
  SSE_ENCODER.encode(`data: ${payload}\n\n`);

/**
 * True when the client asked for SSE streaming. Matches the exact header the
 * shared client (packages/shared/src/ai/index.ts streamAiMessage) sends, and
 * tolerates media-range parameters (`;q=...`) and multi-value Accept lists.
 */
export const acceptsSse = (acceptHeader: string | null): boolean =>
  (acceptHeader ?? '')
    .split(',')
    .some(
      (part) => part.trim().split(';')[0].trim().toLowerCase() === 'text/event-stream'
    );

/** Gemini usageMetadata mapped to the contract's usage shape. */
export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
}

/**
 * Map Gemini's usageMetadata (promptTokenCount / candidatesTokenCount) to the
 * contract's promptTokens / completionTokens, zeroing absent values.
 */
export const mapUsage = (
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } | null,
): AiUsage => {
  const meta = usageMetadata ?? { promptTokenCount: 0, candidatesTokenCount: 0 };
  return {
    promptTokens: meta.promptTokenCount ?? 0,
    completionTokens: meta.candidatesTokenCount ?? 0,
  };
};
