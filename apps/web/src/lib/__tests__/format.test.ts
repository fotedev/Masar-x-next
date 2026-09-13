import { describe, expect, it } from 'vitest';
import { formatDate } from 'masarx-shared/format';

describe('formatDate (masarx-shared/format)', () => {
  const iso = '2026-05-15T10:30:00Z';
  const date = new Date(iso);

  it('formats a Date with the ar-EG short-month default', () => {
    const out = formatDate(date);
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
    expect(out).not.toContain('Invalid');
  });

  it('accepts ISO string input', () => {
    expect(formatDate(iso, { locale: 'en-US' })).toBe(
      formatDate(date, { locale: 'en-US' }),
    );
  });

  it('uses Latin digits for en-US', () => {
    expect(formatDate(iso, { locale: 'en-US' })).toContain('2026');
  });

  it('long month differs from short month', () => {
    // February: en-US abbreviated ("Feb") differs from full ("February").
    // (May would not — its abbreviation equals the full name.)
    const feb = '2026-02-15T10:30:00Z';
    const short = formatDate(feb, { locale: 'en-US' });
    const long = formatDate(feb, { locale: 'en-US', month: 'long' });
    expect(short).not.toBe(long);
    expect(long).toContain('February');
  });

  it('withTime appends hour and minute', () => {
    const dateOnly = formatDate(iso, { locale: 'en-US' });
    const stamped = formatDate(iso, { locale: 'en-US', withTime: true });
    expect(stamped).toContain(dateOnly);
    expect(stamped.length).toBeGreaterThan(dateOnly.length);
  });

  it('returns the platform "Invalid Date" marker for garbage input', () => {
    expect(formatDate('not-a-date')).toBe(new Date('not-a-date').toLocaleDateString());
  });
});
