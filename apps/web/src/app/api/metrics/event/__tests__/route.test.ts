import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';

// POST /api/metrics/event — lean-metrics ingestion. Real api-auth; mocked
// seams: '@/lib/supabase/server' (auth client) and '@/lib/metrics' (Redis
// counters — mocking also bypasses the module's server-only import).
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/metrics', () => ({
  recordFileDownload: vi.fn(),
  pingActiveUser: vi.fn(),
  recordAiQuestion: vi.fn(),
  isRedisConfigured: vi.fn(() => true),
}));

import { createClient } from '@/lib/supabase/server';
import { pingActiveUser, recordFileDownload } from '@/lib/metrics';
import { POST } from '../route';

const createClientMock = vi.mocked(createClient);
const recordFileDownloadMock = vi.mocked(recordFileDownload);
const pingActiveUserMock = vi.mocked(pingActiveUser);

const makeUser = (id = 'u-metrics'): User =>
  ({
    id,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  }) as unknown as User;

const authOk = (id?: string) =>
  createClientMock.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: makeUser(id) }, error: null }) },
  } as never);

const authFail = () =>
  createClientMock.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  } as never);

const post = (body: unknown) =>
  new NextRequest('http://localhost:3000/api/metrics/event', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('authentication gate', () => {
  it('rejects an unauthenticated caller with the shared 401 shape', async () => {
    authFail();

    const res = await POST(post({ type: 'active_ping' }));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: 'Unauthorized',
      message: 'Valid authentication required',
    });
    expect(recordFileDownloadMock).not.toHaveBeenCalled();
    expect(pingActiveUserMock).not.toHaveBeenCalled();
  });
});

describe('discriminated-union schema', () => {
  beforeEach(() => authOk());

  it('rejects an unknown event type', async () => {
    const res = await POST(post({ type: 'page_view', path: '/ar' }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: 'Invalid request body' });
    expect(recordFileDownloadMock).not.toHaveBeenCalled();
    expect(pingActiveUserMock).not.toHaveBeenCalled();
  });

  it('rejects a missing type discriminator', async () => {
    const res = await POST(post({ id: 'f1' }));
    expect(res.status).toBe(400);
  });

  it('rejects malformed JSON bodies', async () => {
    const res = await POST(post('{nope'));
    expect(res.status).toBe(400);
  });

  it('rejects a non-object payload', async () => {
    const res = await POST(post('"active_ping"'));
    expect(res.status).toBe(400);
  });

  it('routes a download event to recordFileDownload with the user id and payload', async () => {
    const payload = { type: 'download', id: 'file-1', title: 'Lecture notes', fileUrl: 'https://cdn.example/f.pdf' };

    const res = await POST(post(payload));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(recordFileDownloadMock).toHaveBeenCalledWith('u-metrics', payload);
    expect(pingActiveUserMock).not.toHaveBeenCalled();
  });

  it('strips unknown keys from a download event (zod default)', async () => {
    await POST(post({ type: 'download', id: 'f1', injected: 'evil' }));
    expect(recordFileDownloadMock).toHaveBeenCalledWith('u-metrics', { type: 'download', id: 'f1' });
  });

  it('routes an active_ping to pingActiveUser (and nothing else)', async () => {
    const res = await POST(post({ type: 'active_ping' }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(pingActiveUserMock).toHaveBeenCalledWith('u-metrics');
    expect(recordFileDownloadMock).not.toHaveBeenCalled();
  });

  it('a download with only the type field is valid (all optionals omitted)', async () => {
    const res = await POST(post({ type: 'download' }));
    expect(res.status).toBe(200);
    expect(recordFileDownloadMock).toHaveBeenCalledWith('u-metrics', { type: 'download' });
  });
});

describe('optional field length caps', () => {
  beforeEach(() => authOk());

  it.each([
    ['id', 200, 201],
    ['title', 200, 201],
    ['fileUrl', 500, 501],
  ])('%s: exactly %d chars passes, %d chars → 400', async (field, okLen, badLen) => {
    const okRes = await POST(post({ type: 'download', [field]: 'a'.repeat(okLen) }));
    expect(okRes.status).toBe(200);

    const badRes = await POST(post({ type: 'download', [field]: 'a'.repeat(badLen) }));
    expect(badRes.status).toBe(400);
  });
});
