import { afterEach, describe, expect, it, vi } from 'vitest';

import { t, hasKey } from '../index';

// Spec 040 — the nested dot-path walk and the missing-interpolation-value
// branch were never executed by tests (the original suite only probed flat
// keys and a structural placeholder scan). Real nested data exists: 115
// object-valued keys across 20 namespaces (e.g. adminDashboard.tabs.courses).

const warnSpy = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('t(): nested dot-path lookup (real registry data)', () => {
  it('resolves a real nested key in adminDashboard (ar)', () => {
    expect(t('ar', 'adminDashboard', 'tabs.courses')).toBe('الدورات');
  });

  it('resolves the same nested key in en (registry parity keeps them parallel)', () => {
    expect(t('en', 'adminDashboard', 'tabs.courses')).toBe(
      'Courses',
    );
  });

  it('resolves another real nested path (auth.checking)', () => {
    expect(t('ar', 'adminDashboard', 'auth.checking')).toBe(
      'جاري التحقق من الصلاحيات...',
    );
  });

  it('falls back through a nested walk to en when ar misses a nested key', () => {
    const warn = warnSpy();
    // Fabricate a guaranteed-missing nested key: warning fires (dev) and the
    // key string returns — resolution never throws and never returns undefined.
    expect(t('ar', 'adminDashboard', 'tabs.no_such_key_xyz')).toBe(
      'tabs.no_such_key_xyz',
    );
    expect(warn).toHaveBeenCalled();
  });

  it('hasKey() sees nested paths (strict, no fallback)', () => {
    expect(hasKey('ar', 'adminDashboard', 'tabs.courses')).toBe(true);
    expect(hasKey('ar', 'adminDashboard', 'tabs.no_such_key_xyz')).toBe(false);
    expect(hasKey('en', 'adminDashboard', 'tabs.courses')).toBe(true);
  });
});

describe('t(): {placeholder} interpolation edges (real template)', () => {
  // Real template: addFile.lectureNotFound =
  //   ar: `المحاضرة "{lectureKey}" غير موجودة في المادة "{subject}"`
  //   en: `Lecture "{lectureKey}" not found in subject "{subject}"`
  it('interpolates all values of a real multi-placeholder template', () => {
    expect(
      t('en', 'addFile', 'lectureNotFound', {
        lectureKey: 'lec-01',
        subject: 'math',
      }),
    ).toBe('Lecture "lec-01" not found in subject "math"');
  });

  it('leaves unknown placeholders intact and warns (dev)', () => {
    const warn = warnSpy();
    const result = t('en', 'addFile', 'lectureNotFound', { lectureKey: 'k1' });
    expect(result).toContain('{subject}');
    expect(result).toContain('k1');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('{subject}'),
    );
  });

  it('without values, the template passes through untouched (no warn)', () => {
    const warn = warnSpy();
    const result = t('en', 'addFile', 'lectureNotFound');
    expect(result).toBe('Lecture "{lectureKey}" not found in subject "{subject}"');
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('t(): prototype-chain names never resolve via nested walk', () => {
  it('does not resolve constructor/toString paths into native functions', () => {
    const warn = warnSpy();
    expect(t('en', 'adminDashboard', 'constructor')).toBe('constructor');
    expect(t('en', 'adminDashboard', 'constructor.prototype')).toBe(
      'constructor.prototype',
    );
    expect(t('en', 'adminDashboard', '__proto__.x')).toBe('__proto__.x');
    expect(warn).toHaveBeenCalled();
  });
});
