/**
 * Spec 017 — PuterProvider adapter (NOT WIRED in 3a).
 *
 * Wraps the six Puter call sites (`assistant.ts:170,269-272,277,297,351-355,451-540`)
 * behind the `AIProvider` interface. This file is **adapter code**, not
 * orchestration: it owns retry/timeout/breaker state, the per-model 402 gate,
 * model resolution, and `AbortSignal → Cancelled` translation. It does NOT
 * know about other providers or the policy.
 *
 * Commit 3a constraint: this file does NOT import `assistant.ts` and is NOT
 * imported by `assistant.ts`. Wiring happens in Commit 3b.
 *
 * Spec anchors:
 *   §3.2  — retry/timeout/breaker are adapter-internal
 *   §3.4  — Puter→RateLimited does not exist (mock-only)
 *   §3.7  — PuterProvider owns the 402 gate and abort-race regression
 *   AC4   — breaker state per-provider
 *   AC14  — abort-mid-stream → Cancelled (no breaker tick)
 *   AC20  — retry/timeout/breaker stay inside the adapter
 *   AC21  — puterFundsDepletedModel short-circuits with zero SDK calls
 */

import { asErrorMessage, isClaudeLikeModel, isPuterModelNotAvailableError, isPuterTransportError } from '../errors';
import {
  isPuterCircuitOpen,
  notePuterTransportFailure,
  withPuterRetry,
  withTimeout,
} from '../circuit-breaker';
import {
  assertPuterSignedIn,
  extractPuterChatText,
  extractPuterChunkText,
  getPuterClient,
  hasAsyncIterator,
  resolvePuterModel,
} from '../puter-client';
import type { PuterClientLike } from '../puter-client';
import { classifyPuterError } from './errors';
import type {
  AIProvider,
  AdapterResult,
  ChatRequest,
  CompletionRequest,
  NormalizedError,
  NormalizedErrorKind,
} from './types';

// ---------------------------------------------------------------------------
// Per-model 402 gate (spec AC21, semantics preserved from assistant.ts:59-67).
// Module-scoped for now (spec §3.7 + AC4 note); only one PuterProvider instance
// is registered today, so module scope == instance scope. A future multi-
// instance setup can lift this into a `PuterBreakerState` per-instance via a
// WeakMap keyed by `this`.
// ---------------------------------------------------------------------------

let puterFundsDepletedModel: string | null = null;

/**
 * Test-only setter. Allows `puter-provider.test.ts` to assert the AC21
 * short-circuit without going through real Puter SDK failures. Production
 * code MUST NOT call this — it is only exported for tests.
 */
export const __setPuterFundsDepletedModelForTests = (model: string | null) => {
  puterFundsDepletedModel = model;
};

const isPuterFundsDepletedForModel = (model?: string) => {
  if (puterFundsDepletedModel === null) return false;
  return (model || 'gpt-5.4-nano').toLowerCase() === puterFundsDepletedModel;
};

const clearPuterFundsDepleted = () => {
  puterFundsDepletedModel = null;
};

// ---------------------------------------------------------------------------
// Internal helpers — wrap thrown errors into NormalizedError using the
// taxonomy in providers/errors.ts. The AbortSignal check happens FIRST in
// every catch that could fire mid-stream (AC14 abort-race).
// ---------------------------------------------------------------------------

const makeNormalized = (
  kind: NormalizedErrorKind,
  cause: unknown,
  providerId: string,
): NormalizedError => {
  const err = new Error(asErrorMessage(cause)) as NormalizedError;
  err.name = kind;
  err.kind = kind;
  err.providerId = providerId;
  err.cause = cause;
  return err;
};

/** Returns true when the throw is actually an AbortSignal (or a wrapped AbortError). */
const isAbortSignalThrow = (error: unknown, signal: AbortSignal): boolean => {
  if (signal.aborted) return true;
  if (error instanceof Error && error.name === 'AbortError') return true;
  // Some environments wrap `DOMException` whose name is 'AbortError'.
  return false;
};

/** Same classifier order as the providers/errors.ts wrapper, used internally
 *  for inner throws that have NOT yet been wrapped (e.g. async-iterator .next()). */
const classifyInnerThrow = (
  error: unknown,
  providerId: string,
  signal: AbortSignal,
): NormalizedError => {
  if (isAbortSignalThrow(error, signal)) {
    return makeNormalized('Cancelled', error, providerId);
  }
  return classifyPuterError(error, providerId);
};

