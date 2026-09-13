/**
 * Transport resilience for Puter AI calls (spec 004).
 *
 * A circuit breaker opens for 45s after two transport failures inside a
 * 60s window, so a broken socket.io session produces one user-facing
 * "service unavailable" reply instead of failing every message. Retry
 * with exponential backoff covers transient drops; model-availability
 * errors are never retried (they need a model switch, not time).
 */

import { logger } from '@/lib/logger';
import {
  asErrorMessage,
  isPuterModelNotAvailableError,
  isPuterTransportError,
} from './errors';

export const PUTER_UNAVAILABLE_UNTIL_KEY = 'puter_unavailable_until';

const PUTER_UNAVAILABLE_MESSAGE_AR = '⚠️ خدمة الذكاء الاصطناعي غير متاحة حالياً. حاول لاحقاً.';
const PUTER_UNAVAILABLE_MESSAGE_EN = '⚠️ AI service is temporarily unavailable. Please try again later.';

let puterCircuitOpenUntilMs = 0;
let puterTransportFailureCount = 0;
let puterLastTransportFailureAtMs = 0;
let puterLastCircuitLogAtMs = 0;

export const isPuterCircuitOpen = () => Date.now() < puterCircuitOpenUntilMs;

export const getPuterUnavailableMessage = () =>
  `${PUTER_UNAVAILABLE_MESSAGE_AR}\n\n${PUTER_UNAVAILABLE_MESSAGE_EN}`;

export const notePuterTransportFailure = (error: unknown) => {
  if (!isPuterTransportError(error)) return;

  const now = Date.now();
  const sinceLast = now - (puterLastTransportFailureAtMs || 0);
  const withinWindow = sinceLast >= 0 && sinceLast < 60_000;
  puterTransportFailureCount = withinWindow ? puterTransportFailureCount + 1 : 1;
  puterLastTransportFailureAtMs = now;

  if (puterTransportFailureCount >= 2) {
    puterCircuitOpenUntilMs = now + 45_000;
    if (now - puterLastCircuitLogAtMs > 45_000) {
      puterLastCircuitLogAtMs = now;
      logger.warn('Puter transport unavailable; opening circuit breaker', {
        openUntil: new Date(puterCircuitOpenUntilMs).toISOString(),
        error: asErrorMessage(error),
      });
    }
  }
};

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number = 30000,
  timeoutMessage: string = 'Request timed out'
): Promise<T> => {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
};

export const withPuterRetry = async <T>(
  fn: () => Promise<T>,
  opts?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    onRetry?: (error: unknown, attempt: number) => void;
  },
): Promise<T> => {
  const maxAttempts = Math.max(1, Math.min(5, opts?.maxAttempts ?? 3));
  const baseDelayMs = Math.max(200, opts?.baseDelayMs ?? 500);

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fn();
      puterTransportFailureCount = 0;
      puterLastTransportFailureAtMs = 0;
      return res;
    } catch (e) {
      lastError = e;
      if (isPuterModelNotAvailableError(e)) break;
      if (!isPuterTransportError(e) || attempt >= maxAttempts) break;

      if (opts?.onRetry) {
        opts.onRetry(e, attempt);
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }

  throw lastError;
};
