/**
 * Cross-platform AI client.
 *
 * Implements the contract in
 * `specs/004-multi-platform-expansion/contracts/ai-boundary.md`:
 *
 *   "Every AI assistant request from any client (web, desktop, mobile)
 *    goes through a Supabase Edge Function that injects the AI
 *    provider key. The clients do not call the AI provider directly.
 *    The AI provider key never appears in any client-distributed
 *    bundle, on any platform, in any form."
 *
 * `sendAiMessage` and `streamAiMessage` are the only entry points.
 * They route through the shared `aiRequest` helper, which hits the
 * Supabase Edge Function URL with the request body. The AI provider
 * key is read exclusively by the Edge Function from its own
 * environment.
 *
 * The web app's existing Puter.js integration in
 * `apps/web/src/lib/ai-assistant.ts` is left untouched in v1 of
 * Phase 2 — the contract enforcement (ESLint `no-restricted-imports`
 * at error severity, T013; the CI grep for AI provider endpoints,
 * T014) catches direct SDK calls to `openai` and `@anthropic-ai/sdk`.
 * Migrating the existing Puter.js integration to the shared client
 * is a separate work item tracked in plan.md §Cross-cutting concerns.
 */
import type { AiRequest, AiResponse, AiResponseDelta } from "./types";

export type { AiRequest, AiResponse, AiResponseDelta } from "./types";

/**
 * Default Edge Function base. The web app can override this via
 * the `edgeFunctionUrl` option in `sendAiMessage` / `streamAiMessage`.
 * In v1 the web app's existing Puter.js integration continues to
 * call the production endpoint; the shared client is a parallel
 * surface that other consumers (e.g. the upcoming desktop app in
 * US1) use.
 */
const DEFAULT_EDGE_FUNCTION_URL = "/api/ai-chat";

/**
 * Internal: a thin `fetch` wrapper that injects the
 * `Content-Type: application/json` header and propagates an
 * `AbortSignal` through.
 */
async function aiRequest<T>(
  body: AiRequest,
  options: { signal?: AbortSignal; edgeFunctionUrl?: string } = {},
): Promise<T> {
  const url = options.edgeFunctionUrl ?? DEFAULT_EDGE_FUNCTION_URL;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(
      `AI request failed: ${response.status} ${response.statusText} ` +
        `(url=${url})`,
    );
  }

  return (await response.json()) as T;
}

/**
 * Send a single AI message and receive a full response.
 *
 * @param request   The `AiRequest` payload (see `./types.ts`).
 * @param options   Optional `signal` for cancellation, and an
 *                  optional `edgeFunctionUrl` override.
 */
export async function sendAiMessage(
  request: AiRequest,
  options: { signal?: AbortSignal; edgeFunctionUrl?: string } = {},
): Promise<AiResponse> {
  return aiRequest<AiResponse>(request, options);
}

/**
 * Stream an AI response. The Edge Function returns an
 * `text/event-stream` body; this function parses the SSE stream and
 * yields each `AiResponseDelta`.
 *
 * The terminal delta has `done: true` and includes the same `usage`
 * shape as the non-streaming response. Cancellation is honored via
 * the `AbortSignal` — passing an already-aborted signal causes the
 * function to return immediately.
 */
export async function* streamAiMessage(
  request: AiRequest,
  options: { signal?: AbortSignal; edgeFunctionUrl?: string } = {},
): AsyncIterable<AiResponseDelta> {
  if (options.signal?.aborted) {
    return;
  }

  const url = options.edgeFunctionUrl ?? DEFAULT_EDGE_FUNCTION_URL;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(request),
    signal: options.signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(
      `AI stream failed: ${response.status} ${response.statusText} ` +
        `(url=${url})`,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by a blank line. Parse line by
      // line so partial chunks at chunk boundaries are handled
      // correctly.
      let lineEnd = buffer.indexOf("\n");
      while (lineEnd !== -1) {
        const line = buffer.slice(0, lineEnd).trim();
        buffer = buffer.slice(lineEnd + 1);
        lineEnd = buffer.indexOf("\n");

        if (!line || !line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;

        try {
          const parsed = JSON.parse(payload) as AiResponseDelta;
          yield parsed;
          if (parsed.done) return;
        } catch {
          // Malformed chunk — skip it. The Edge Function is the
          // source of truth for stream shape; the client is a
          // best-effort consumer.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