// ---------------------------------------------------------------------------
// PuterProvider — AIProvider implementation for Puter.
// ---------------------------------------------------------------------------

export interface PuterProviderOptions {
  /** Test seam: override the Puter client with a stubbed SDK. */
  getClient?: () => Promise<PuterClientLike | null>;
}

export class PuterProvider implements AIProvider {
  public readonly id = 'puter';

  private readonly opts: PuterProviderOptions;

  constructor(opts: PuterProviderOptions = {}) {
    this.opts = opts;
  }

  /**
   * Cheap synchronous "is this provider usable right now?" check used by the
   * policy's `available()` slot. Returns false synchronously when:
   *   - Puter is unset on the client (no SDK import)
   *   - the user's selected model has a stuck 402 (AC21 short-circuit)
   *   - the circuit breaker window is currently open for this provider
   *
   * Note: the existing `isPuterCircuitOpen()` reads a module-scoped timer
   * (circuit-breaker.ts). With a single registered PuterProvider (today),
   * module-scope == instance-scope; AC4's "per-provider state" is realized
   * by instance-level breaker bookkeeping added in 3b if multi-instance
   * registration ever lands.
   */
  async available(): Promise<boolean> {
    if (isPuterCircuitOpen()) return false;

    // AC21 short-circuit: If we owe a 402 for this model, the SDK must NOT
    // be called. Test setter mirrors the production flag.
    const depleted = puterFundsDepletedModel;
    if (depleted !== null) return false;

    try {
      const client = await this.getClient();
      if (!client) return false;
      return Boolean(client.auth?.isSignedIn?.());
    } catch {
      return false;
    }
  }

  /**
   * Streaming chat. Mirrors the spec-011 flow:
   *   - request `stream: true` from `puter.ai.chat`
   *   - iterate async chunks; first chunk emits `onFirstToken` (the policy
   *     treats that as the lock and will not switch providers after)
   *   - if a throw lands during iteration AND signal.aborted → Cancelled
   *     (AC14 abort-race; breaker does NOT tick)
   *   - transport-classified throws before first-token are wrapped to
   *     NormalizedError(kind: 'Unavailable') and bubble up; the policy
   *     decides whether to fall back; on the way out, `notePuterTransportFailure`
   *     ticks the breaker (matches existing semantics; AC20 keeps the
   *     call inside the adapter)
   *   - any other throw → NormalizedError kind per providers/errors.ts
   *
   * Returns the final accumulated text on success.
   */
  async stream(req: ChatRequest): Promise<string> {
    const signal = req.signal;
    // AC14: if already aborted before any SDK call, short-circuit immediately.
    if (signal.aborted) {
      throw makeNormalized('Cancelled', new Error('Aborted'), this.id);
    }
    const client = await this.requireClient(req.model);
    const model = await this.resolveModel(client, req.model);
    const prompt = req.prompt;

    if (isClaudeLikeModel(model)) {
      try {
        assertPuterSignedIn(client);
      } catch (error) {
        throw classifyPuterError(error, this.id);
      }
    }

    // Inner call: wrapped in retry + timeout. The breaker's pre-first-token
    // throw is the trigger the policy uses to fall back.
    const inner = async () => {
      const response = await withTimeout(
        client.ai.chat(prompt, { model, stream: true }),
        30_000,
        'Request timed out',
      );
      if (!hasAsyncIterator(response)) {
        // Provider declined to stream; consume the full text as a single delta.
        const fullText = await extractPuterChatText(response);
        req.onDelta(fullText);
        req.onFirstToken();
        return fullText;
      }

      const iterator = response[Symbol.asyncIterator]();
      let full = '';
      let first = true;
      try {
        // First .next() with its own timeout.
        const next = await withTimeout(iterator.next(), 30_000, 'Request timed out');
        // Throws inside this loop MUST be classified with AbortSignal first
        // (AC14). The `notePuterTransportFailure` tick is conditional on
        // !signal.aborted to prevent the abort-race misclassification that
        // spec 011 did not isolate.
        for (;;) {
          if (next.done) break;
          const delta = extractPuterChunkText(next.value);
          if (delta) {
            full += delta;
            req.onDelta(full);
          }
          if (first && full) {
            req.onFirstToken();
            first = false;
          }
          const n = await iterator.next();
          if (n.done) break;
          // Replace loop var — keep going.
          Object.assign(next, n);
        }
        if (first && full) {
          // Empty-content first chunk — still treat as the first token.
          req.onFirstToken();
          first = false;
        }
        return full;
      } catch (error) {
        if (isAbortSignalThrow(error, signal)) {
          // AC14 — abort wins, breaker does NOT tick.
          throw makeNormalized('Cancelled', error, this.id);
        }
        if (!full) {
          // Pre-first-token — classify + tick breaker for transport-classified
          // errors only (preserves `circuit-breaker.ts` semantics).
          if (isPuterTransportError(error)) {
            notePuterTransportFailure(error);
          }
        }
        // Always surface a NormalizedError to the policy so the caller never
        // branches on opaque SDK shapes.
        throw classifyInnerThrow(error, this.id, signal);
      } finally {
        try {
          await iterator.return?.(undefined);
        } catch {
          // ignore
        }
      }
    };

    try {
      return await withPuterRetry(inner, { maxAttempts: 3, baseDelayMs: 500 });
    } catch (error) {
      // Anything that bubbles out of the inner is classified here. AbortSignal
      // always wins (AC14) — pre-first-token OR mid-stream, same policy.
      if (isAbortSignalThrow(error, signal)) {
        throw makeNormalized('Cancelled', error, this.id);
      }
      // For transport-classified throws before any chunk landed, we tick the
      // breaker (matches circuit-breaker.ts semantics). Mid-stream this is
      // already handled inside `inner`.
      if (isPuterTransportError(error)) {
        notePuterTransportFailure(error);
      }
      throw classifyInnerThrow(error, this.id, signal);
    }
  }

