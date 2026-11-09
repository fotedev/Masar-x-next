/**
 * Unit tests for ../../ai-chat/pure.ts (spec 040 Wave 6) — the pure helpers
 * extracted from ai-chat/index.ts serve(). The test imports ONLY pure.ts:
 * ai-chat/index.ts snapshots env vars and imports the Gemini SDK at module
 * top level, which the offline harness cannot load.
 * Zero dependencies: plain Deno.test + local assert (runs offline, no stubs).
 */
import {
  acceptsSse,
  findForbiddenHeader,
  FORBIDDEN_HEADERS,
  mapUsage,
  sseFrame,
} from "../../ai-chat/pure.ts";

function assertEquals(actual: unknown, expected: unknown, msg: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function decodeFrame(frame: Uint8Array): string {
  return new TextDecoder().decode(frame);
}

// ---------------------------------------------------------------------------
// Forbidden provider-key headers (trust-boundary check)
// ---------------------------------------------------------------------------

Deno.test("FORBIDDEN_HEADERS: pinned set", () => {
  assertEquals(
    [...FORBIDDEN_HEADERS],
    [
      'x-ai-provider-key',
      'x-openai-api-key',
      'x-anthropic-api-key',
      'x-gemini-api-key',
    ],
    "the exact leak-attempt header list",
  );
});

Deno.test("findForbiddenHeader: first present forbidden header returned", () => {
  assertEquals(
    findForbiddenHeader((n) => ({ 'x-openai-api-key': 'sk-123' }[n] ?? null)),
    'x-openai-api-key',
    "single forbidden header",
  );
  assertEquals(
    findForbiddenHeader((n) => ({
      'x-ai-provider-key': 'a',
      'x-gemini-api-key': 'b',
    }[n] ?? null)),
    'x-ai-provider-key',
    "first in list order wins",
  );
});

Deno.test("findForbiddenHeader: clean request -> null; empty value -> null", () => {
  assertEquals(findForbiddenHeader(() => null), null, "no headers at all");
  assertEquals(
    findForbiddenHeader((n) => ({ 'x-gemini-api-key': '' }[n] ?? null)),
    null,
    "empty header value is not 'present'",
  );
  assertEquals(
    findForbiddenHeader((n) => ({ 'content-type': 'application/json' }[n] ?? null)),
    null,
    "ordinary headers ignored",
  );
});

// ---------------------------------------------------------------------------
// acceptsSse — Accept header parsing
// ---------------------------------------------------------------------------

Deno.test("acceptsSse: exact header the shared client sends", () => {
  assertEquals(acceptsSse("text/event-stream"), true, "plain");
});

Deno.test("acceptsSse: media-range parameters and multi-value lists", () => {
  assertEquals(acceptsSse("text/event-stream;q=0.9"), true, "with ;q= param");
  assertEquals(
    acceptsSse("application/json, text/event-stream;q=0.8"),
    true,
    "multi-value list, sse second",
  );
  assertEquals(
    acceptsSse("text/event-stream, application/json"),
    true,
    "multi-value list, sse first",
  );
  assertEquals(
    acceptsSse("  TEXT/EVENT-STREAM ; charset=utf-8 "),
    true,
    "case-insensitive + whitespace",
  );
});

Deno.test("acceptsSse: non-streaming accepts -> false", () => {
  assertEquals(acceptsSse("application/json"), false, "json only");
  assertEquals(acceptsSse("text/event-streamx"), false, "prefix does not count");
  assertEquals(acceptsSse("*/*"), false, "wildcard does not opt into sse");
  assertEquals(acceptsSse(null), false, "no Accept header");
  assertEquals(acceptsSse(""), false, "empty header");
});

// ---------------------------------------------------------------------------
// sseFrame encoding
// ---------------------------------------------------------------------------

Deno.test("sseFrame: `data: <payload>` + blank line", () => {
  assertEquals(decodeFrame(sseFrame('{"delta":"hi","done":false}')), 'data: {"delta":"hi","done":false}\n\n', "frame bytes");
  assertEquals(decodeFrame(sseFrame("[DONE]")), "data: [DONE]\n\n", "sentinel frame");
});

Deno.test("sseFrame: JSON payloads never contain raw newlines (single data: line)", () => {
  const frame = decodeFrame(sseFrame(JSON.stringify({ delta: "line1\nline2", done: false })));
  assertEquals(
    frame.startsWith("data: {\"delta\":\"line1\\nline2\",\"done\":false}\n\n"),
    true,
    "newline escaped by JSON.stringify, frame stays one data: line",
  );
});

// ---------------------------------------------------------------------------
// mapUsage — Gemini usageMetadata -> contract usage
// ---------------------------------------------------------------------------

Deno.test("mapUsage: maps promptTokenCount/candidatesTokenCount -> promptTokens/completionTokens", () => {
  assertEquals(
    mapUsage({ promptTokenCount: 12, candidatesTokenCount: 34 }),
    { promptTokens: 12, completionTokens: 34 },
    "full metadata",
  );
});

Deno.test("mapUsage: absent fields and absent metadata zero out", () => {
  assertEquals(
    mapUsage({ promptTokenCount: 7 }),
    { promptTokens: 7, completionTokens: 0 },
    "missing candidatesTokenCount",
  );
  assertEquals(
    mapUsage(null),
    { promptTokens: 0, completionTokens: 0 },
    "null metadata",
  );
  assertEquals(
    mapUsage(undefined),
    { promptTokens: 0, completionTokens: 0 },
    "undefined metadata",
  );
  assertEquals(
    mapUsage({}),
    { promptTokens: 0, completionTokens: 0 },
    "empty metadata object",
  );
});
