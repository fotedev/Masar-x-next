import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

// syncUserProfile — create-or-selectively-merge profile sync. Seams:
//   - '@/lib/supabase/server'  → session client (auth.getUser)
//   - '@/lib/supabase/admin'   → service-role client (shared chain-recording mock)
//   - 'next/cache'             → revalidatePath spy
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { createSupabaseMock, type RecordedChain } from '../../test/mocks/supabase';
import { syncUserProfile } from '../auth';

const createClientMock = vi.mocked(createClient);
const getSupabaseAdminMock = vi.mocked(getSupabaseAdmin);
const revalidatePathMock = vi.mocked(revalidatePath);

const makeUser = (userMetadata: Record<string, unknown> = {}, id = 'u-sync'): User =>
  ({
    id,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: userMetadata,
    created_at: '2026-01-01T00:00:00Z',
  }) as unknown as User;

const mockSessionUser = (
  user: User | null,
  error: { message: string; code?: string } | null = null,
) =>
  createClientMock.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user }, error }) },
  } as never);

let chain: RecordedChain;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://sb.example.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  chain = createSupabaseMock();
  getSupabaseAdminMock.mockReturnValue(chain.supabase as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const existingProfile = (profile: Record<string, unknown> | null) =>
  chain.respondWith(
    { data: profile, error: null },
    { table: 'profiles', method: 'maybeSingle' },
  );

const insertResult = (error: { message: string; code?: string } | null = null) =>
  chain.respondWith({ data: null, error }, { table: 'profiles', method: 'insert' });

const profilesCalls = () => chain.calls.filter((c) => c.table === 'profiles');

describe('env gate', () => {
  it('fails with "Database not configured" before touching any client', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');

    const result = await syncUserProfile();

    expect(result).toEqual({ success: false, error: 'Database not configured' });
    expect(createClientMock).not.toHaveBeenCalled();
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });
});

