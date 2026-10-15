/**
 * Offline test double for `https://esm.sh/@supabase/supabase-js@2`.
 * Only implements what the hotfixed functions use: createClient with
 * auth.getUser, from('profiles') select/eq/single + update/eq, and rpc.
 * Driven by `globalThis.__SCENARIO__` (see handler tests).
 */

type User = { id: string };

interface Scenario {
  /** token -> user (absent/null token maps to no user) */
  users: Record<string, User | null>;
  /** profiles row returned for the caller, or null (no record) */
  profileRow: { avatar_url: string | null } | null;
  profileError?: boolean;
  rpcAllowed?: boolean;
  calls: {
    updates: Array<{ table: string; values: unknown; eqId: string | null }>;
  };
}

export function __scenario(): Scenario {
  return (globalThis as unknown as Record<string, Scenario>).__SCENARIO__;
}

function chainable(scenario: Scenario, table: string) {
  const state: { values?: unknown; eqId?: string | null } = {};
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
    },
    from: (table: string) => chainable(scenario, table),
    rpc: (_fn: string, _args: unknown) => {
      void _fn;
      void _args;
      return Promise.resolve({ data: scenario.rpcAllowed !== false, error: null });
    },
  };
}
