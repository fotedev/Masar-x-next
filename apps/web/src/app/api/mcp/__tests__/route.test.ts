import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// /api/mcp — bearer auth + scoped CORS. The McpServer/transport wiring at
// module scope is left real (it only constructs objects); the spec 040 seams
// export isAuthorized / getAllowedOrigin so the env matrices are pinned
// directly. Logger is mocked to silence the warn-once branch.
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { getAllowedOrigin, isAuthorized, OPTIONS } from '../route';

const SECRET = 'mcp-bypass-secret';

const req = (url = 'https://masarx.example/api/mcp', headers: Record<string, string> = {}) =>
  new Request(url, { headers });

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('VERCEL_MCP_BYPASS_SECRET', '');
  vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isAuthorized — env matrix', () => {
  it('FAILS CLOSED in production without a secret', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_MCP_BYPASS_SECRET', '');

    expect(isAuthorized(req())).toBe(false);
  });

  it('production fails closed even when a bearer header is present but no secret is configured', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_MCP_BYPASS_SECRET', '');

    expect(isAuthorized(req('https://x/api/mcp', { authorization: 'Bearer anything' }))).toBe(
      false,
    );
  });

  it('dev/preview stays OPEN without a secret (local dev convenience)', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('VERCEL_MCP_BYPASS_SECRET', '');

    expect(isAuthorized(req())).toBe(true);
  });

  it('matches the configured bearer token exactly', () => {
    vi.stubEnv('VERCEL_MCP_BYPASS_SECRET', SECRET);

    expect(isAuthorized(req('https://x/api/mcp', { authorization: `Bearer ${SECRET}` }))).toBe(
      true,
    );
  });

  it.each([
    ['Bearer wrong-secret', 'mismatched token'],
    [SECRET, 'raw secret without the Bearer prefix'],
    ['bearer mcp-bypass-secret', 'lowercase scheme'],
    ['Bearer  mcp-bypass-secret', 'double space after the scheme'],
    ['Bearer mcp-bypass-secretX', 'secret as a prefix of a longer token'],
  ])('rejects %s (%s)', (header) => {
    vi.stubEnv('VERCEL_MCP_BYPASS_SECRET', SECRET);
    expect(isAuthorized(req('https://x/api/mcp', { authorization: header }))).toBe(false);
  });

  it('trailing whitespace never reaches the comparison (the platform trims header values)', () => {
    vi.stubEnv('VERCEL_MCP_BYPASS_SECRET', SECRET);
    // Headers normalize 'Bearer x ' → 'Bearer x' before the route sees it.
    expect(
      isAuthorized(req('https://x/api/mcp', { authorization: `Bearer ${SECRET} ` })),
    ).toBe(true);
  });

  it('rejects a missing Authorization header when a secret is configured', () => {
    vi.stubEnv('VERCEL_MCP_BYPASS_SECRET', SECRET);
    expect(isAuthorized(req())).toBe(false);
  });
});

describe('getAllowedOrigin', () => {
  it('prefers the configured NEXT_PUBLIC_APP_URL and strips a trailing slash', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com/');

    expect(getAllowedOrigin(req('https://masarx.example/api/mcp'))).toBe('https://app.example.com');
  });

  it('falls back to NEXT_PUBLIC_SITE_URL when APP_URL is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://site.example.com');

    expect(getAllowedOrigin(req('https://masarx.example/api/mcp'))).toBe('https://site.example.com');
  });

  it('same-origin Origin header is echoed back', () => {
    expect(
      getAllowedOrigin(req('https://masarx.example/api/mcp', { origin: 'https://masarx.example' })),
    ).toBe('https://masarx.example');
  });

  it('cross-origin Origin header is NOT echoed — request origin is used instead', () => {
    expect(
      getAllowedOrigin(req('https://masarx.example/api/mcp', { origin: 'https://evil.example' })),
    ).toBe('https://masarx.example');
  });

  it('a malformed Origin header falls back to the request origin', () => {
    expect(getAllowedOrigin(req('https://masarx.example/api/mcp', { origin: 'not a url' }))).toBe(
      'https://masarx.example',
    );
  });

  it('no Origin header → request origin', () => {
    expect(getAllowedOrigin(req('https://masarx.example/api/mcp'))).toBe('https://masarx.example');
  });
});

describe('OPTIONS preflight', () => {
  it('returns 204 with the scoped CORS contract', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com');

    const res = await OPTIONS(req('https://masarx.example/api/mcp'));

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe(
      'Content-Type, Authorization, MCP-Protocol-Version, MCP-Session-ID',
    );
    expect(res.headers.get('Vary')).toBe('Origin');
  });
});
