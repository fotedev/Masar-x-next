import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';

// POST /api/ai-chat — the contract-preserving proxy to the Supabase Edge
// Function. Real api-auth + NextResponse; mocked seams:
//   - '@/lib/supabase/server' → requireAuthenticatedUser's client
//   - '@/lib/rate-limit'      → limit decision controlled per test
//   - '@/lib/metrics'         → Redis counters (also avoids server-only)
//   - global fetch            → the upstream Edge Function stub
// NOTE: the route bakes SUPABASE_URL / AI_CHAT_URL into module constants at
// import time, so the env must be stubbed BEFORE the module is imported and
// the misconfigured-deployment branch needs a fresh module instance
// (vi.resetModules + dynamic import, last describe below).
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  checkAIChatRateLimit: vi.fn(),
  recordAIChatRequest: vi.fn(),
  AI_CHAT_RATE_LIMIT: { windowMs: 60_000, maxRequests: 10, keyPrefix: 'rate_limit:ai_chat:' },
}));
vi.mock('@/lib/metrics', () => ({
  recordAiQuestion: vi.fn(),
  recordFileDownload: vi.fn(),
  pingActiveUser: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { checkAIChatRateLimit, recordAIChatRequest } from '@/lib/rate-limit';
import { recordAiQuestion } from '@/lib/metrics';

const createClientMock = vi.mocked(createClient);
const checkRateLimitMock = vi.mocked(checkAIChatRateLimit);
const recordRequestMock = vi.mocked(recordAIChatRequest);
const recordAiQuestionMock = vi.mocked(recordAiQuestion);

const makeUser = (id = 'u-proxy'): User =>
  ({
    id,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  }) as unknown as User;

let route: typeof import('../route');
let fetchMock: ReturnType<typeof vi.fn>;

// File-scope: the route bakes SUPABASE_URL into module constants at import
// time, so the happy-path env must exist before the first dynamic import.
beforeAll(async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://sb.example.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key-123');
  route = await import('../route');
});

const authOk = () => {
  createClientMock.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: makeUser() }, error: null }) },
  } as never);
};

