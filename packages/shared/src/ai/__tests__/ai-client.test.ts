import { afterEach, describe, expect, it, vi } from "vitest";
import { sendAiMessage, streamAiMessage } from "../index";
import type { AiResponseDelta } from "../types";

function sseResponse(chunks: string[], init?: ResponseInit): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, ...init });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendAiMessage", () => {
  it("POSTs JSON to the default edge function URL and returns the payload", async () => {
    const fetchMock = vi.fn(
      async (_url?: unknown, _init?: RequestInit) =>
        Response.json({
          content: "hello",
          usage: { promptTokens: 3, completionTokens: 4 },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await sendAiMessage({
      conversationId: "c1",
      userMessage: "hi",
      context: { language: "en", appVersion: "0.0.0", deviceClass: "web" },
    });
    expect(res.content).toBe("hello");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/ai-chat");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(String(init.body)).userMessage).toBe("hi");
  });

  it("attaches the Bearer authToken when provided (spec 018 C4)", async () => {
    const fetchMock = vi.fn(async (_url?: unknown, _init?: RequestInit) => Response.json({ content: "x" }));
    vi.stubGlobal("fetch", fetchMock);
    await sendAiMessage({ messages: [] } as never, { authToken: "tok-1" });
    expect(
      (fetchMock.mock.calls[0] as unknown[])[1] &&
        ((fetchMock.mock.calls[0] as unknown[])[1] as RequestInit).headers,
    ).toMatchObject({ Authorization: "Bearer tok-1" });
  });

  it("honours an edgeFunctionUrl override", async () => {
    const fetchMock = vi.fn(async (_url?: unknown, _init?: RequestInit) => Response.json({ content: "x" }));
    vi.stubGlobal("fetch", fetchMock);
    await sendAiMessage({ messages: [] } as never, { edgeFunctionUrl: "https://fn.example/v1/chat" });
    expect((fetchMock.mock.calls[0] as unknown[])[0]).toBe("https://fn.example/v1/chat");
  });

  it("throws with the status on non-OK responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 502, statusText: "Bad Gateway" })));
    await expect(sendAiMessage({ messages: [] } as never)).rejects.toThrow(/502/);
  });
});

describe("streamAiMessage", () => {
  const request = { messages: [{ role: "user", content: "hi" }] } as never;

  it("returns immediately for an already-aborted signal", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    controller.abort();
    const seen: AiResponseDelta[] = [];
    for await (const delta of streamAiMessage(request, { signal: controller.signal })) {
      seen.push(delta);
    }
    expect(seen).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parses data: events and stops at done:true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          'data: {"delta":"Hel","done":false}\n\n',
          'data: {"delta":"lo"}\n\n',
          'data: {"done":true,"usage":{"promptTokens":1,"completionTokens":2}}\n\n',
          'data: {"delta":"NEVER"}\n\n',
        ]),
      ),
    );
    const seen: AiResponseDelta[] = [];
    for await (const delta of streamAiMessage(request)) seen.push(delta);
    expect(seen.map((d) => d.delta).filter(Boolean)).toEqual(["Hel", "lo"]);
    expect(seen[2].done).toBe(true);
    expect(seen[2].usage).toEqual({ promptTokens: 1, completionTokens: 2 });
  });

  it("handles payloads split across chunk boundaries", async () => {
    // One JSON event deliberately cut mid-body between two network chunks.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse(['data: {"del', 'ta":"split"}\n\ndata: [DONE]\n\n']),
      ),
    );
    const seen: string[] = [];
    for await (const delta of streamAiMessage(request)) {
      if (delta.delta) seen.push(delta.delta);
    }
    expect(seen).toEqual(["split"]);
  });

  it("skips malformed chunks instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse(['data: {broken json}\n\ndata: {"delta":"ok"}\n\n']),
      ),
    );
    const seen: string[] = [];
    for await (const delta of streamAiMessage(request)) {
      if (delta.delta) seen.push(delta.delta);
    }
    expect(seen).toEqual(["ok"]);
  });

  it("throws when the stream response is not OK", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("err", { status: 500, statusText: "ISE" })),
    );
    const seen: AiResponseDelta[] = [];
    await expect(async () => {
      for await (const d of streamAiMessage(request, { edgeFunctionUrl: "/x" })) seen.push(d);
    }).rejects.toThrow(/500/);
    expect(seen).toEqual([]);
  });
});
