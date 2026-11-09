import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';

// Spec 040 W5 — the updateSession route-protection matrix driven END-TO-END
// through the shared chain-recording Supabase mock. The W4 supabase-proxy
// test pins cookie/BOM mechanics with a hand-rolled client; this file reuses
// createSupabaseMock() so every protection decision can additionally assert
// the exact PostgREST chains (table, columns, filters, terminal verb) that
// produced it.
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from '@supabase/ssr';
import { updateSession } from '../proxy';
import { createSupabaseMock, type RecordedChain } from '../../../test/mocks/supabase';

const createServerClientMock = vi.mocked(createServerClient);

const makeUser = (appMetadata: Record<string, unknown> = {}, id = 'u-1'): User =>
  ({
    id,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: appMetadata,
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  }) as unknown as User;

const req = (path: string) => new NextRequest(`http://localhost:3000${path}`);

const redirectTarget = (response: Response) => response.headers.get('location') ?? '';

let chain: RecordedChain;

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://sb.example.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key-123');
  chain = createSupabaseMock();
  createServerClientMock.mockReset();
  createServerClientMock.mockImplementation((() => chain.supabase) as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const fromCalls = () => chain.calls.filter((c) => c.method === 'from');

describe('anon gate — /non-academic', () => {
  it('redirects to the locale login', async () => {
    chain.supabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);

    const response = await updateSession(req('/ar/non-academic/lectures'));
    expect(response.status).toBe(307);
    expect(redirectTarget(response)).toBe('http://localhost:3000/ar/login');
  });

  it('uses the bare login path when the request has no locale prefix', async () => {
    chain.supabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);

    expect(redirectTarget(await updateSession(req('/non-academic')))).toBe(
      'http://localhost:3000/login',
    );
  });
});

describe('admin gate — app_metadata fast path', () => {
  it.each(['admin', 'doctor', 'student_admin'])(
    'admits role %s without any PostgREST call',
    async (role) => {
      chain.supabase.auth.getUser.mockResolvedValue({
        data: { user: makeUser({ role }) },
        error: null,
      } as never);

      const response = await updateSession(req('/en/admin/users'));
      expect(response.status).toBe(200);
      expect(redirectTarget(response)).toBe('');
      expect(fromCalls()).toHaveLength(0);
    },
  );

  it('a non-admin app_metadata role misses the fast path', async () => {
    chain.supabase.auth.getUser.mockResolvedValue({
      data: { user: makeUser({ role: 'user' }) },
      error: null,
    } as never);
    // maybeSingle() with no row resolves null (NOT []) — without this the
    // mock's default `data: []` is truthy and the gate would open.
    chain.respondWith({ data: null, error: null }, { table: 'admins' });

    // Fallback also misses → bounce.
    const response = await updateSession(req('/ar/admin'));
    expect(redirectTarget(response)).toBe('http://localhost:3000/ar/');
  });
});

describe('admin gate — admins-table fallback', () => {
  it('queries admins(role).eq(user_id).maybeSingle() when app_metadata.role is absent', async () => {
    chain.supabase.auth.getUser.mockResolvedValue({
      data: { user: makeUser({}, 'u-admin-fallback') },
      error: null,
    } as never);
    chain.respondWith({ data: { role: 'moderator' }, error: null }, { table: 'admins' });

    const response = await updateSession(req('/ar/admin-dashboard'));
    expect(response.status).toBe(200);

    expect(fromCalls()).toEqual([{ table: 'admins', method: 'from', args: [] }]);
    const adminsCalls = chain.calls.filter((c) => c.table === 'admins');
    expect(adminsCalls.find((c) => c.method === 'select')?.args).toEqual(['role']);
    expect(adminsCalls.find((c) => c.method === 'eq')?.args).toEqual([
      'user_id',
      'u-admin-fallback',
    ]);
    expect(adminsCalls[adminsCalls.length - 1]?.method).toBe('maybeSingle');
  });

  it('redirects to the locale root when the fallback row is missing', async () => {
    chain.supabase.auth.getUser.mockResolvedValue({
      data: { user: makeUser({ role: 'user' }) },
      error: null,
    } as never);
    chain.respondWith({ data: null, error: null }, { table: 'admins' });

    expect(redirectTarget(await updateSession(req('/en/admin')))).toBe(
      'http://localhost:3000/en/',
    );
  });

  it('does not consult profiles when gating /admin (separate entitlement)', async () => {
    chain.supabase.auth.getUser.mockResolvedValue({
      data: { user: makeUser({ role: 'user' }) },
      error: null,
    } as never);

    await updateSession(req('/ar/admin'));
    expect(chain.calls.filter((c) => c.table === 'profiles')).toHaveLength(0);
  });
});

