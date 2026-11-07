import { beforeEach, describe, expect, it, vi } from 'vitest';

// The OAuth entry route. Only the server-client seam is mocked; NextResponse
// stays real so the redirect contract (status + Location) is checked
// end-to-end. normalizeLocale / localizeNext / sanitizeNext are the spec 040
// export seams extracted verbatim from the route body.
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { GET, localizeNext, normalizeLocale, sanitizeNext } from '../route';

const createClientMock = vi.mocked(createClient);

const callGet = async (path: string, locale = 'ar') =>
  GET(new Request(`https://masarx.example${path}`), {
    params: Promise.resolve({ locale }),
  });

const mockExchange = (error: unknown = null) => {
  createClientMock.mockResolvedValue({
    auth: { exchangeCodeForSession: vi.fn().mockResolvedValue({ error }) },
  } as never);
};

beforeEach(() => {
  createClientMock.mockReset();
});

describe('sanitizeNext — open-redirect rejection matrix', () => {
  it.each([
    ['//evil.com', 'protocol-relative host'],
    ['//evil.com/path?x=1', 'protocol-relative host with path'],
    ['://x', 'scheme without name'],
    ['http://evil.com', 'absolute http URL (non-/ start)'],
    ['https://evil.com/path', 'absolute https URL'],
    ['javascript:alert(1)', 'javascript scheme'],
    ['JAVASCRIPT:alert(1)', 'uppercase scheme'],
    ['data:text/html,<script>', 'data URL'],
    ['mailto:x@y.z', 'mailto scheme'],
    ['/\\evil', 'backslash escape (/\\ prefix)'],
    ['/\\EVIL', 'backslash escape, case-insensitive check'],
    ['relative/path', 'non-slash start'],
    ['%2F%2Fevil.com', 'encoded double slash (still non-slash start)'],
    [' ', 'whitespace-only'],
    ['', 'empty string'],
  ])('rejects %s (%s) → "/"', (input) => {
    expect(sanitizeNext(input)).toBe('/');
  });

  it('collapses a missing next param to "/"', () => {
    expect(sanitizeNext(null)).toBe('/');
  });

  it.each([
    ['/subjects', 'plain relative path'],
    ['/subjects/math?next=x', 'path with query'],
    ['/en/dashboard#section', 'path with hash'],
    ['/__', 'single slash plus junk chars'],
  ])('allows %s (%s) unchanged', (input) => {
    expect(sanitizeNext(input)).toBe(input);
  });
});

describe('normalizeLocale', () => {
  it.each([
    ['ar', 'ar'],
    ['en', 'en'],
    [undefined, 'ar'],
    ['fr', 'ar'],
    ['', 'ar'],
    ['AR', 'ar'],
    ['EN', 'ar'],
    ['arabic', 'ar'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizeLocale(raw)).toBe(expected);
  });
});

describe('localizeNext', () => {
  it.each([
    ['/', 'ar', '/ar'],
    ['/', 'en', '/en'],
    ['/subjects/math', 'en', '/en/subjects/math'],
    ['/subjects/math', 'ar', '/ar/subjects/math'],
    ['subjects', 'ar', '/ar/subjects'],
    ['/en/x', 'en', '/en/x'],
    ['/ar/x', 'ar', '/ar/x'],
    ['/en/x', 'ar', '/ar/en/x'],
    ['/english', 'en', '/english'],
  ])('localizeNext(%s, %s) → %s', (next, locale, expected) => {
    expect(localizeNext(next, locale as 'ar' | 'en')).toBe(expected);
  });
});

describe('GET — success branch (code exchanged)', () => {
  it('redirects to origin + localized next', async () => {
    mockExchange(null);
    const res = await callGet('/auth/ar/callback?code=abc123&next=/subjects');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://masarx.example/ar/subjects');
  });

  it('uses the route locale, not the next param locale, for prefixing', async () => {
    mockExchange(null);
    const res = await callGet('/auth/en/callback?code=abc123&next=/quiz-attempts', 'en');
    expect(res.headers.get('location')).toBe('https://masarx.example/en/quiz-attempts');
  });

  it('does not double-prefix a next that already carries the route locale', async () => {
    mockExchange(null);
    const res = await callGet('/auth/en/callback?code=abc&next=/en/subjects/math', 'en');
    expect(res.headers.get('location')).toBe('https://masarx.example/en/subjects/math');
  });

  it('defaults next to the bare locale root when absent', async () => {
    mockExchange(null);
    const res = await callGet('/auth/ar/callback?code=abc');
    expect(res.headers.get('location')).toBe('https://masarx.example/ar');
  });

  it('normalizes an unknown route locale to the default (ar)', async () => {
    mockExchange(null);
    const res = await callGet('/auth/fr/callback?code=abc', 'fr');
    expect(res.headers.get('location')).toBe('https://masarx.example/ar');
  });

  it('sanitizes an unsafe next before redirecting on success', async () => {
    mockExchange(null);
    const res = await callGet('/auth/ar/callback?code=abc&next=//evil.com');
    expect(res.headers.get('location')).toBe('https://masarx.example/ar');
  });

  it('exchanges the code exactly once with the code from the query', async () => {
    const exchange = vi.fn().mockResolvedValue({ error: null });
    createClientMock.mockResolvedValue({ auth: { exchangeCodeForSession: exchange } } as never);
    await callGet('/auth/ar/callback?code=the-code');
    expect(exchange).toHaveBeenCalledTimes(1);
    expect(exchange).toHaveBeenCalledWith('the-code');
  });
});

describe('GET — error branch (exchange failed / no code)', () => {
  it('redirects to /{locale}/login?error=auth-code-error', async () => {
    mockExchange({ message: 'bad verifier' });
    const res = await callGet('/auth/ar/callback?code=abc');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'https://masarx.example/ar/login?error=auth-code-error',
    );
  });

  it('preserves a safe next on the error path so login can retry', async () => {
    mockExchange({ message: 'bad verifier' });
    const res = await callGet('/auth/en/callback?code=abc&next=/subjects', 'en');
    expect(res.headers.get('location')).toBe(
      'https://masarx.example/en/login?error=auth-code-error&next=%2Fsubjects',
    );
  });

  it('drops an unsafe next on the error path', async () => {
    mockExchange({ message: 'bad verifier' });
    const res = await callGet('/auth/ar/callback?code=abc&next=//evil.com');
    expect(res.headers.get('location')).toBe(
      'https://masarx.example/ar/login?error=auth-code-error',
    );
  });

  it('skips the exchange entirely when no code is present', async () => {
    mockExchange(null);
    const res = await callGet('/auth/ar/callback');
    expect(createClientMock).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toBe(
      'https://masarx.example/ar/login?error=auth-code-error',
    );
  });

  it('treats an exchange error as the error path even for a code-bearing request', async () => {
    mockExchange({ message: 'invalid grant' });
    const res = await callGet('/auth/en/callback?code=abc', 'en');
    expect(res.headers.get('location')).toContain('/en/login?error=auth-code-error');
  });
});