  /**
   * One-shot completion (spec §3.3 — serves summarize / generateQuiz).
   * Same retry+timeout+breaker wrapping as `stream`, but `stream: false` and
   * `CompletionRequest.onPartial` is currently a no-op for Puter (the SDK
   * returns a single string-or-object).
   */
  async complete(req: CompletionRequest): Promise<AdapterResult> {
    const signal = req.signal;
    // AC14: if already aborted before any SDK call, short-circuit immediately.
    if (signal.aborted) {
      throw makeNormalized('Cancelled', new Error('Aborted'), this.id);
    }
    const client = await this.requireClient(req.model);
    const model = await this.resolveModel(client, req.model);
    const prompt = req.prompt;

    const inner = async (): Promise<AdapterResult> => {
      const response = await withTimeout(
        client.ai.chat(prompt, { model, stream: false }),
        30_000,
        'Request timed out',
      );

      const text = await extractPuterChatText(response);
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = undefined;
      }
      return { text, parsed };
    };

    try {
      return await withPuterRetry(inner, { maxAttempts: 3, baseDelayMs: 500 });
    } catch (error) {
      if (isAbortSignalThrow(error, signal)) {
        throw makeNormalized('Cancelled', error, this.id);
      }
      if (isPuterTransportError(error)) {
        notePuterTransportFailure(error);
      }
      throw classifyInnerThrow(error, this.id, signal);
    }
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async getClient(): Promise<PuterClientLike | null> {
    if (this.opts.getClient) return this.opts.getClient();
    return getPuterClient();
  }

  private async requireClient(model: string | undefined): Promise<PuterClientLike> {
    // AC21: short-circuit on the depleted-model flag, zero SDK calls.
    if (isPuterFundsDepletedForModel(model)) {
      throw makeNormalized('QuotaExceeded', undefined, this.id);
    }
    const client = await this.getClient();
    if (!client) {
      throw makeNormalized('Fatal', new Error('Puter client not available'), this.id);
    }
    return client;
  }

  private async resolveModel(
    client: PuterClientLike,
    requested: string | undefined,
  ): Promise<string> {
    try {
      return await resolvePuterModel(client, requested);
    } catch (error) {
      // Model-not-available maps to Fatal and must NOT tick transport breaker.
      if (isPuterModelNotAvailableError(error)) {
        throw classifyPuterError(error, this.id);
      }
      throw classifyPuterError(error, this.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers exported for tests — these keep the adapter code above self-contained
// without leaking provider-internal state. They are imported by
// `puter-provider.test.ts` and `abort-race.test.ts`.
// ---------------------------------------------------------------------------

/**
 * Clear the gate on a successful first-token (mirrors assistant.ts:67 behavior).
 * Tests may need to call this between assertions.
 */
export const __clearPuterFundsDepletedForTests = () => {
  clearPuterFundsDepleted();
};

/** Internal flag reader (tests use `__setPuterFundsDepletedModelForTests` to flip it). */
export const __isPuterFundsDepletedForTests = () => {
  return puterFundsDepletedModel;
};
