// Spec 022 — chain-recording Supabase PostgREST mock (spec 015 task A4,
// re-homed). Every builder call is recorded into `calls` so tests can assert
// the exact tables / filters / payloads a hook or page issued. The builder is
// thenable, mirroring how production code awaits the chain directly:
//   const { data, error } = await supabase.from("subjects").select(...).or(...)

export interface RecordedCall {
  table: string;
  method: string;
  args: unknown[];
}

export interface SupabaseQueryResult<T = unknown> {
  data: T | null;
  error: { message: string; code?: string } | null;
  count?: number | null;
}

import { vi } from "vitest";

export interface RecordedChain {
  calls: RecordedCall[];
  supabase: {
    from: (table: string) => unknown;
    rpc: (fn: string, args?: unknown) => unknown;
    auth: {
      getUser: ReturnType<typeof vi.fn>;
      getSession: ReturnType<typeof vi.fn>;
      onAuthStateChange: ReturnType<typeof vi.fn>;
    };
    channel: ReturnType<typeof vi.fn>;
    removeChannel: ReturnType<typeof vi.fn>;
  };
  /** Set the result the next awaited chain resolves with (per table+method). */
  respondWith: (result: SupabaseQueryResult, match?: { table?: string; method?: string }) => void;
}

/**
 * Build a mock `supabase` client whose every `.from(table).<chain>()` call is
 * recorded. Unknown methods still record and stay chainable (Proxy), so new
 * PostgREST verbs in production code don't silently break mocks.
 */
export function createSupabaseMock(initial: SupabaseQueryResult = { data: [], error: null }): RecordedChain {
  const calls: RecordedCall[] = [];
  const responses: Array<{ result: SupabaseQueryResult; match?: { table?: string; method?: string } }> = [];

  const respondFor = (table: string, method: string): SupabaseQueryResult => {
    for (let i = responses.length - 1; i >= 0; i--) {
      const r = responses[i];
      if (
        (!r.match?.table || r.match.table === table) &&
        (!r.match?.method || r.match.method === method)
      ) {
        return r.result;
      }
    }
    return initial;
  };

  const makeBuilder = (table: string): unknown => {
    const target: Record<string, unknown> = {
      select: (args: unknown[]) => (calls.push({ table, method: 'select', args }), builder),
      then: (
        onFulfilled: (value: SupabaseQueryResult) => unknown,
        onRejected: (reason: unknown) => unknown,
      ) => {
        // The awaited value of a query chain (select-like verbs resolve data).
        const method = [...calls].reverse().find((c) => c.table === table)?.method ?? 'select';
        return Promise.resolve(respondFor(table, method)).then(onFulfilled, onRejected);
      },
    };

    const builder = new Proxy(target, {
      get(t, prop: string) {
        if (prop in t) return t[prop];
        return (...args: unknown[]) => {
          calls.push({ table, method: prop, args });
          return builder;
        };
      },
    }) as unknown;

    return builder;
  };

  const supabase = {
    from: (table: string) => {
      calls.push({ table, method: 'from', args: [] });
      return makeBuilder(table);
    },
    rpc: (fn: string, args?: unknown) => {
      calls.push({ table: `rpc:${fn}`, method: 'rpc', args: [args] });
      return makeBuilder(`rpc:${fn}`);
    },
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { id: 'sub-1', unsubscribe: vi.fn() } },
      })),
    },
    channel: vi.fn(() => ({
      on: function () {
        return this;
      },
      subscribe: vi.fn(function (this: unknown) {
        return this;
      }),
    })),
    removeChannel: vi.fn(),
  };

  return {
    calls,
    supabase: supabase as unknown as RecordedChain['supabase'],
    respondWith: (result, match) => {
      responses.push({ result, match });
    },
  };
}

/** Convenience: every recorded `.or(...)` argument across all tables. */
export function orClauses(chain: RecordedChain): string[] {
  return chain.calls
    .filter((c) => c.method === 'or')
    .flatMap((c) => (c.args as string[]).flat());
}