const allowRateLimit = () =>
  checkRateLimitMock.mockReturnValue({
    allowed: true,
    remaining: 9,
    resetTime: Date.now() + 60_000,
  });

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest('https://masarx.example/api/ai-chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://sb.example.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key-123');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('forbidden provider-key headers (checked BEFORE auth)', () => {
  it.each([
    'x-ai-provider-key',
    'x-openai-api-key',
    'x-anthropic-api-key',
    'x-gemini-api-key',
  ])('403s on %s without consulting auth or the upstream', async (header) => {
    const res = await route.POST(post({ prompt: 'hi' }, { [header]: 'sk-secret' }));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: 'Forbidden: provider key header not allowed',
    });
    expect(createClientMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('auth + rate limit ordering', () => {
  it('returns the shared 401 shape for an unauthenticated caller', async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    } as never);

    const res = await route.POST(post({ prompt: 'hi' }));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: 'Unauthorized',
      message: 'Valid authentication required',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 429 with Retry-After when the limit denies', async () => {
    authOk();
    checkRateLimitMock.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 30_000,
      retryAfter: 30,
    });

    const res = await route.POST(post({ prompt: 'hi' }));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('30');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('body schema (proxyBodySchema: record, ≤50k chars)', () => {
  beforeEach(() => {
    authOk();
    allowRateLimit();
  });

  it('invalid JSON → uniform 400', async () => {
    const res = await route.POST(post('{oops'));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: 'Invalid request body' });
  });

  it('non-object payloads (string / array / null) → 400', async () => {
    for (const body of ['"text"', '[1,2]', 'null']) {
      const res = await route.POST(post(body));
      expect(res.status).toBe(400);
    }
  });

  it('a payload over 50000 serialized characters → 400', async () => {
    const res = await route.POST(post({ chunk: 'x'.repeat(50_001) }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      message: 'Payload too large (max 50000 characters)',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a payload just under the cap passes', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    const res = await route.POST(post({ chunk: 'x'.repeat(40_000) }));
    expect(res.status).toBe(200);
  });
});

describe('forwarding to the Edge Function', () => {
  beforeEach(() => {
    authOk();
    allowRateLimit();
    fetchMock.mockResolvedValue(jsonResponse({ reply: 'pong' }));
  });

  it('posts the parsed body to ${SUPABASE_URL}/functions/v1/ai-chat with apikey + anon bearer', async () => {
    await route.POST(post({ messages: [{ role: 'user', content: 'hi' }] }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://sb.example.co/functions/v1/ai-chat');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['apikey']).toBe('anon-key-123');
    expect(headers['Authorization']).toBe('Bearer anon-key-123');
    expect(JSON.parse(init.body as string)).toEqual({
      messages: [{ role: 'user', content: 'hi' }],
    });
  });

  it('forwards the caller bearer token verbatim when present', async () => {
    await route.POST(post({ prompt: 'hi' }, { Authorization: 'Bearer user-jwt-token' }));

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer user-jwt-token');
  });

  it('forwards the Accept header so SSE requests reach the function', async () => {
    await route.POST(post({ prompt: 'hi' }, { Accept: 'text/event-stream' }));

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['Accept']).toBe('text/event-stream');
  });

  it('records the request + AI question metric for the verified user', async () => {
    await route.POST(post({ prompt: 'hi' }));
    expect(recordRequestMock).toHaveBeenCalledWith('u-proxy');
    expect(recordAiQuestionMock).toHaveBeenCalledWith('u-proxy');
  });
});

describe('upstream response passthrough', () => {
  beforeEach(() => {
    authOk();
    allowRateLimit();
  });

  it('SSE upstream: raw body passthrough with event-stream headers', async () => {
    fetchMock.mockResolvedValue(
      new Response('data: {"delta":"he"}\n\ndata: {"delta":"llo"}\n\n', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      }),
    );

    const res = await route.POST(post({ prompt: 'hi' }, { Accept: 'text/event-stream' }));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    expect(res.headers.get('Connection')).toBe('keep-alive');
    await expect(res.text()).resolves.toBe('data: {"delta":"he"}\n\ndata: {"delta":"llo"}\n\n');
  });

  it('JSON upstream: status + body forwarded unchanged', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ reply: 'answer', extra: [1, 2] }, 200));

    const res = await route.POST(post({ prompt: 'hi' }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ reply: 'answer', extra: [1, 2] });
  });

  it('JSON upstream error status is propagated (not swallowed as 200)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'upstream broke' }, 502));

    const res = await route.POST(post({ prompt: 'hi' }));
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: 'upstream broke' });
  });

  it('a non-event-stream content-type never takes the SSE branch', async () => {
    fetchMock.mockResolvedValue(
      new Response('plain', { status: 200, headers: { 'content-type': 'text/plain' } }),
    );

    const res = await route.POST(post({ prompt: 'hi' }));
    // Falls to response.json() — plain text is not JSON, so the catch turns
    // it into the uniform 500. Pin that the SSE headers are absent.
    expect(res.headers.get('content-type')).not.toBe('text/event-stream');
  });
});

describe('error containment', () => {
  it('a fetch failure maps to the uniform 500', async () => {
    authOk();
    allowRateLimit();
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await route.POST(post({ prompt: 'hi' }));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Internal server error' });
  });
});

describe('misconfigured deployment (missing Supabase env)', () => {
  it('returns 500 before calling the upstream when env vars are absent at module load', async () => {
    // Fresh module instance with empty env constants (module-level read).
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    const fresh = await import('../route');

    authOk();
    allowRateLimit();

    const res = await fresh.POST(post({ prompt: 'hi' }));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Internal server error' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
