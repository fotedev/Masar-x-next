import { describe, expect, it } from 'vitest';

import { formatApproxSize } from '../paste-attachments';

// Spec 040 — the MB tier and the kb>=100 rounding branch were untested
// (the original suite covered only the B/KB tiers below 100).

describe('formatApproxSize: MB tier and rounding boundaries', () => {
  it('formats sub-100 KB with one decimal', () => {
    // 2.5 KB exactly (2560 bytes, ASCII 1:1 byte mapping)
    expect(formatApproxSize('a'.repeat(2560))).toBe('2.5 KB');
  });

  it('rounds >=100 KB to whole KB', () => {
    expect(formatApproxSize('a'.repeat(150 * 1024))).toBe('150 KB');
    expect(formatApproxSize('a'.repeat(1024 * 102))).toBe('102 KB');
  });

  it('formats >=1 MB as MB with one decimal', () => {
    expect(formatApproxSize('a'.repeat(1024 * 1024))).toBe('1.0 MB');
    expect(formatApproxSize('a'.repeat(Math.round(1.1 * 1024 * 1024)))).toBe(
      '1.1 MB',
    );
    expect(formatApproxSize('a'.repeat(5 * 1024 * 1024))).toBe('5.0 MB');
  });

  it('byte sizes still use the B tier (regression lock)', () => {
    expect(formatApproxSize('a'.repeat(999))).toBe('999 B');
    expect(formatApproxSize('')).toBe('0 B');
  });
});
