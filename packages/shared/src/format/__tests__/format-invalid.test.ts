import { describe, expect, it } from 'vitest';

import { formatDate } from '../index';

// Spec 040 — formatDate is the most-imported shared symbol on web (11+
// call sites); the invalid-input branch was unpinned.

describe('formatDate: invalid input', () => {
  it('does not throw on a garbage string', () => {
    expect(() => formatDate('garbage')).not.toThrow();
  });

  it('renders the "Invalid Date" sentinel for garbage input (both locales)', () => {
    expect(formatDate('garbage')).toMatch(/invalid/i);
    expect(formatDate('garbage', { locale: 'en-US' })).toMatch(/invalid/i);
  });

  it('accepts Date objects and epoch numbers (regression lock)', () => {
    expect(formatDate(new Date('2026-01-15T12:00:00Z'), { locale: 'en-US' })).toMatch(
      /Jan/,
    );
    expect(formatDate(1769000000000, { locale: 'en-US' })).toMatch(/\d{4}/);
  });
});
