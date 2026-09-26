/**
 * Spec 017 — Puter → NormalizedError classifier (Commit 3a).
 *
 * Single mapping point from opaque Puter SDK throws to the
 * provider-agnostic `NormalizedError` taxonomy in `./types`. The adapter
 * (`puter-provider.ts`) calls this for every non-abort throw so the policy
 * (3b) never branches on SDK shapes.
 *
 * Order matters (first match wins):
 *   1. insufficient_funds → `QuotaExceeded` (AC21 billing gate)
 *   2. auth / not-signed-in → `AuthRequired`
 *   3. model-not-available → `Fatal` (never ticks the transport breaker)
 *   4. transport → `Unavailable` (policy may fall back; breaker ticks)
 *   5. fallback → `Fatal`
 *
 * Spec §3.4: Puter never maps to `RateLimited` (mock-only kind).
 */

import {
  asErrorMessage,
  isPuterAuthError,
  isPuterInsufficientFundsError,
  isPuterModelNotAvailableError,
  isPuterTransportError,
} from '../errors';
import type { NormalizedError, NormalizedErrorKind } from './types';

const toNormalized = (
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

/**
 * Map an opaque Puter SDK throw to a `NormalizedError`.
 * Never returns `RateLimited` — that kind is mock-only (spec §3.4).
 */
export const classifyPuterError = (
  error: unknown,
  providerId: string,
): NormalizedError => {
  if (isPuterInsufficientFundsError(error)) {
    return toNormalized('QuotaExceeded', error, providerId);
  }
  if (isPuterAuthError(error)) {
    return toNormalized('AuthRequired', error, providerId);
  }
  if (isPuterModelNotAvailableError(error)) {
    return toNormalized('Fatal', error, providerId);
  }
  if (isPuterTransportError(error)) {
    return toNormalized('Unavailable', error, providerId);
  }
  return toNormalized('Fatal', error, providerId);
};
