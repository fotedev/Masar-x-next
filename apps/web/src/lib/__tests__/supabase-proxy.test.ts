import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';

// proxy.ts's only external seam is @supabase/ssr. The mock captures the
// cookie adapter updateSession hands to the SDK and returns whatever
// `supabaseImpl` currently holds, so each test controls the user/profiles/
// admins answers the protection matrix needs.
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from '@supabase/ssr';
import { updateSession } from '../supabase/proxy';
import { stripBOM } from '../supabase/utils';

const createServerClientMock = vi.mocked(createServerClient);

type CookieAdapter = {
  getAll: () => Array<{ name: string; value: string }>;
  setAll: (list: Array<{ name: string; value: string; options?: object }>) => void;
};

const ssrState: { cookies: CookieAdapter | null } = { cookies: null };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseImpl: any;

const makeUser = (overrides: Partial<Record<string, unknown>> = {}): User =>
  ({
    id: 'u-1',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }) as unknown as User;

/**
 * Minimal supabase client shape proxy.ts touches: auth.getUser, and the
 * two PostgREST fallbacks (profiles.single / admins.maybeSingle).
 */
const makeSupabase = ({
  user = null,
  profiles = null,
  admins = null,
  persistOnGetUser = null,
}: {
  user?: User | null;
  profiles?: Record<string, unknown> | null;
  admins?: Record<string, unknown> | null;
  persistOnGetUser?: Array<{ name: string; value: string; options?: object }> | null;
}) => {
  const from = vi.fn((table: string) => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      single: async () => ({ data: table === 'profiles' ? profiles : null, error: null }),
      maybeSingle: async () => ({ data: table === 'admins' ? admins : null, error: null }),
    };
    return builder;
  });
  return {
    auth: {
      getUser: async () => {
        if (persistOnGetUser && ssrState.cookies) {
          ssrState.cookies.setAll(persistOnGetUser);
        }
        return { data: { user }, error: null };
      },
    },
    from,
  };
};

const req = (path: string, cookieHeader?: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });

const redirectTarget = (response: Response) => response.headers.get('location') ?? '';

beforeEach(() => {
  createServerClientMock.mockReset();
  createServerClientMock.mockImplementation(((_url: string, _key: string, config: { cookies: CookieAdapter }) => {
    ssrState.cookies = config.cookies;
    return supabaseImpl;
  }) as never);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://sb.example.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key-123');
});

afterEach(() => {
  vi.unstubAllEnvs();
  ssrState.cookies = null;
  supabaseImpl = undefined;
});

describe('updateSession — env + cookie BOM stripping (undici crash fix)', () => {
  it('strips a BOM from the Supabase env vars before the SDK sees them', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '\uFEFFhttps://sb.example.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '\uFEFFanon-key-123');
    supabaseImpl = makeSupabase({ user: null });

    await updateSession(req('/en'));
    expect(createServerClientMock).toHaveBeenCalledWith(
      'https://sb.example.co',
      'anon-key-123',
      expect.objectContaining({ cookies: expect.any(Object) }),
    );
  });

  it('strips the BOM from request cookies on getAll', async () => {
    supabaseImpl = makeSupabase({ user: null });
    // A raw U+FEFF cannot ride in a Cookie header (undici rejects it at
    // Headers construction — that IS the production crash), so the BOM'd
    // value is injected through the request cookie store the way a stale
    // @supabase/ssr write would have left it.
    const request = req('/en');
    request.cookies.set('sb-auth-token', '\uFEFFold-session-value');
    await updateSession(request);

    expect(ssrState.cookies!.getAll()).toEqual([
      { name: 'sb-auth-token', value: 'old-session-value' },
    ]);
  });

  it('strips the BOM on setAll in BOTH directions (request store + response Set-Cookie)', async () => {
    // The SDK "persists refreshed tokens" by calling setAll during getUser.
    supabaseImpl = makeSupabase({
      user: null,
      persistOnGetUser: [{ name: 'sb-auth-token', value: '\uFEFFrefreshed-value', options: { httpOnly: true } }],
    });

    const response = await updateSession(req('/en', 'sb-auth-token=stale'));

    // Request cookie store is clean.
    expect(req).toBeDefined();
    const requestCookies = createServerClientMock.mock.calls[0]?.[2];
    expect(requestCookies).toBeDefined();

    // Response carries the cleaned Set-Cookie (no U+FEFF anywhere).
    const setCookie = response.headers.getSetCookie?.() ?? [response.headers.get('set-cookie') ?? ''];
    const joined = setCookie.join('|');
    expect(joined).toContain('sb-auth-token=refreshed-value');
    expect(joined.includes('\uFEFF')).toBe(false);
    expect(response.cookies.get('sb-auth-token')?.value).toBe('refreshed-value');
  });

  it('passes already-clean cookies through untouched', async () => {
    supabaseImpl = makeSupabase({ user: null });
    await updateSession(req('/en', 'sb-auth-token=clean-value'));
    expect(ssrState.cookies!.getAll()).toEqual([{ name: 'sb-auth-token', value: 'clean-value' }]);
  });
});