describe('session gate', () => {
  it('maps an auth error to "Authentication failed"', async () => {
    mockSessionUser(null, { message: 'JWT expired' });

    const result = await syncUserProfile();
    expect(result).toEqual({ success: false, error: 'Authentication failed' });
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it('maps a missing session to "Not authenticated"', async () => {
    mockSessionUser(null);

    const result = await syncUserProfile();
    expect(result).toEqual({ success: false, error: 'Not authenticated' });
  });
});

describe('create path (no existing profile)', () => {
  beforeEach(() => {
    mockSessionUser(
      makeUser({ full_name: 'Fote Owner', avatar_url: 'https://cdn.example/a.png' }),
    );
    existingProfile(null);
  });

  it('inserts a profile from the OAuth metadata', async () => {
    insertResult();

    const result = await syncUserProfile();
    expect(result).toEqual({ success: true });

    const insert = profilesCalls().find((c) => c.method === 'insert');
    expect(insert?.args[0]).toEqual({
      id: 'u-sync',
      full_name: 'Fote Owner',
      avatar_url: 'https://cdn.example/a.png',
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout');
  });

  it('falls back to user_metadata.name when full_name is absent', async () => {
    mockSessionUser(makeUser({ name: 'Only Name' }));
    insertResult();

    await syncUserProfile();

    const insert = profilesCalls().find((c) => c.method === 'insert');
    expect(insert?.args[0]).toMatchObject({ full_name: 'Only Name' });
  });

  it('inserts nulls when the OAuth metadata carries neither name nor avatar', async () => {
    mockSessionUser(makeUser({}));
    insertResult();

    await syncUserProfile();

    const insert = profilesCalls().find((c) => c.method === 'insert');
    expect(insert?.args[0]).toEqual({ id: 'u-sync', full_name: null, avatar_url: null });
  });

  it('reads the existing profile with the exact select/eq/maybeSingle chain', async () => {
    insertResult();
    await syncUserProfile();

    expect(profilesCalls().find((c) => c.method === 'select')?.args).toEqual([
      'id, full_name, avatar_url',
    ]);
    expect(profilesCalls().find((c) => c.method === 'eq')?.args).toEqual(['id', 'u-sync']);
    // maybeSingle is the terminal verb of the lookup chain (the insert that
    // follows lands later in the recorded calls for the same table).
    expect(profilesCalls().findIndex((c) => c.method === 'maybeSingle')).toBeGreaterThan(
      profilesCalls().findIndex((c) => c.method === 'eq'),
    );
  });

  it('maps an insert failure to an error result (prod-safe message under NODE_ENV=test)', async () => {
    insertResult({ message: 'duplicate key', code: '23505' });

    const result = await syncUserProfile();
    // NODE_ENV is 'test' → not 'development' → generic message.
    expect(result).toEqual({ success: false, error: 'Internal server error' });
  });

  it('surfaces the structured PostgREST message in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    insertResult({ message: 'duplicate key value violates unique constraint', code: '23505' });

    const result = await syncUserProfile();
    expect(result).toEqual({
      success: false,
      error: 'Sync failed: duplicate key value violates unique constraint',
    });
  });
});

describe('selective-merge path (existing profile)', () => {
  it('fills ONLY the empty fields — never overwrites a custom full_name', async () => {
    mockSessionUser(makeUser({ full_name: 'OAuth Name', avatar_url: 'https://cdn.example/new.png' }));
    existingProfile({ id: 'u-sync', full_name: 'Custom Database Name', avatar_url: null });

    const result = await syncUserProfile();
    expect(result).toEqual({ success: true });

    const update = profilesCalls().find((c) => c.method === 'update');
    expect(update?.args[0]).toEqual({ avatar_url: 'https://cdn.example/new.png' });
    expect(profilesCalls().find((c) => c.method === 'eq')?.args).toEqual(['id', 'u-sync']);
    expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout');
  });

  it('fills only full_name when the avatar is already set', async () => {
    mockSessionUser(makeUser({ full_name: 'OAuth Name', avatar_url: 'https://cdn.example/other.png' }));
    existingProfile({ id: 'u-sync', full_name: null, avatar_url: 'https://cdn.example/kept.png' });

    await syncUserProfile();

    const update = profilesCalls().find((c) => c.method === 'update');
    expect(update?.args[0]).toEqual({ full_name: 'OAuth Name' });
  });

  it('issues NO update when both fields are already populated', async () => {
    mockSessionUser(makeUser({ full_name: 'OAuth Name', avatar_url: 'https://cdn.example/new.png' }));
    existingProfile({ id: 'u-sync', full_name: 'Custom', avatar_url: 'https://cdn.example/custom.png' });

    const result = await syncUserProfile();
    expect(result).toEqual({ success: true });
    expect(profilesCalls().some((c) => c.method === 'update')).toBe(false);
    expect(profilesCalls().some((c) => c.method === 'insert')).toBe(false);
    // The cache is still refreshed even on a no-op sync.
    expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout');
  });

  it('treats an empty-string full_name as empty (falsy check) and fills it', async () => {
    mockSessionUser(makeUser({ full_name: 'OAuth Name' }));
    existingProfile({ id: 'u-sync', full_name: '', avatar_url: null });

    await syncUserProfile();

    const update = profilesCalls().find((c) => c.method === 'update');
    expect(update?.args[0]).toEqual({ full_name: 'OAuth Name' });
  });

  it('prefers user_metadata.full_name over user_metadata.name in the merge', async () => {
    mockSessionUser(makeUser({ full_name: 'Full Wins', name: 'Name Loses' }));
    existingProfile({ id: 'u-sync', full_name: null, avatar_url: null });

    await syncUserProfile();

    expect(profilesCalls().find((c) => c.method === 'update')?.args[0]).toEqual({
      full_name: 'Full Wins',
    });
  });
});
