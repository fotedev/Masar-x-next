import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// /api/health/db — connectivity probe behind the same bearer contract as
// /api/mcp. The spec 040 seam exports isAuthorized; getSupabaseAdmin is the
// client seam for the probe itself.
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { GET, isAuthorized } from '../route';

const getSupabaseAdminMock = vi.mocked(getSupabaseAdmin);

const SECRET = 'health-secret';

const req = (headers: Record<string, string> = {}) =>
  new Request('https://masarx.example/api/health/db', { headers });

/** PostgREST head-probe builder: `from().select(id, {head}).limit(1)`. */
const mockAdminProbe = (result: { data: unknown; error: unknown }) => {
  const limit = vi.fn(async () => result);
  const select = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ select }));
  getSupabaseAdminMock.mockReturnValue({ from } as never);
  return { from, select, limit };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('HEALTH_CHECK_SECRET', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isAuthorized — env matrix', () => {
  it('FAILS CLOSED in production without HEALTH_CHECK_SECRET', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('HEALTH_CHECK_SECRET', '');

    expect(isAuthorized(req())).toBe(false);
  });

  it('production fails closed even with a bearer header present', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('HEALTH_CHECK_SECRET', '');

    expect(isAuthorized(req({ authorization: 'Bearer guess' }))).toBe(false);
  });

  it('dev/preview stays open without a secret', () => {
    expect(isAuthorized(req())).toBe(true);
  });

  it('accepts the exact bearer token when configured', () => {
    vi.stubEnv('HEALTH_CHECK_SECRET', SECRET);
    expect(isAuthorized(req({ authorization: `Bearer ${SECRET}` }))).toBe(true);
  });

  it.each([
    ['Bearer wrong', 'mismatched token'],
    [SECRET, 'raw secret, no Bearer prefix'],
  ])('rejects "%s" (%s)', (header) => {
    vi.stubEnv('HEALTH_CHECK_SECRET', SECRET);
    expect(isAuthorized(req({ authorization: header }))).toBe(false);
  });

  it('rejects a missing Authorization header when a secret is configured', () => {
    vi.stubEnv('HEALTH_CHECK_SECRET', SECRET);
    expect(isAuthorized(req())).toBe(false);
  });
});

describe('GET — probe contract', () => {
  it('returns 403 for an unauthorized caller without touching the admin client', async () => {
    // Production + no secret → fail-closed before the probe.
    vi.stubEnv('NODE_ENV', 'production');

    const res = await GET(req());
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it('reports healthy with probe=supabase-rest on a clean round-trip', async () => {
    mockAdminProbe({ data: null, error: null });

    const res = await GET(req());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.database).toBe('connected');
    expect(body.probe).toBe('supabase-rest');
    expect(typeof body.latency).toBe('string');
    expect(body.latency).toMatch(/ms$/);
    expect(typeof body.timestamp).toBe('string');
  });

  it('reports unhealthy with the PostgREST error fields on probe failure', async () => {
    mockAdminProbe({ data: null, error: { message: 'relation missing', code: '42P01' } });

    const res = await GET(req());
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.status).toBe('unhealthy');
    expect(body.database).toBe('disconnected');
    expect(body.error).toBe('relation missing');
    expect(body.code).toBe('42P01');
    expect(body.probe).toBe('supabase-rest');
  });

  it('issues exactly one head probe against profiles', async () => {
    const { from, select, limit } = mockAdminProbe({ data: null, error: null });

    await GET(req());
    expect(from).toHaveBeenCalledWith('profiles');
    expect(select).toHaveBeenCalledWith('id', { head: true });
    expect(limit).toHaveBeenCalledWith(1);
  });

  it('maps a thrown admin-client construction to the unhealthy 500', async () => {
    getSupabaseAdminMock.mockImplementation(() => {
      throw new Error('Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL');
    });

    const res = await GET(req());
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.status).toBe('unhealthy');
    expect(body.database).toBe('disconnected');
    expect(body.error).toContain('Supabase admin client requires');
  });
});