describe('updateSession — route protection matrix', () => {
  it('redirects anon users from /non-academic to the locale login', async () => {
    supabaseImpl = makeSupabase({ user: null });
    const response = await updateSession(req('/ar/non-academic'));
    expect(response.status).toBe(307);
    expect(redirectTarget(response)).toBe('http://localhost:3000/ar/login');
  });

  it('redirects anon users from /admin and /admin-dashboard to the locale login', async () => {
    supabaseImpl = makeSupabase({ user: null });
    expect(redirectTarget(await updateSession(req('/ar/admin')))).toBe(
      'http://localhost:3000/ar/login',
    );
    expect(redirectTarget(await updateSession(req('/en/admin-dashboard/zzz')))).toBe(
      'http://localhost:3000/en/login',
    );
  });

  it('redirects anon users from protected user routes to the locale login', async () => {
    supabaseImpl = makeSupabase({ user: null });
    for (const path of ['/ar/profile', '/en/quiz-attempts', '/ar/add-video', '/en/add-file']) {
      const expectedLocale = path.startsWith('/ar') ? 'ar' : 'en';
      expect(redirectTarget(await updateSession(req(path)))).toBe(
        `http://localhost:3000/${expectedLocale}/login`,
      );
    }
  });

  it('lets non-protected routes through for anon users', async () => {
    supabaseImpl = makeSupabase({ user: null });
    const response = await updateSession(req('/ar/materials'));
    expect(response.status).toBe(200);
    expect(redirectTarget(response)).toBe('');
  });

  it('app_metadata.role fast-path admits admins without touching the admins table', async () => {
    const from = vi.fn();
    supabaseImpl = {
      auth: { getUser: async () => ({ data: { user: makeUser({ app_metadata: { role: 'admin' } }) }, error: null }) },
      from,
    };
    const response = await updateSession(req('/ar/admin/users'));
    expect(response.status).toBe(200);
    expect(from).not.toHaveBeenCalled();
  });

  it('admits doctor and student_admin roles via the fast-path', async () => {
    for (const role of ['doctor', 'student_admin']) {
      supabaseImpl = makeSupabase({ user: makeUser({ app_metadata: { role } }) });
      expect((await updateSession(req('/en/admin'))).status).toBe(200);
    }
  });

  it('falls back to the admins table when app_metadata.role is not an admin role', async () => {
    supabaseImpl = makeSupabase({
      user: makeUser({ app_metadata: { role: 'user' } }),
      admins: { role: 'moderator' },
    });
    const response = await updateSession(req('/ar/admin'));
    expect(response.status).toBe(200);
    expect(supabaseImpl.from).toHaveBeenCalledWith('admins');
  });

  it('bounces non-admin users when the admins-table fallback also misses', async () => {
    supabaseImpl = makeSupabase({ user: makeUser({ app_metadata: { role: 'user' } }), admins: null });
    const response = await updateSession(req('/ar/admin'));
    expect(redirectTarget(response)).toBe('http://localhost:3000/ar/');
  });

  it('TRW gate: show_extra_assets metadata fast-path admits the user', async () => {
    const from = vi.fn();
    supabaseImpl = {
      auth: {
        getUser: async () => ({
          data: { user: makeUser({ app_metadata: { show_extra_assets: true } }) },
          error: null,
        }),
      },
      from,
    };
    const response = await updateSession(req('/ar/non-academic'));
    expect(response.status).toBe(200);
    expect(from).not.toHaveBeenCalled();
  });

  it('TRW gate: falls back to the profiles table when metadata is missing', async () => {
    supabaseImpl = makeSupabase({
      user: makeUser({ app_metadata: { role: 'admin' } }),
      profiles: { show_extra_assets: true },
    });
    const response = await updateSession(req('/ar/non-academic'));
    expect(response.status).toBe(200);
    expect(supabaseImpl.from).toHaveBeenCalledWith('profiles');
  });

  it('TRW gate: bounces users without extra assets after the profiles fallback', async () => {
    supabaseImpl = makeSupabase({
      user: makeUser({ app_metadata: {} }),
      profiles: { show_extra_assets: false },
    });
    const response = await updateSession(req('/ar/non-academic'));
    expect(redirectTarget(response)).toBe('http://localhost:3000/ar/');
  });

  it('admin role does NOT fast-path the TRW gate (separate entitlement)', async () => {
    supabaseImpl = makeSupabase({
      user: makeUser({ app_metadata: { role: 'admin' } }),
      profiles: { show_extra_assets: false },
    });
    expect(redirectTarget(await updateSession(req('/ar/non-academic')))).toBe(
      'http://localhost:3000/ar/',
    );
  });
});

