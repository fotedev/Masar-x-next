import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

// src/proxy.ts is the edge proxy (Next 16's middleware). The default export
// orchestrates updateSession + intlMiddleware; the spec 040 export seams
// expose its pure helpers so each policy below is pinned without spinning up
// the whole pipeline. next-intl is mocked out (its ESM build does not resolve
// under the vitest node loader) — the helpers under test never touch it.
// Behavior of the source is unchanged.
vi.mock('next-intl/middleware', () => ({
  default: vi.fn(() => () => null),
}));
vi.mock('next-intl/routing', () => ({
  defineRouting: vi.fn((routing: unknown) => routing),
}));

import {
  appendSetCookies,
  config,
  generateNonce,
  getCspHeader,
  isRedirectResponse,
} from '../proxy';
// isLocalHost moved to lib/desktop-host (spec 041 R18) — tests follow it.
import { isLocalHost } from '../lib/desktop-host';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isLocalHost', () => {
  it.each([
    ['[::1]:3000', true, 'bracketed IPv6 loopback with port'],
    ['[::1]', true, 'bracketed IPv6 loopback without port'],
    ['::1', true, 'bare IPv6 loopback (non-conformant but accepted)'],
    ['localhost', true, 'bare hostname'],
    ['localhost:3000', true, 'hostname with port'],
    ['LOCALHOST:8080', true, 'case-insensitive hostname'],
    ['127.0.0.1', true, 'IPv4 loopback'],
    ['127.0.0.1:3000', true, 'IPv4 loopback with port'],
    ['127.255.1.9', true, '127.0.0.0/8 range'],
  ])('%s → true (%s)', (host, expected) => {
    expect(isLocalHost(host)).toBe(expected);
  });

  it.each([
    ['example.com', 'real hostname'],
    ['example.com:8080', 'real hostname with port'],
    ['127.0.0.1.evil.com', 'loopback-looking suffix (regex anchored)'],
    ['localhost.evil.com', 'hostname ending in localhost'],
    ['[::2]:3000', 'bracketed non-loopback IPv6'],
    ['[bad', 'unterminated bracket'],
    ['[]', 'empty bracket'],
    ['0:0:0:0:0:0:0:1', 'expanded IPv6 loopback spelling (not matched)'],
    ['::ffff:127.0.0.1', 'IPv4-mapped IPv6 (not matched)'],
    ['', 'empty string'],
  ])('%s → false (%s)', (host) => {
    expect(isLocalHost(host)).toBe(false);
  });

  it('null host → false', () => {
    expect(isLocalHost(null)).toBe(false);
  });

  it('strips the port before the IPv4 loopback check', () => {
    // '127.0.0.1:3000' must not be fed to the regex with the port attached.
    expect(isLocalHost('127.0.0.1:9999')).toBe(true);
  });
});

describe('generateNonce', () => {
  it('returns a 32-char lowercase hex string', () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
  });

  it('is unique across calls (CSP nonce must never repeat)', () => {
    const seen = new Set(Array.from({ length: 50 }, () => generateNonce()));
    expect(seen.size).toBe(50);
  });
});

