import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProfileFormSchema } from '../validation/profile';
import { isAdminRole } from '../auth/roles';

describe('ProfileFormSchema — fullName rules', () => {
  const validBase = { username: 'student_1', website: '', avatarUrl: '' };

  it('accepts Latin, Arabic (unicode letters), spaces, hyphens and apostrophes', () => {
    expect(() =>
      ProfileFormSchema.parse({ ...validBase, fullName: "Ahmed O'Brien-Lee" }),
    ).not.toThrow();
    expect(() =>
      ProfileFormSchema.parse({ ...validBase, fullName: 'محمد عبد الرحمن' }),
    ).not.toThrow();
  });

  it('rejects names shorter than 2 characters and longer than 100', () => {
    const one = ProfileFormSchema.safeParse({ ...validBase, fullName: 'أ' });
    expect(one.success).toBe(false);
    const tooLong = ProfileFormSchema.safeParse({ ...validBase, fullName: 'a'.repeat(101) });
    expect(tooLong.success).toBe(false);
    const max = ProfileFormSchema.safeParse({ ...validBase, fullName: 'a'.repeat(100) });
    expect(max.success).toBe(true);
  });

  it('rejects digits and symbols the regex does not allow', () => {
    const result = ProfileFormSchema.safeParse({ ...validBase, fullName: 'Ahmed 123!' });
    expect(result.success).toBe(false);
  });
});

describe('ProfileFormSchema — username rules', () => {
  const validBase = { fullName: 'Ahmed Ali', website: '', avatarUrl: '' };

  it('accepts letters, digits and underscores (3-30 chars)', () => {
    expect(() => ProfileFormSchema.parse({ ...validBase, username: 'a_1B' })).not.toThrow();
    expect(() =>
      ProfileFormSchema.parse({ ...validBase, username: 'x'.repeat(30) }),
    ).not.toThrow();
  });

  it('rejects spaces, hyphens, Arabic and short/long values', () => {
    expect(ProfileFormSchema.safeParse({ ...validBase, username: 'ab' }).success).toBe(false);
    expect(ProfileFormSchema.safeParse({ ...validBase, username: 'ah med' }).success).toBe(false);
    expect(ProfileFormSchema.safeParse({ ...validBase, username: 'أحمد' }).success).toBe(false);
    expect(ProfileFormSchema.safeParse({ ...validBase, username: 'x'.repeat(31) }).success).toBe(
      false,
    );
  });
});

describe('ProfileFormSchema — website/avatar URL refine', () => {
  it('accepts empty strings (field optional)', () => {
    expect(() =>
      ProfileFormSchema.parse({ fullName: 'Ahmed Ali', username: 'ahmed', website: '', avatarUrl: '' }),
    ).not.toThrow();
  });

  it('accepts http/https and rejects other protocols', () => {
    const base = { fullName: 'Ahmed Ali', username: 'ahmed', website: '', avatarUrl: '' };
    expect(() => ProfileFormSchema.parse({ ...base, website: 'https://masarx.dev' })).not.toThrow();
    expect(() => ProfileFormSchema.parse({ ...base, website: 'http://localhost:3000' })).not.toThrow();
    expect(ProfileFormSchema.safeParse({ ...base, website: 'ftp://files.example.com' }).success).toBe(
      false,
    );
    expect(ProfileFormSchema.safeParse({ ...base, website: 'javascript:alert(1)' }).success).toBe(
      false,
    );
  });

  it('rejects non-URL strings and enforces the max length', () => {
    const base = { fullName: 'Ahmed Ali', username: 'ahmed', website: '', avatarUrl: '' };
    expect(ProfileFormSchema.safeParse({ ...base, website: 'not a url' }).success).toBe(false);
    expect(
      ProfileFormSchema.safeParse({ ...base, website: `https://x.com/${'a'.repeat(200)}` }).success,
    ).toBe(false);
    expect(
      ProfileFormSchema.safeParse({ ...base, avatarUrl: `https://cdn.example/${'a'.repeat(500)}` })
        .success,
    ).toBe(false);
  });

  it('applies the same http/https rule to avatarUrl', () => {
    const base = { fullName: 'Ahmed Ali', username: 'ahmed', website: '' };
    expect(
      ProfileFormSchema.safeParse({ ...base, avatarUrl: 'data:image/png;base64,AAAA' }).success,
    ).toBe(false);
    expect(() =>
      ProfileFormSchema.parse({ ...base, avatarUrl: 'https://cdn.example/avatar.png' }),
    ).not.toThrow();
  });
});

// Spec 048: pickReactionEvent deleted with the dotLottie state machine —
// the video avatar has no reaction events.

describe('isAdminRole', () => {
  it('accepts exactly the three admin roles', () => {
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('doctor')).toBe(true);
    expect(isAdminRole('student_admin')).toBe(true);
  });

  it('rejects non-admin roles, casing drift and missing values', () => {
    expect(isAdminRole('user')).toBe(false);
    expect(isAdminRole('Admin')).toBe(false);
    expect(isAdminRole('STUDENT_ADMIN')).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole('')).toBe(false);
  });
});

describe('withTimeout (fake timers)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves the wrapped promise when it settles before the timeout', async () => {
    vi.useFakeTimers();
    const { withTimeout } = await import('@/lib/ai/circuit-breaker');
    await expect(withTimeout(Promise.resolve('fast'), 30_000, 'should not fire')).resolves.toBe(
      'fast',
    );
  });

  it('rejects with the timeout message when the promise hangs', async () => {
    vi.useFakeTimers();
    const { withTimeout } = await import('@/lib/ai/circuit-breaker');
    const pending = new Promise<string>(() => {});
    const race = withTimeout(pending, 1_000, 'AI request timed out');
    const assertion = expect(race).rejects.toThrow('AI request timed out');
    await vi.advanceTimersByTimeAsync(1_001);
    await assertion;
  });

  it('defaults to a 30s timeout and generic message', async () => {
    vi.useFakeTimers();
    const { withTimeout } = await import('@/lib/ai/circuit-breaker');
    const pending = new Promise<string>(() => {});
    const race = withTimeout(pending);
    const assertion = expect(race).rejects.toThrow('Request timed out');
    await vi.advanceTimersByTimeAsync(29_999);
    // still pending at 29_999ms
    let settled = false;
    race.catch(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
  });
});