describe('TRW gate — show_extra_assets', () => {
  it('app_metadata.show_extra_assets fast path admits without PostgREST', async () => {
    chain.supabase.auth.getUser.mockResolvedValue({
      data: { user: makeUser({ show_extra_assets: true }) },
      error: null,
    } as never);

    const response = await updateSession(req('/ar/non-academic'));
    expect(response.status).toBe(200);
    expect(fromCalls()).toHaveLength(0);
  });

  it('falls back to profiles(show_extra_assets).eq(id).single() and admits', async () => {
    chain.supabase.auth.getUser.mockResolvedValue({
      data: { user: makeUser({}, 'u-trw') },
      error: null,
    } as never);
    chain.respondWith({ data: { show_extra_assets: true }, error: null }, { table: 'profiles' });

    const response = await updateSession(req('/en/non-academic/files'));
    expect(response.status).toBe(200);

    expect(fromCalls()).toEqual([{ table: 'profiles', method: 'from', args: [] }]);
    const profilesCalls = chain.calls.filter((c) => c.table === 'profiles');
    expect(profilesCalls.find((c) => c.method === 'select')?.args).toEqual([
      'show_extra_assets',
    ]);
    expect(profilesCalls.find((c) => c.method === 'eq')?.args).toEqual(['id', 'u-trw']);
    expect(profilesCalls[profilesCalls.length - 1]?.method).toBe('single');
  });

  it('bounces to the locale root when the profiles fallback is falsy', async () => {
    chain.supabase.auth.getUser.mockResolvedValue({
      data: { user: makeUser({}) },
      error: null,
    } as never);
    chain.respondWith({ data: { show_extra_assets: false }, error: null }, { table: 'profiles' });

    expect(redirectTarget(await updateSession(req('/ar/non-academic')))).toBe(
      'http://localhost:3000/ar/',
    );
  });

  it('an admin app_metadata role does NOT fast-path the TRW gate', async () => {
    chain.supabase.auth.getUser.mockResolvedValue({
      data: { user: makeUser({ role: 'admin' }) },
      error: null,
    } as never);
    chain.respondWith({ data: null, error: null }, { table: 'profiles' });

    expect(redirectTarget(await updateSession(req('/ar/non-academic')))).toBe(
      'http://localhost:3000/ar/',
    );
  });
});

describe('protected user routes — auth required', () => {
  it.each([
    '/ar/profile',
    '/en/quiz-attempts',
    '/ar/add-video',
    '/en/add-file',
    '/en/profile/settings',
  ])('anon %s → locale login', async (path) => {
    chain.supabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);

    const expectedLocale = path.startsWith('/ar') ? 'ar' : 'en';
    expect(redirectTarget(await updateSession(req(path)))).toBe(
      `http://localhost:3000/${expectedLocale}/login`,
    );
  });

  it.each([
    '/ar/profile',
    '/en/quiz-attempts',
    '/ar/add-video',
    '/en/add-file',
  ])('authenticated user passes %s with no role or DB check', async (path) => {
    chain.supabase.auth.getUser.mockResolvedValue({
      data: { user: makeUser({}) },
      error: null,
    } as never);

    const response = await updateSession(req(path));
    expect(response.status).toBe(200);
    expect(fromCalls()).toHaveLength(0);
  });
});

describe('non-protected routes pass through', () => {
  it('anon /ar/materials → 200 with no redirect and no PostgREST calls', async () => {
    chain.supabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);

    const response = await updateSession(req('/ar/materials'));
    expect(response.status).toBe(200);
    expect(redirectTarget(response)).toBe('');
    expect(fromCalls()).toHaveLength(0);
  });

  it('the /admin prefix does not swallow /administrivia-style siblings', async () => {
    // startsWith('/admin') DOES match '/administrators' — pin that reality:
    // any path under the /admin* prefix requires the admin gate.
    chain.supabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);

    expect(redirectTarget(await updateSession(req('/en/administrators')))).toBe(
      'http://localhost:3000/en/login',
    );
  });
});
