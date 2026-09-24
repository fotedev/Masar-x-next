/**
 * Spec 017 — error taxonomy + Puter mapping.
 *
 * The 5-name taxonomy is fixed by spec §3.4:
 *   QuotaExceeded | RateLimited | Unavailable | Fatal | Cancelled
 *
 * Reuses the existing classifiers in `../errors.ts` for QuotaExceeded /
 * Unavailable / Fatal (no behavioral change to those classifiers). Adds the
 * new RateLimited rule (mock-only emission today — no Puter→RateLimited
 * mapping exists in the current code, per spec §3.4 owner note 4).
 *
 * Adapters call `classifyPuterError(err, providerId)` to wrap any thrown
 * error into a `NormalizedError` with a known `kind`.
 */

import {
  asErrorMessage,
  isPuterInsufficientFundsError,
  isPuterModelNotAvailableError,
  isPuterAuthError,
  isPuterTransportError,
} from '../errors';
import {
  isNormalizedError,
  type NormalizedError,
  type NormalizedErrorKind,
} from './types';

export type { NormalizedError, NormalizedErrorKind } from './types';
export { isNormalizedError, isFallbackEligible } from './types';

/**
 * Wrap any thrown error into a `NormalizedError` with a known `kind`.
 *
 * Order matters: each classifier is checked in turn and the first match
 * wins. `Cancelled` (signal aborted) is checked first because the AbortSignal
 * can race with any of the other classifiers (spec §3.4 abort-race regression).
 */
export const classifyPuterError = (
  error: unknown,
  providerId: string,
): NormalizedError => {
  // If the caller already normalized it, pass through (idempotent).
  if (isNormalizedError(error)) return error;

  // AbortSignal always wins — never classify an abort as a network error
  // (spec §3.4 abort-race regression; also AC14).
  if (error instanceof Error && error.name === 'AbortError') {
    return make('Cancelled', error, providerId);
  }

  // RateLimited: mock-only mapping today. Puter has no 429 path
  // (spec §3.4 owner note 4). We keep the rule for future adapters.
  const msg = asErrorMessage(error).toLowerCase();
  if (
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests')
  ) {
    return make('RateLimited', error, providerId);
  }

  // QuotaExceeded (Puter 402 / billing) — reuses the existing classifier.
  if (isPuterInsufficientFundsError(error)) {
    return make('QuotaExceeded', error, providerId);
  }

  // 5xx / server-error messages (spec §5.1 errors.test.ts "5xx / server error
  // → Unavailable"). The existing `isPuterTransportError` doesn't match these
  // literally, so we add the rule here without editing `../errors.ts`
  // (per owner rule "NO edits to errors.ts").
  if (
    /\b5\d{2}\b/.test(msg) ||
    msg.includes('server error') ||
    msg.includes('service unavailable')
  ) {
    return make('Unavailable', error, providerId);
  }

  // Unavailable (transport / 5xx / timeout) — reuses the existing classifier.
  if (isPuterTransportError(error)) {
    return make('Unavailable', error, providerId);
  }

  // Fatal: model-not-available and auth — reuses existing classifiers.
  if (
    isPuterModelNotAvailableError(error) ||
    isPuterAuthError(error)
  ) {
    return make('Fatal', error, providerId);
  }

  // Anything else is Fatal.
  return make('Fatal', error, providerId);
};

const make = (
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
