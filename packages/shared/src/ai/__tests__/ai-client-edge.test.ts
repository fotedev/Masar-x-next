import { afterEach, describe, expect, it, vi } from 'vitest';

import { sendAiMessage, streamAiMessage } from '../index';
import type { AiRequest, AiResponseDelta } from '../types';

const req = (): AiRequest => ({
  conversationId: 'conv-1',
  userMessage: 'hi',
  context: { language: 'en', appVersion: '0.0.0', deviceClass: 'web' },
});

// Spec 040 — edge branches of the cross-platform AI client that the
// original suite skipped: non-JSON 2xx bodies (unguarded response.json())
// and abort-mid-stream (reader.releaseLock path).

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('sendAiMessage: 2xx with a non-JSON body', () => {
  it('rejects instead of hanging (response.json() is unguarded — pins current behavior)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response('<html>gateway error page</html>', { status: 200 }) as unknown as Response,
      ),
    );
    await expect(sendAiMessage(req())).rejects.toThrow();
  });
});

describe('streamAiMessage: abort mid-stream', () => {
  it('rejects with the abort error and never yields after the abort', async () => {
    const controller = new AbortController();
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(
          new TextEncoder().encode('data: {"delta":"first","done":false}\n\n'),
        );
        // Abort after the first chunk lands; a real Response wires the
        // signal into the body stream so reader.read() rejects.
        setTimeout(() => {
          controller.abort();
          c.error(new Error('The operation was aborted'));
        }, 5);
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return {
          ok: true,
          body: stream,
          status: 200,
          statusText: 'OK',
        } as unknown as Response;
      }),
    );

    const deltas: AiResponseDelta[] = [];
    await expect(async () => {
      for await (const delta of streamAiMessage(
        req(),
        { signal: controller.signal },
      )) {
        deltas.push(delta);
      }
    }).rejects.toThrow();
    expect(deltas).toHaveLength(1);
    expect(deltas[0].delta).toBe('first');
  });

  it('releaseLock runs on the success path too (stream completes cleanly)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const stream = new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(
              new TextEncoder().encode(
                'data: {"delta":"a","done":false}\n\ndata: {"done":true,"usage":{"total":1}}\n\n',
              ),
            );
            c.close();
          },
        });
        return { ok: true, body: stream } as unknown as Response;
      }),
    );
    const deltas: AiResponseDelta[] = [];
    for await (const delta of streamAiMessage(req())) {
      deltas.push(delta);
    }
    expect(deltas).toHaveLength(2);
    expect(deltas[1].done).toBe(true);
  });

  it('returns without consuming when the signal is already aborted (regression lock)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const controller = new AbortController();
    controller.abort();
    const deltas: AiResponseDelta[] = [];
    for await (const delta of streamAiMessage(
      req(),
      { signal: controller.signal },
    )) {
      deltas.push(delta);
    }
    expect(deltas).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
