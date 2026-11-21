import { afterEach, describe, expect, it, vi } from 'vitest';

import { getFacultyPromptBrand } from '../prompt-brand';

// Spec 055 — the prompt platform brand resolves from the faculty preset's
// dedicated promptPlatformName key; anything other than a known preset
// degrades to undefined so callers keep their hardcoded core default.

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getFacultyPromptBrand', () => {
  it('returns undefined without a preset env (core branding)', () => {
    vi.stubEnv('NEXT_PUBLIC_FACULTY', '');
    expect(getFacultyPromptBrand('ar')).toBeUndefined();
    expect(getFacultyPromptBrand('en')).toBeUndefined();
    expect(getFacultyPromptBrand()).toBeUndefined();
  });

  it('resolves the active preset for both locales', () => {
    vi.stubEnv('NEXT_PUBLIC_FACULTY', 'fcai-asnu');
    expect(getFacultyPromptBrand('en')).toBe('FCAI ASNU X');
    expect(getFacultyPromptBrand('ar')).toBe('FCAI ASNU X');
    expect(getFacultyPromptBrand()).toBe('FCAI ASNU X'); // ar default, cannedMessagesFor convention
  });

  it('resolves the second preset', () => {
    vi.stubEnv('NEXT_PUBLIC_FACULTY', 'bis');
    expect(getFacultyPromptBrand('en')).toBe('BIS X');
    expect(getFacultyPromptBrand('ar')).toBe('BIS X');
  });

  it('unknown env degrades to undefined (never throws)', () => {
    vi.stubEnv('NEXT_PUBLIC_FACULTY', 'typo-faculty');
    expect(getFacultyPromptBrand('en')).toBeUndefined();
  });
});
