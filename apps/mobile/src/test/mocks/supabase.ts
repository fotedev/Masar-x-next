/**
 * Spec 022 — minimal chain-recording Supabase mock for mobile lib tests.
 * Mobile lib functions take the client as a parameter (DI), so tests build
 * one per case and assert the recorded PostgREST calls.
 */

export interface RecordedCall {
  table: string;
  method: string;
  args: unknown[];
}

export interface QueryResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

export interface RecordedChain {
  calls: RecordedCall[];
  supabase: Record<string, unknown>;
  respondWith: (result: QueryResult, match?: { table?: string; method?: string }) => void;
}

export function createSupabaseMock(initial: QueryResult = { data: [], error: null }): RecordedChain {
  const calls: RecordedCall[] = [];
  const responses: Array<{ result: QueryResult; match?: { table?: string; method?: string } }> = [];

  const respondFor = (table: string): QueryResult => {
    for (let i = responses.length - 1; i >= 0; i--) {
      const r = responses[i];
      if (!r.match?.table || r.match.table === table) return r.result;
    }
    return initial;
  };

  const makeBuilder = (table: string): unknown => {
    const builder = new Proxy({} as Record<string, unknown>, {
      get(_t, prop: string) {
        if (prop === "then") {
          return (
            onFulfilled: (v: QueryResult) => unknown,
            onRejected: (r: unknown) => unknown,
          ) => Promise.resolve(respondFor(table)).then(onFulfilled, onRejected);
        }
        return (...args: unknown[]) => {
          calls.push({ table, method: prop, args });
          return builder;
        };
      },
    });
    return builder;
  };

  return {
    calls,
    supabase: {
      from: (table: string) => {
        calls.push({ table, method: "from", args: [] });
        return makeBuilder(table);
      },
      rpc: (fn: string, args?: unknown) => {
        calls.push({ table: `rpc:${fn}`, method: "rpc", args: [args] });
        return makeBuilder(`rpc:${fn}`);
      },
    },
    respondWith: (result, match) => {
      responses.push({ result, match });
    },
  };
}
