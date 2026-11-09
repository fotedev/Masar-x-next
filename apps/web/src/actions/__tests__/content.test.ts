import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

// addFile / addVideo server actions. Seams:
//   - '@/lib/supabase/server' → ensureAdmin's session client
//   - '@/lib/supabase/admin'  → service-role client (shared chain-recording mock)
//   - 'next/cache'            → revalidatePath spy
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { createSupabaseMock, type RecordedChain } from '../../test/mocks/supabase';
import { addFile, addVideo } from '../content';

const createClientMock = vi.mocked(createClient);
const getSupabaseAdminMock = vi.mocked(getSupabaseAdmin);
const revalidatePathMock = vi.mocked(revalidatePath);

const makeUser = (role?: string, id = 'u-admin'): User =>
  ({
    id,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: role ? { role } : {},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  }) as unknown as User;

const mockSessionUser = (user: User | null) =>
  createClientMock.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user }, error: null }) },
  } as never);

let chain: RecordedChain;

const formData = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
};

const VALID_FILE = {
  title: 'Real Analysis notes',
  subject: 'Real Analysis',
  fileUrl: 'https://cdn.example/notes.pdf',
  description: 'Week 1 notes',
  lectureKey: 'lecture-1',
};

const VALID_VIDEO = {
  title: 'Real Analysis lecture',
  subject: 'Real Analysis',
  url: 'https://youtube.com/watch?v=abc',
  language: 'en',
  lectureKey: 'lecture-1',
};

