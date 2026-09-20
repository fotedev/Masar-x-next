import { describe, expect, it } from 'vitest';

import { consumeTextStream } from '../ai/stream-reader';

const textDecoder = new TextEncoder();

const streamOf = (...chunks: string[]): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(textDecoder.encode(chunk));
      }
      controller.close();
    },
  });

const responseWith = (body: ReadableStream<Uint8Array>): Response =>
  new Response(body, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

describe('consumeTextStream (spec 011 — server fallback fix)', () => {
  it('accumulates chunked UTF-8 text into the full reply', async () => {
    const response = responseWith(streamOf('Hello, ', 'سلام ', 'world'));
    await expect(consumeTextStream(response)).resolves.toBe('Hello, سلام world');
  });

  it('reports incremental progress through onDelta in arrival order', async () => {
    const seen: string[] = [];
    const response = responseWith(streamOf('a', 'bc', 'd'));
    const full = await consumeTextStream(response, (soFar) => seen.push(soFar));
    expect(full).toBe('abcd');
    expect(seen).toEqual(['a', 'abc', 'abcd']);
  });

  it('splits a multi-byte UTF-8 character across chunks without corruption', async () => {
    // 'س' encoded then split mid-codepoint
    const bytes = textDecoder.encode('س');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 1));
        controller.enqueue(bytes.slice(1));
        controller.close();
      },
    });
    await expect(consumeTextStream(responseWith(stream))).resolves.toBe('س');
  });

  it('returns response.text() when no body is present', async () => {
    const response = new Response('plain', { status: 200 });
    Object.defineProperty(response, 'body', { value: null });
    await expect(consumeTextStream(response)).resolves.toBe('plain');
  });

  it('returns empty string for an empty stream', async () => {
    await expect(consumeTextStream(responseWith(streamOf()))).resolves.toBe('');
  });
});
