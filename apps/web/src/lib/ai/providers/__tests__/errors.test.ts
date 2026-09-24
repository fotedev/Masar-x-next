/**
 * Spec 017 — classifyPuterError tests.
 *
 * Covers spec §5.1 errors.test.ts:
 *   - All 5 NormalizedErrorKind mappings
 *   - cause preserved, providerId set, instanceof Error true
 *   - isFallbackEligible truth table
 *   - Puter has no RateLimited rule (AC19)
 *   - AbortError short-circuits to Cancelled (AC14 abort-race)
 */

import { describe, expect, it } from 'vitest';

import { classifyPuterError, isFallbackEligible, isNormalizedError } from '../errors';
import type { NormalizedError } from '../types';

const PROVIDER_ID = 'puter';

const wrap = (kind: NormalizedError['kind']): NormalizedError => {
  const e = new Error(kind) as NormalizedError;
  e.kind = kind;
  e.providerId = PROVIDER_ID;
  return e;
};

describe('classifyPuterError (spec 017)', () => {
  describe('QuotaExceeded', () => {
    it('insufficient_funds message → QuotaExceeded', () => {
      const out = classifyPuterError(new Error('insufficient_funds'), PROVIDER_ID);
      expect(out.kind).toBe('QuotaExceeded');
    });

    it('no usage left message → QuotaExceeded', () => {
      const out = classifyPuterError(new Error('No usage left for request'), PROVIDER_ID);
      expect(out.kind).toBe('QuotaExceeded');
    });

    it('payment required message → QuotaExceeded', () => {
      const out = classifyPuterError(new Error('Payment Required'), PROVIDER_ID);
      expect(out.kind).toBe('QuotaExceeded');
    });

    it('insufficient balance message → QuotaExceeded', () => {
      const out = classifyPuterError(new Error('Insufficient balance'), PROVIDER_ID);
      expect(out.kind).toBe('QuotaExceeded');
    });
  });

  describe('RateLimited (mock-only today; spec §3.4 owner note 4)', () => {
    it('429 / rate limit / too many requests → RateLimited', () => {
      const r429 = classifyPuterError(new Error('429 too many requests'), PROVIDER_ID);
      const rRate = classifyPuterError(new Error('rate limit exceeded'), PROVIDER_ID);
      const rToo = classifyPuterError(new Error('Too Many Requests'), PROVIDER_ID);
      expect(r429.kind).toBe('RateLimited');
      expect(rRate.kind).toBe('RateLimited');
      expect(rToo.kind).toBe('RateLimited');
    });
  });

  describe('Unavailable', () => {
    it('socket.io connection error → Unavailable', () => {
      const out = classifyPuterError(new Error('socket.io connection error'), PROVIDER_ID);
      expect(out.kind).toBe('Unavailable');
    });

    it('failed to fetch → Unavailable', () => {
      const out = classifyPuterError(new Error('failed to fetch'), PROVIDER_ID);
      expect(out.kind).toBe('Unavailable');
    });

    it('Request timed out → Unavailable', () => {
      const out = classifyPuterError(new Error('Request timed out'), PROVIDER_ID);
      expect(out.kind).toBe('Unavailable');
    });

    it('5xx / server error → Unavailable', () => {
      const out = classifyPuterError(new Error('503 service unavailable'), PROVIDER_ID);
      expect(out.kind).toBe('Unavailable');
    });
  });

  describe('Fatal', () => {
    it('model does not exist → Fatal', () => {
      const out = classifyPuterError(new Error('model does not exist'), PROVIDER_ID);
      expect(out.kind).toBe('Fatal');
    });

    it('not signed in → Fatal', () => {
      const out = classifyPuterError(new Error('not signed in'), PROVIDER_ID);
      expect(out.kind).toBe('Fatal');
    });

    it('unauthorized → Fatal', () => {
      const out = classifyPuterError(new Error('Unauthorized'), PROVIDER_ID);
      expect(out.kind).toBe('Fatal');
    });

    it('unknown / unclassified → Fatal', () => {
      const out = classifyPuterError(new Error('nonsense'), PROVIDER_ID);
      expect(out.kind).toBe('Fatal');
    });
  });

  describe('Cancelled (abort wins first — AC14 abort-race)', () => {
    it('AbortError → Cancelled (not Unavailable)', () => {
      const e = new Error('socket.io connection error');
      e.name = 'AbortError';
      const out = classifyPuterError(e, PROVIDER_ID);
      expect(out.kind).toBe('Cancelled');
    });

    it('AbortError even when message looks transport-y → Cancelled', () => {
      const e = new Error('socket.io connection error');
      e.name = 'AbortError';
      const out = classifyPuterError(e, PROVIDER_ID);
      expect(out.kind).toBe('Cancelled');
    });
  });

  describe('idempotency + metadata', () => {
    it('cause is preserved', () => {
      const original = new Error('insufficient_funds');
      const out = classifyPuterError(original, PROVIDER_ID);
      expect(out.cause).toBe(original);
    });

    it('providerId is set from argument', () => {
      const out = classifyPuterError(new Error('insufficient_funds'), 'custom-provider');
      expect(out.providerId).toBe('custom-provider');
    });

    it('instanceof Error is true', () => {
      const out = classifyPuterError(new Error('nonsense'), PROVIDER_ID);
      expect(out).toBeInstanceOf(Error);
    });

    it('passes through an already-normalized error', () => {
      const existing = wrap('QuotaExceeded');
      const out = classifyPuterError(existing, PROVIDER_ID);
      expect(out).toBe(existing);
    });
  });

  describe('isFallbackEligible truth table', () => {
    it('QuotaExceeded → true', () => expect(isFallbackEligible('QuotaExceeded')).toBe(true));
    it('RateLimited → true', () => expect(isFallbackEligible('RateLimited')).toBe(true));
    it('Unavailable → true', () => expect(isFallbackEligible('Unavailable')).toBe(true));
    it('Fatal → false', () => expect(isFallbackEligible('Fatal')).toBe(false));
    it('Cancelled → false', () => expect(isFallbackEligible('Cancelled')).toBe(false));
  });

  describe('isNormalizedError type guard', () => {
    it('returns true for NormalizedError-shaped values', () => {
      expect(isNormalizedError(wrap('QuotaExceeded'))).toBe(true);
    });

    it('returns false for plain Error', () => {
      expect(isNormalizedError(new Error('x'))).toBe(false);
    });

    it('returns false for primitives', () => {
      expect(isNormalizedError('x')).toBe(false);
      expect(isNormalizedError(null)).toBe(false);
      expect(isNormalizedError(undefined)).toBe(false);
    });
  });
});
