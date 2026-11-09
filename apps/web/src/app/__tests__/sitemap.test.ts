import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// sitemap.ts — static entries + dynamic subject/course/summary mapping.
// 'masarx-shared/supabase' is mocked at the source (the vitest alias maps
// the specifier to packages/shared/src/supabase/index.ts); env is stubbed
// per test because getSupabaseClient() reads env at call time.
vi.mock('masarx-shared/supabase', () => ({
  createSupabaseClient: vi.fn(),
}));

import { createSupabaseClient } from 'masarx-shared/supabase';
import sitemap from '../sitemap';

const createSupabaseClientMock = vi.mocked(createSupabaseClient);

type Row = Record<string, unknown>;

/** Per-table thenable builder matching the three shapes sitemap awaits. */
const makeClient = (tables: Record<string, Row[] | null>) => {
  const eqCalls: Array<[string, string]> = [];
  const selectCalls: Array<[string, unknown?]> = [];
  const fromCalls: string[] = [];

  const client = {
    from: vi.fn((table: string) => {
      fromCalls.push(table);
      const result = { data: tables[table] ?? null, error: null };
      return {
        select: vi.fn((columns: string, options?: unknown) => {
          selectCalls.push([columns, options]);
          return {
            eq: vi.fn((column: string, value: string) => {
              eqCalls.push([column, value]);
              return Promise.resolve(result);
            }),
            then: (
              onFulfilled: (value: { data: Row[] | null; error: unknown }) => unknown,
              onRejected?: (reason: unknown) => unknown,
            ) => Promise.resolve(result).then(onFulfilled, onRejected),
          };
        }),
      };
    }),
    fromCalls,
    selectCalls,
    eqCalls,
  };
  return client;
};

beforeEach(() => {
  createSupabaseClientMock.mockReset();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://sb.example.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key-123');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('env-missing graceful degradation', () => {
  it('returns static entries only when Supabase env vars are absent', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    // No factory mock setup — the route must short-circuit before calling it.

    const entries = await sitemap();

    expect(entries).toHaveLength(7);
    expect(createSupabaseClientMock).not.toHaveBeenCalled();
    expect(entries.map((e) => e.url)).toEqual([
      'https://masarx.vercel.app',
      'https://masarx.vercel.app/subjects',
      'https://masarx.vercel.app/quizzes',
      'https://masarx.vercel.app/courses',
      'https://masarx.vercel.app/news',
      'https://masarx.vercel.app/faq',
      'https://masarx.vercel.app/privacy-policy',
    ]);
  });

  it('static entries carry their priorities and change frequencies', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');

    const entries = await sitemap();

    expect(entries.map((e) => e.priority)).toEqual([1, 0.9, 0.9, 0.8, 0.7, 0.5, 0.3]);
    expect(entries.map((e) => e.changeFrequency)).toEqual([
      'daily',
      'daily',
      'daily',
      'weekly',
      'weekly',
      'monthly',
      'yearly',
    ]);
    for (const entry of entries) {
      expect(entry.lastModified).toBeInstanceOf(Date);
    }
  });
});

describe('full sitemap with dynamic rows', () => {
  it('builds the factory with the runtime contract (web runtime, client-info appVersion)', async () => {
    const client = makeClient({ subjects: [], courses: [], summaries: [] });
    createSupabaseClientMock.mockReturnValue(client as never);

    await sitemap();

    expect(createSupabaseClientMock).toHaveBeenCalledWith({
      runtime: 'web',
      url: 'https://sb.example.co',
      anonKey: 'anon-key-123',
      appVersion: '0.5.6',
    });
  });

  it('maps subjects with name trim + encodeURIComponent', async () => {
    const client = makeClient({
      subjects: [{ name: '  Math & CS ' }, { name: 'Linear Algebra' }],
      courses: [],
      summaries: [],
    });
    createSupabaseClientMock.mockReturnValue(client as never);

    const entries = await sitemap();

    const subjectUrls = entries.map((e) => e.url).filter((u) => u.includes('/subjects/'));
    expect(subjectUrls).toEqual([
      'https://masarx.vercel.app/subjects/Math%20%26%20CS',
      'https://masarx.vercel.app/subjects/Linear%20Algebra',
    ]);
    for (const entry of entries.filter((e) => e.url.includes('/subjects/'))) {
      expect(entry.priority).toBe(0.7);
      expect(entry.changeFrequency).toBe('weekly');
    }
  });

  it('coerces course/summary updated_at into Date lastModified', async () => {
    const client = makeClient({
      subjects: [],
      courses: [{ id: 'course-1', updated_at: '2026-01-15T10:00:00Z' }],
      summaries: [{ id: 'sum-1', updated_at: '2026-02-01T08:30:00Z' }],
    });
    createSupabaseClientMock.mockReturnValue(client as never);

    const entries = await sitemap();

    const course = entries.find((e) => e.url === 'https://masarx.vercel.app/courses/course-1');
    expect(course?.lastModified).toEqual(new Date('2026-01-15T10:00:00Z'));
    expect(course?.priority).toBe(0.7);

    const summary = entries.find((e) => e.url === 'https://masarx.vercel.app/summaries/sum-1');
    expect(summary?.lastModified).toEqual(new Date('2026-02-01T08:30:00Z'));
    expect(summary?.priority).toBe(0.6);
  });

  it('queries exactly subjects(name), courses(id, updated_at) and approved summaries', async () => {
    const client = makeClient({ subjects: [], courses: [], summaries: [] });
    createSupabaseClientMock.mockReturnValue(client as never);

    await sitemap();

    expect(client.fromCalls).toEqual(['subjects', 'courses', 'summaries']);
    expect(client.selectCalls.map(([cols]) => cols)).toEqual([
      'name',
      'id, updated_at',
      'id, updated_at',
    ]);
    expect(client.eqCalls).toEqual([['status', 'approved']]);
  });

  it('degrades to static-only when the queries resolve with null data', async () => {
    const client = makeClient({}); // no table configured → data null
    createSupabaseClientMock.mockReturnValue(client as never);

    const entries = await sitemap();

    expect(entries).toHaveLength(7);
    expect(entries.every((e) => !e.url.includes('/courses/'))).toBe(true);
  });

  it('degrades to static-only when a query throws (error containment)', async () => {
    const throwingClient = {
      from: vi.fn(() => {
        throw new Error('connection refused');
      }),
    };
    createSupabaseClientMock.mockReturnValue(throwingClient as never);

    const entries = await sitemap();

    expect(entries).toHaveLength(7);
    expect(createSupabaseClientMock).toHaveBeenCalled();
  });
});