describe('updateSession — locale-prefix regex ^\\/(ar|en)(\\/|$)', () => {
  it('matches both locale forms and computes the un-prefixed path', async () => {
    supabaseImpl = makeSupabase({ user: null });
    // /ar + / → protected non-academic path with /ar prefix
    expect(redirectTarget(await updateSession(req('/ar/non-academic')))).toContain('/ar/login');
    // /en at the root ($ end) — bare locale path, nothing protected
    expect((await updateSession(req('/en'))).status).toBe(200);
  });

  it('does NOT treat /arabic/... as the ar locale (prefix not a word boundary)', async () => {
    supabaseImpl = makeSupabase({ user: null });
    // localeMatch fails → localePrefix '' → pathWithoutLocale keeps the full
    // path, which does not start with /non-academic → no protection.
    const response = await updateSession(req('/arabic/non-academic'));
    expect(response.status).toBe(200);
    expect(redirectTarget(response)).toBe('');
  });

  it('protects paths with no locale prefix using the bare login path', async () => {
    supabaseImpl = makeSupabase({ user: null });
    expect(redirectTarget(await updateSession(req('/profile')))).toBe(
      'http://localhost:3000/login',
    );
  });
});

describe('stripBOM', () => {
  it('strips a single leading U+FEFF', () => {
    expect(stripBOM('\uFEFFabc')).toBe('abc');
    expect(stripBOM('\uFEFF')).toBe('');
  });

  it('is idempotent', () => {
    const once = stripBOM('\uFEFFsession-token');
    expect(stripBOM(once)).toBe(once);
    expect(stripBOM(stripBOM(stripBOM('\uFEFFx')))).toBe('x');
  });

  it('leaves clean strings, interior BOMs and empty strings untouched', () => {
    expect(stripBOM('abc')).toBe('abc');
    expect(stripBOM('a\uFEFFb')).toBe('a\uFEFFb');
    expect(stripBOM('')).toBe('');
  });
});
