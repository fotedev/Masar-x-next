/**
 * Spec 017 — MockProvider (test-only).
 *
 * Deterministic canned streams + switchable failure modes + slow (for abort
 * tests). Production guard at module top: throws if NODE_ENV === 'production'.
 * Registry guard (registry.ts) refuses to include a MockProvider in the
 * ordered list unless NEXT_PUBLIC_AI_PROVIDER_DEBUG === 'mock' AND
 * NODE_ENV !== 'production'. Tests import `createMockProvider` directly.
 */

import type {
  AIProvider,
  AdapterResult,
  ChatRequest,
  CompletionRequest,
  NormalizedError,
} from './types';
import { isNormalizedError } from './types';

/** Production guard — module top. */
if (process.env.NODE_ENV === 'production') {
  throw new Error('MockProvider must not be imported in production builds');
}

/**
 * Mock mode shapes. Streaming variants (default) and completion variants
 * (selected when `kind: 'completion-ok'` etc.) — completion is separate
 * so policy tests can exercise `complete` without conflating it with
 * `stream` first-token semantics.
 */
export type MockMode =
  | { kind: 'ok'; chunks: string[] }
  | { kind: 'fail-before-first-token'; error: NormalizedError }
  | {
      kind: 'fail-mid-stream';
      /** Chunks to emit before throwing. Must be ≥ 1. */
      chunks: string[];
      error: NormalizedError;
    }
  | { kind: 'slow'; delayMsPerChunk: number; chunks: string[] }
  | { kind: 'completion-ok'; json: string }
  | { kind: 'completion-fail'; error: NormalizedError };

export interface MockProviderOptions {
  id?: string;
  mode: MockMode;
  /** If true, available() returns false (simulate provider disabled). */
  unavailable?: boolean;
}

/** Factory for a MockProvider. Throws in production builds (see top of file). */
export const createMockProvider = (opts: MockProviderOptions): AIProvider => {
  // Re-check at construction time too, in case the module was imported in a
  // context where the top-level guard was bypassed (e.g. bundler tree-shaking).
  if (process.env.NODE_ENV === 'production') {
    throw new Error('MockProvider must not be constructed in production builds');
  }

  const id = opts.id ?? 'mock';

  return {
    id,

    async stream(req: ChatRequest): Promise<string> {
      if (opts.unavailable) {
        // Pretend we're not available — but we already got the stream call,
        // so behave like the policy engine skipped us and we never ran.
        // For determinism in tests, just throw a Fatal-like "skipped" error.
        throw new Error('MockProvider: available() returned false; should not be called');
      }

      const mode = opts.mode;
      if (mode.kind === 'completion-ok' || mode.kind === 'completion-fail') {
        // Completion-only mode invoked on stream — surface as Fatal for clarity.
        throw new Error('MockProvider: completion mode invoked on stream()');
      }

      if (mode.kind === 'fail-before-first-token') {
        if (!isNormalizedError(mode.error)) {
          throw new Error('MockProvider: fail-before-first-token error must be a NormalizedError');
        }
        throw mode.error;
      }

      if (mode.kind === 'slow') {
        let full = '';
        for (const chunk of mode.chunks) {
          if (req.signal.aborted) {
            throw makeAborted(id);
          }
          await sleep(mode.delayMsPerChunk);
          if (req.signal.aborted) {
            throw makeAborted(id);
          }
          full += chunk;
          req.onDelta(full);
        }
        return full;
      }

      // 'ok' or 'fail-mid-stream'
      let full = '';
      let emitted = 0;
      const chunks: string[] = mode.kind === 'ok' ? mode.chunks : mode.chunks;

      for (let i = 0; i < chunks.length; i++) {
        if (req.signal.aborted) throw makeAborted(id);
        const delta = chunks[i];
        full += delta;
        emitted += 1;
        // First-token signal: only after first delta.
        if (emitted === 1) {
          // onFirstToken is called by the policy AFTER it observes the first delta;
          // the adapter's job is just to emit deltas. The signal is implicit in
          // the first call to onDelta. We deliberately do NOT call onFirstToken
          // here — the policy detects first-token from the first onDelta.
        }
        req.onDelta(full);

        // fail-mid-stream: after emitting all of `mode.chunks`, throw.
        if (mode.kind === 'fail-mid-stream' && emitted === chunks.length) {
          if (!isNormalizedError(mode.error)) {
            throw new Error('MockProvider: fail-mid-stream error must be a NormalizedError');
          }
          throw mode.error;
        }
      }

      // 'ok' reaches here.
      if (mode.kind === 'ok') return full;
      // Defensive — 'fail-mid-stream' should have thrown above.
      throw new Error('MockProvider: unexpected end of stream');
    },

    async complete(req: CompletionRequest): Promise<AdapterResult> {
      if (opts.unavailable) {
        throw new Error('MockProvider: available() returned false; should not be called');
      }

      const mode = opts.mode;

      if (mode.kind === 'fail-before-first-token' || mode.kind === 'completion-fail') {
        if (!isNormalizedError(mode.error)) {
          throw new Error('MockProvider: completion-fail error must be a NormalizedError');
        }
        throw mode.error;
      }

      if (mode.kind === 'ok' || mode.kind === 'fail-mid-stream' || mode.kind === 'slow') {
        throw new Error('MockProvider: streaming mode invoked on complete()');
      }

      // completion-ok
      if (req.signal.aborted) throw makeAborted(id);
      // Try JSON.parse for the `parsed` field; if it isn't JSON, `parsed` stays undefined.
      let parsed: unknown;
      try {
        parsed = JSON.parse(mode.json);
      } catch {
        parsed = undefined;
      }
      return { text: mode.json, parsed };
    },

    async available(): Promise<boolean> {
      return !opts.unavailable;
    },
  };
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const makeAborted = (providerId: string): NormalizedError => {
  const err = new Error('aborted') as NormalizedError;
  err.name = 'Cancelled';
  err.kind = 'Cancelled';
  err.providerId = providerId;
  return err;
};
