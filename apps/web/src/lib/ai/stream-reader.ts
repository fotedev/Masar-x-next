/**
 * Incremental consumption of the plain-text chunked streams the AI routes
 * answer with (spec 011). `/api/ai/chat` responds via
 * `streamText(...).toTextStreamResponse()` — reading it as JSON silently
 * broke the server-side fallback; this reader is the fix.
 */

export type TextStreamDeltaHandler = (fullSoFar: string) => void;

export const consumeTextStream = async (
  response: Response,
  onDelta?: TextStreamDeltaHandler,
): Promise<string> => {
  const body = response.body;
  if (!body) return response.text();

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      full += decoder.decode(value, { stream: true });
      onDelta?.(full);
    }
    full += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  return full;
};
