/**
 * Offline test double for `https://esm.sh/@supabase/supabase-js@2.117.2`.
 * Only implements what the handler tests exercise: createClient with
 * auth.getUser, auth.admin.getUserByEmail, from(...) select/eq/single,
 * update/eq, insert (awaitable directly or via .select().single()), and rpc.
 * Driven by `globalThis.__SCENARIO__` (see the handler tests).
 */

type User = { id: string };

interface Scenario {
  /** token -> user (absent/null token maps to no user) */
  users: Record<string, User | null>;
  /** profiles row returned for the caller, or null (no record) */
  profileRow: { avatar_url: string | null } | null;
  profileError?: boolean;
  rpcAllowed?: boolean;
  /** rpc outcome override keyed by the args' `p_endpoint` (falls back to rpcAllowed) */
  rpcEndpointAllowed?: Record<string, boolean>;
  /** when true rpc REJECTS (exercises each handler's fail-open catch path) */
  rpcError?: boolean;
  /** email -> user for auth.admin.getUserByEmail (absent/null -> not found) */
  usersByEmail?: Record<string, User | null>;
  /** when true getUserByEmail returns an error object instead of data */
  getUserByEmailError?: boolean;
  /** row returned by insert().select().single() (default: { id: "stub-summary-id" }) */
  summaryRow?: { id: string };
  /** when true insert().select().single() / direct insert resolve to an error */
  insertError?: boolean;
  /** rows returned by from('admins').select('user_id') (default: []) */
  admins?: Array<{ user_id: string }>;
  calls: {
    updates: Array<{ table: string; values: unknown; eqId: string | null }>;
    inserts: Array<{ table: string; values: unknown }>;
  };
}

export function __scenario(): Scenario {
  return (globalThis as unknown as Record<string, Scenario>).__SCENARIO__;
}

function resolveRpcAllowed(scenario: Scenario, args: unknown): boolean {
  const endpoint = (args as { p_endpoint?: string } | null)?.p_endpoint;
  if (scenario.rpcEndpointAllowed && endpoint && endpoint in scenario.rpcEndpointAllowed) {
    return scenario.rpcEndpointAllowed[endpoint];
  }
  return scenario.rpcAllowed !== false;
}

function chainable(scenario: Scenario, table: string) {
  const state: { values?: unknown; eqId?: string | null } = {};
  const recordInsert = () => {
    scenario.calls.inserts.push({ table, values: state.values });
  };
  return {
    select(_cols: string) {
      return {
        eq(_col: string, id: string) {
          state.eqId = id;
          return {
            single: () => {
              if (scenario.profileError || scenario.profileRow === null) {
                return Promise.resolve({ data: null, error: { message: "row missing" } });
              }
              return Promise.resolve({ data: scenario.profileRow, error: null });
            },
          };
        },
        // Awaitable directly (admins lookup: .select('user_id') without .eq()).
        then<T>(
          onFulfilled?: (v: { data: Array<{ user_id: string }>; error: null }) => T,
          onRejected?: (e: unknown) => unknown,
        ) {
          return Promise.resolve({ data: scenario.admins ?? [], error: null })
            .then(onFulfilled, onRejected);
        },
      };
    },
    insert(values: unknown) {
      state.values = values;
      return {
        select() {
          return {
            single: () => {
              recordInsert();
              if (scenario.insertError) {
                return Promise.resolve({ data: null, error: { message: "insert failed" } });
              }
              return Promise.resolve({
                data: scenario.summaryRow ?? { id: "stub-summary-id" },
                error: null,
              });
            },
          };
        },
        // Awaitable directly (notifications bulk insert without .select()).
        then<T>(
          onFulfilled?: (v: { data: null; error: { message: string } | null }) => T,
          onRejected?: (e: unknown) => unknown,
        ) {
          recordInsert();
          const res = scenario.insertError
            ? { data: null, error: { message: "insert failed" } }
            : { data: null, error: null };
          return Promise.resolve(res).then(onFulfilled, onRejected);
        },
      };
    },
    update(values: unknown) {
      state.values = values;
      return {
        eq: (_col: string, id: string) => {
          scenario.calls.updates.push({ table, values: state.values, eqId: id });
          return Promise.resolve({ error: null });
        },
      };
    },
  };
}

export function createClient(_url: string, _key: string, _opts?: unknown) {
  const scenario = __scenario();
  void _url;
  void _key;
  void _opts;
  return {
    auth: {
      getUser: (token: string) => {
        const user = scenario.users[token] ?? null;
        return Promise.resolve({ data: { user } });
      },
      admin: {
        getUserByEmail: (email: string) => {
          if (scenario.getUserByEmailError) {
            return Promise.resolve({ data: null, error: { message: "lookup failed" } });
          }
          const user = scenario.usersByEmail?.[email] ?? null;
          return Promise.resolve({ data: { user }, error: null });
        },
      },
    },
    from: (table: string) => chainable(scenario, table),
    rpc: (_fn: string, _args: unknown) => {
      if (scenario.rpcError) {
        return Promise.reject(new Error("rpc down"));
      }
      return Promise.resolve({ data: resolveRpcAllowed(scenario, _args), error: null });
    },
  };
}
