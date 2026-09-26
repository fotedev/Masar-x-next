/**
 * Shared AI client bearer-token tests (spec 018 C4/T070).
 * Exercises `masarx-shared/ai` — the exact import path the mobile
 * runtime uses — against a stubbed global fetch: the `authToken`
 * option must attach `Authorization: Bearer`, and its absence must
 * leave the wire behavior identical to pre-018 (no auth header).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { sendAiMessage, streamAiMessage } from "masarx-shared/ai";
import type { AiRequest } from "masarx-shared/ai";

const request: AiRequest = {
  conversationId: "11111111-1111-4111-8111-111111111111",
  userMessage: "مرحبا",
  context: { language: "ar", appVersion: "0.6.0", deviceClass: "mobile" },
};

const URL = "https://example.supabase.co/functions/v1/ai-chat";

function fetchCapture(responseBody: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => responseBody,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ delta: "مرحبا", done: false })}\n\n` +
                  `data: ${JSON.stringify({ delta: "", done: true })}\n\n`,
              ),
            );
            controller.close();
          },
        }),
      };
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendAiMessage authToken", () => {
  it("attaches Authorization: Bearer when authToken is provided", async () => {
    const calls = fetchCapture({});
    await sendAiMessage(request, { edgeFunctionUrl: URL, authToken: "tok-123" });
    expect(calls).toHaveLength(1);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-123");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(calls[0].url).toBe(URL);
  });

  it("omits the Authorization header when authToken is absent (web-compatible)", async () => {
    const calls = fetchCapture({});
    await sendAiMessage(request, { edgeFunctionUrl: URL });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});

describe("streamAiMessage authToken", () => {
  it("attaches Authorization: Bearer and Accept: text/event-stream", async () => {
    const calls = fetchCapture({});
    const deltas = [];
    for await (const delta of streamAiMessage(request, {
      edgeFunctionUrl: URL,
      authToken: "tok-456",
    })) {
      deltas.push(delta);
    }
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-456");
    expect(headers.Accept).toBe("text/event-stream");
    expect(deltas.at(-1)?.done).toBe(true);
  });

  it("omits the Authorization header when authToken is absent", async () => {
    const calls = fetchCapture({});
    for await (const _ of streamAiMessage(request, { edgeFunctionUrl: URL })) {
      break;
    }
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});