beforeEach(() => {
  vi.clearAllMocks();
  chain = createSupabaseMock();
  getSupabaseAdminMock.mockReturnValue(chain.supabase as never);
  // Happy-path lookups: subject found, lecture found.
  chain.respondWith({ data: [{ id: 'sub-1' }], error: null }, { table: 'subjects' });
  chain.respondWith(
    { data: [{ id: 'lec-1' }], error: null },
    { table: 'subject_lectures' },
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('ensureAdmin role gate (shared by both actions)', () => {
  it('rejects an unauthenticated caller before any validation or DB work', async () => {
    mockSessionUser(null);

    const result = await addFile({}, formData(VALID_FILE));
    expect(result).toEqual({ success: false, error: 'Not authenticated' });
    expect(chain.calls.filter((c) => c.method === 'from')).toHaveLength(0);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('rejects a non-admin app_metadata role', async () => {
    mockSessionUser(makeUser('user'));
    expect(await addFile({}, formData(VALID_FILE))).toEqual({
      success: false,
      error: 'Not authorized',
    });
  });

  it('rejects a missing role', async () => {
    mockSessionUser(makeUser(undefined));
    expect(await addVideo({}, formData(VALID_VIDEO))).toEqual({
      success: false,
      error: 'Not authorized',
    });
  });

  it.each(['admin', 'doctor', 'student_admin'])('admits role %s', async (role) => {
    mockSessionUser(makeUser(role));
    const result = await addFile({}, formData(VALID_FILE));
    expect(result.success).toBe(true);
  });
});

describe('addFile — zod validation', () => {
  beforeEach(() => mockSessionUser(makeUser('admin')));

  it('rejects a title shorter than 3 characters', async () => {
    const result = await addFile({}, formData({ ...VALID_FILE, title: 'ab' }));
    expect(result).toEqual({ success: false, error: 'Title must be at least 3 characters' });
  });

  it('rejects a non-URL fileUrl', async () => {
    const result = await addFile({}, formData({ ...VALID_FILE, fileUrl: 'not-a-url' }));
    expect(result).toEqual({ success: false, error: 'Invalid file URL' });
  });
});

describe('addVideo — zod validation', () => {
  beforeEach(() => mockSessionUser(makeUser('admin')));

  it('rejects a title shorter than 3 characters', async () => {
    const result = await addVideo({}, formData({ ...VALID_VIDEO, title: 'ab' }));
    expect(result).toEqual({ success: false, error: 'Title must be at least 3 characters' });
  });

  it('rejects a non-URL video url', async () => {
    const result = await addVideo({}, formData({ ...VALID_VIDEO, url: 'youtube.com/x' }));
    expect(result).toEqual({ success: false, error: 'Invalid video URL' });
  });

  it('a MISSING language field fails validation (FormData null is not rescued by the zod default)', async () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(VALID_VIDEO)) {
      if (k !== 'language') fd.set(k, v);
    }

    const result = await addVideo({}, fd);
    expect(result.success).toBe(false);
    expect(typeof (result as { error: string }).error).toBe('string');
  });
});

describe('addFile — happy path + subject/lecture resolution', () => {
  beforeEach(() => mockSessionUser(makeUser('admin')));

  it('inserts into files with resolved subject_id + lecture_id and revalidates the subject page', async () => {
    const result = await addFile({}, formData(VALID_FILE));

    expect(result).toEqual({ success: true, message: 'File added successfully' });

    const insert = chain.calls.find((c) => c.table === 'files' && c.method === 'insert');
    expect(insert?.args[0]).toEqual(
      expect.objectContaining({
        title: 'Real Analysis notes',
        subject: 'Real Analysis',
        subject_id: 'sub-1',
        file_url: 'https://cdn.example/notes.pdf',
        description: 'Week 1 notes',
        user_id: 'u-admin',
        lecture_key: 'lecture-1',
        lecture_id: 'lec-1',
      }),
    );

    const subjectsCalls = chain.calls.filter((c) => c.table === 'subjects');
    expect(subjectsCalls.find((c) => c.method === 'select')?.args).toEqual(['id']);
    expect(subjectsCalls.find((c) => c.method === 'eq')?.args).toEqual(['name', 'Real Analysis']);
    expect(subjectsCalls.find((c) => c.method === 'limit')?.args).toEqual([1]);

    const lectureCalls = chain.calls.filter((c) => c.table === 'subject_lectures');
    expect(lectureCalls.filter((c) => c.method === 'eq').map((c) => c.args)).toEqual([
      ['subject', 'Real Analysis'],
      ['lecture_key', 'lecture-1'],
    ]);

    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/[locale]/subjects/${encodeURIComponent('Real Analysis')}`,
      'page',
    );
  });

  it('resolves a lecture via subject_lectures when the subject was found', async () => {
    await addFile({}, formData(VALID_FILE));
    expect(chain.calls.some((c) => c.table === 'subject_lectures')).toBe(true);
  });

  it('null-propagates when the subject is unknown — no lecture lookup, no ids', async () => {
    chain.respondWith({ data: [], error: null }, { table: 'subjects' });

    const result = await addFile({}, formData(VALID_FILE));
    expect(result).toEqual({ success: true, message: 'File added successfully' });

    const insert = chain.calls.find((c) => c.table === 'files' && c.method === 'insert');
    expect(insert?.args[0]).toMatchObject({ subject_id: null, lecture_id: null });
    expect(chain.calls.some((c) => c.table === 'subject_lectures')).toBe(false);
  });

  it('skips the lecture lookup when no lectureKey was provided', async () => {
    await addFile(
      {},
      formData({ ...VALID_FILE, lectureKey: '' }),
    );

    const insert = chain.calls.find((c) => c.table === 'files' && c.method === 'insert');
    expect(insert?.args[0]).toMatchObject({ lecture_id: null, lecture_key: null });
    expect(chain.calls.some((c) => c.table === 'subject_lectures')).toBe(false);
  });

  it('maps an insert failure to the generic error', async () => {
    chain.respondWith(
      { data: null, error: { message: 'violates RLS policy', code: '42501' } },
      { table: 'files' },
    );

    const result = await addFile({}, formData(VALID_FILE));
    expect(result).toEqual({ success: false, error: 'Internal server error' });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe('addVideo — happy path', () => {
  beforeEach(() => mockSessionUser(makeUser('doctor')));

  it('inserts into videos with the given language and revalidates the subject page', async () => {
    const result = await addVideo({}, formData(VALID_VIDEO));

    expect(result).toEqual({ success: true, message: 'Video added successfully' });

    const insert = chain.calls.find((c) => c.table === 'videos' && c.method === 'insert');
    expect(insert?.args[0]).toEqual(
      expect.objectContaining({
        title: 'Real Analysis lecture',
        subject: 'Real Analysis',
        subject_id: 'sub-1',
        url: 'https://youtube.com/watch?v=abc',
        language: 'en',
        user_id: 'u-admin',
        lecture_key: 'lecture-1',
        lecture_id: 'lec-1',
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/[locale]/subjects/${encodeURIComponent('Real Analysis')}`,
      'page',
    );
  });

  it('an explicit language=ar flows through unchanged', async () => {
    await addVideo({}, formData({ ...VALID_VIDEO, language: 'ar' }));
    const insert = chain.calls.find((c) => c.table === 'videos' && c.method === 'insert');
    expect(insert?.args[0]).toMatchObject({ language: 'ar' });
  });
});
