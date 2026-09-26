/**
 * Spec 017 — MockProvider tests.
 *
 * Covers spec §5.1 mock-provider.test.ts:
 *   - All four streaming modes (ok, fail-before-first-token, fail-mid-stream, slow)
 *   - Completion mode (completion-ok)
 *   - Production guard (AC10)
 *   - Slow + abort → Cancelled (AC14 abort-race)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockProvider } from '../mock-provider';
import type { ChatRequest, CompletionRequest, NormalizedError } from '../types';

const ne = (kind: NormalizedError['kind']): NormalizedError => {
  const e = new Error(kind) as NormalizedError;
  e.kind = kind;
  e.providerId = 'mock';
  return e;
};

const makeChatReq = (signal: AbortSignal): ChatRequest => {
  const deltas: string[] = [];
  return {
    prompt: 'hi',
    mode: 'cs_assistant',
    signal,
    onDelta: (full) => deltas.push(full),
    onFirstToken: () => {},
  };
};

const makeCompletionReq = (signal: AbortSignal): CompletionRequest => ({
  prompt: 'generate a quiz',
  mode: 'cs_assistant',
  signal,
});

describe('createMockProvider (spec 017)', () => {
  describe('streaming — ok mode', () => {
    it('emits deltas and resolves to concatenated text', async () => {
      const provider = createMockProvider({ mode: { kind: 'ok', chunks: ['a', 'b', 'c'] } });
      const ac = new AbortController();
      const req = makeChatReq(ac.signal);
      const result = await provider.stream(req);
      expect(result).toBe('abc');
    });
  });

  describe('streaming — fail-before-first-token', () => {
    it('throws the supplied error before any delta', async () => {
      const provider = createMockProvider({
        mode: { kind: 'fail-before-first-token', error: ne('QuotaExceeded') },
      });
      const ac = new AbortController();
      const req = makeChatReq(ac.signal);
      await expect(provider.stream(req)).rejects.toMatchObject({ kind: 'QuotaExceeded' });
    });
  });

  describe('streaming — fail-mid-stream', () => {
    it('emits all chunks then throws', async () => {
      const provider = createMockProvider({
        mode: { kind: 'fail-mid-stream', chunks: ['a', 'b'], error: ne('Unavailable') },
      });
      const ac = new AbortController();
      const deltas: string[] = [];
      const req: ChatRequest = {
        prompt: 'hi',
        mode: 'cs_assistant',
        signal: ac.signal,
        onDelta: (full) => deltas.push(full),
        onFirstToken: () => {},
      };
      await expect(provider.stream(req)).rejects.toMatchObject({ kind: 'Unavailable' });
      expect(deltas).toEqual(['a', 'ab']);
    });
  });

  describe('streaming — slow mode + abort', () => {
    it('aborts during a slow chunk → Cancelled (AC14)', async () => {
      const provider = createMockProvider({
        mode: { kind: 'slow', delayMsPerChunk: 20, chunks: ['a', 'b', 'c'] },
      });
      const ac = new AbortController();
      const deltas: string[] = [];
      const req: ChatRequest = {
        prompt: 'hi',
        mode: 'cs_assistant',
        signal: ac.signal,
        onDelta: (full) => deltas.push(full),
        onFirstToken: () => {},
      };
      // Abort before any sleep resolves; first chunk fires, then abort lands.
      const promise = provider.stream(req);
      // Give the first chunk a chance to land; second sleep is when abort hits.
      setTimeout(() => ac.abort(), 25);
      await expect(promise).rejects.toMatchObject({ kind: 'Cancelled' });
      // At least one delta landed before abort.
      expect(deltas.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('completion — ok mode', () => {
    it('resolves to AdapterResult with text + parsed JSON', async () => {
      const provider = createMockProvider({
        mode: { kind: 'completion-ok', json: '{"title":"t","questions":[]}' },
      });
      const ac = new AbortController();
      const result = await provider.complete(makeCompletionReq(ac.signal));
      expect(result.text).toBe('{"title":"t","questions":[]}');
      expect(result.parsed).toEqual({ title: 't', questions: [] });
    });

    it('non-JSON completion: parsed is undefined', async () => {
      const provider = createMockProvider({
        mode: { kind: 'completion-ok', json: 'plain text reply' },
      });
      const ac = new AbortController();
      const result = await provider.complete(makeCompletionReq(ac.signal));
      expect(result.text).toBe('plain text reply');
      expect(result.parsed).toBeUndefined();
    });
  });

  describe('completion — fail mode', () => {
    it('throws the supplied error', async () => {
      const provider = createMockProvider({
        mode: { kind: 'completion-fail', error: ne('Fatal') },
      });
      const ac = new AbortController();
      await expect(provider.complete(makeCompletionReq(ac.signal))).rejects.toMatchObject({
        kind: 'Fatal',
      });
    });
  });

  describe('available()', () => {
    it('returns true by default', async () => {
      const provider = createMockProvider({ mode: { kind: 'ok', chunks: [] } });
      expect(await provider.available()).toBe(true);
    });

    it('returns false when unavailable is set', async () => {
      const provider = createMockProvider({
        mode: { kind: 'ok', chunks: [] },
        unavailable: true,
      });
      expect(await provider.available()).toBe(false);
    });
  });

  describe('production guard (AC10)', () => {
    beforeEach(() => {
      vi.unstubAllEnvs();
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('throws when NODE_ENV=production at construction', () => {
      vi.stubEnv('NODE_ENV', 'production');
      expect(() =>
        createMockProvider({ mode: { kind: 'ok', chunks: [] } }),
      ).toThrow(/MockProvider must not be constructed/);
    });
  });
});