describe('getCspHeader', () => {
  const nonce = 'a'.repeat(32);

  it('signs script-src with the given nonce', () => {
    const csp = getCspHeader(nonce);
    expect(csp).toContain(`script-src 'self' 'nonce-${nonce}'`);
  });

  it('dev build allows unsafe-eval (HMR / react-refresh)', () => {
    // vitest NODE_ENV is 'test' → isProd false → dev directives.
    const csp = getCspHeader(nonce);
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).not.toContain("'wasm-unsafe-eval'");
  });

  it('prod build (NODE_ENV) swaps unsafe-eval for wasm-unsafe-eval', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const csp = getCspHeader(nonce);
    expect(csp).toContain("'wasm-unsafe-eval'");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('prod build (VERCEL_ENV) is detected even with a non-prod NODE_ENV', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('VERCEL_ENV', 'production');
    const csp = getCspHeader(nonce);
    expect(csp).toContain("'wasm-unsafe-eval'");
  });

  it('includes upgrade-insecure-requests for non-loopback hosts', () => {
    expect(getCspHeader(nonce, 'masarx.vercel.app')).toContain(
      'upgrade-insecure-requests',
    );
  });

  it('suppresses upgrade-insecure-requests for loopback hosts (Electron desktop)', () => {
    const csp = getCspHeader(nonce, '127.0.0.1:3000');
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('treats a missing Host header as non-local (upgrade stays on)', () => {
    expect(getCspHeader(nonce, null)).toContain('upgrade-insecure-requests');
  });

  it('keeps the core directive set intact', () => {
    const csp = getCspHeader(nonce);
    for (const directive of [
      "default-src 'self' https://*.youtube.com https://*.googlevideo.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      'object-src',
      'frame-ancestors',
      'base-uri',
      'form-action',
    ]) {
      expect(csp).toContain(directive);
    }
    expect(csp.split('; ')).toContain("object-src 'none'");
  });
});

describe('isRedirectResponse', () => {
  it('detects a redirect by the Location header', () => {
    const res = NextResponse.redirect(new URL('https://x.test/ar/login'));
    expect(isRedirectResponse(res)).toBe(true);
  });

  it('detects a redirect by status when no Location is set', () => {
    for (const status of [301, 302, 303, 307, 308]) {
      const res = new NextResponse(null, { status });
      expect(isRedirectResponse(res)).toBe(true);
    }
  });

  it('rejects a 200 response', () => {
    expect(isRedirectResponse(new NextResponse('ok'))).toBe(false);
  });

  it('rejects non-redirect statuses even without Location', () => {
    for (const status of [200, 400, 401, 404, 500]) {
      expect(isRedirectResponse(new NextResponse(null, { status }))).toBe(false);
    }
  });

  it('a 200 that carries a Location header still counts as a redirect', () => {
    const res = new NextResponse('ok');
    res.headers.set('location', 'https://x.test/elsewhere');
    expect(isRedirectResponse(res)).toBe(true);
  });

  it('null and undefined responses are not redirects', () => {
    expect(isRedirectResponse(null)).toBe(false);
    expect(isRedirectResponse(undefined)).toBe(false);
  });
});

describe('appendSetCookies — chunked Supabase cookie merge', () => {
  it('moves every Set-Cookie individually instead of collapsing them', () => {
    const source = new Headers();
    source.append('set-cookie', 'sb-abc-auth-token.0=part0; Path=/; HttpOnly');
    source.append('set-cookie', 'sb-abc-auth-token.1=part1; Path=/; HttpOnly');
    source.append('set-cookie', 'sb-abc-auth-token-code-verifier=verif; Path=/; HttpOnly');

    const target = new Headers();
    appendSetCookies(target, source);

    const cookies = target.getSetCookie();
    expect(cookies).toHaveLength(3);
    expect(cookies[0]).toContain('sb-abc-auth-token.0=part0');
    expect(cookies[1]).toContain('sb-abc-auth-token.1=part1');
    expect(cookies[2]).toContain('sb-abc-auth-token-code-verifier=verif');
  });

  it('appends onto existing cookies without overwriting them', () => {
    const target = new Headers();
    target.append('set-cookie', 'intl-locale=ar; Path=/');

    const source = new Headers();
    source.append('set-cookie', 'sb-auth-token=refreshed; Path=/');

    appendSetCookies(target, source);
    const cookies = target.getSetCookie();
    expect(cookies).toHaveLength(2);
    expect(cookies.some((c) => c.startsWith('intl-locale=ar'))).toBe(true);
    expect(cookies.some((c) => c.startsWith('sb-auth-token=refreshed'))).toBe(true);
  });

  it('a comma inside a cookie value survives the transfer (getSetCookie, not get)', () => {
    const source = new Headers();
    // Supabase session cookies are base64-ish and can contain commas when
    // headers.get() comma-joins multiple Set-Cookie values — the exact
    // collapse bug this helper exists to avoid (audit H1).
    source.append('set-cookie', 'sb-token=a,b; Path=/');
    source.append('set-cookie', 'sb-other=c; Path=/');

    const target = new Headers();
    appendSetCookies(target, source);
    expect(target.getSetCookie()).toEqual(['sb-token=a,b; Path=/', 'sb-other=c; Path=/']);
  });

  it('copies nothing when the source has no Set-Cookie headers', () => {
    const target = new Headers();
    appendSetCookies(target, new Headers());
    expect(target.getSetCookie()).toHaveLength(0);
  });
});

describe('config.matcher — static-file exclusions', () => {
  const matcher = new RegExp(config.matcher[0]);

  // Spec 048: media/text assets under public/ must bypass the proxy.
  // Routing /zane/*.mp4 through next-intl returned the HTML 404 page on
  // production while the .png poster (already excluded) loaded; /llms.txt
  // 404ed the same way. Same failure class as the .wasm exclusion above.
  it.each([
    '/zane/zane-idle-face.mp4',
    '/zane/zane-typing-close.mp4',
    '/llms.txt',
    '/dotlottie-player.wasm',
    '/favicon.ico',
    '/robots.txt',
  ])('%s → excluded (served statically, never locale-redirected)', (path) => {
    expect(matcher.test(path)).toBe(false);
  });

  it.each([
    '/en/ai-assistant',
    '/ar/subjects',
    '/en/news/some-slug.mp4-lookalike',
  ])('%s → matched (still routed through the proxy)', (path) => {
    expect(matcher.test(path)).toBe(true);
  });
});
