// Spec 040 Wave 3 — useUserAcademic unit tests.
// supabase + AuthContext are mocked; the academic-utils cache module and
// queryCache run FOR REAL (their sessionStorage/localStorage contracts are
// part of what's under test). Fake timers drive the retry backoff and the
// profile-update rate limiter.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const { chain, authState } = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/test/mocks/supabase");
  return {
    chain: createSupabaseMock({ data: null, error: null }),
    authState: { user: { id: "u-1" } as { id: string } | null, loading: false },
  };
});

vi.mock("@/lib/supabase", () => ({ supabase: chain.supabase }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => authState }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { useUserAcademic } from "../useUserAcademic";
import {
  academicCache,
  ACADEMIC_FETCH_KEY,
  FETCH_COOLDOWN,
  RATE_LIMIT_KEY,
  USER_ACADEMIC_CACHE_KEY,
} from "@/lib/academic-utils";
import { queryCache } from "@/lib/queryCache";

const OPTIONS_CACHE_KEY = "masarx_academic_options_cache";

function seedOptionsCache() {
  localStorage.setItem(
    OPTIONS_CACHE_KEY,
    JSON.stringify({
      levels: [{ id: "l1", name: "Level 1", level_number: 1 }],
      departments: [],
      lastFetched: Date.now(),
    }),
  );
}

const profilesCalls = () =>
  chain.calls.filter((c) => c.table === "profiles" && c.method === "maybeSingle");

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  queryCache.invalidatePrefix("");
  chain.calls.length = 0;
  authState.user = { id: "u-1" };
  authState.loading = false;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("cache-first init + FETCH_COOLDOWN gate", () => {
  it("cached + fresh → academic served from cache with no profiles fetch", async () => {
    academicCache.setUserAcademic("u-1", { level: 2, semester: 1, department_id: null });
    sessionStorage.setItem(ACADEMIC_FETCH_KEY, Date.now().toString());
    seedOptionsCache();

    const { result } = renderHook(() => useUserAcademic());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.academic.level).toBe(2);
    expect(result.current.loading).toBe(false);
    expect(profilesCalls()).toEqual([]);
    expect(result.current.levels).toEqual([{ id: "l1", name: "Level 1", level_number: 1 }]);
  });

  it("cached + stale (> 1h since last fetch) → refetches and refreshes the gate", async () => {
    academicCache.setUserAcademic("u-1", { level: 2, semester: 1, department_id: null });
    sessionStorage.setItem(
      ACADEMIC_FETCH_KEY,
      (Date.now() - FETCH_COOLDOWN - 1000).toString(),
    );
    seedOptionsCache();
    chain.respondWith(
      { data: { level: 3, semester: 2, department_id: "d9" }, error: null },
      { table: "profiles", method: "maybeSingle" },
    );

    const { result } = renderHook(() => useUserAcademic());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(profilesCalls()).toHaveLength(1);
    expect(result.current.academic).toEqual({ level: 3, semester: 2, department_id: "d9" });
    expect(Number(sessionStorage.getItem(ACADEMIC_FETCH_KEY))).toBe(Date.now());
  });

  it("no cache → loading then fetched academic", async () => {
    seedOptionsCache();
    chain.respondWith(
      { data: { level: 1, semester: 1, department_id: null }, error: null },
      { table: "profiles", method: "maybeSingle" },
    );

    const { result } = renderHook(() => useUserAcademic());
    expect(result.current.loading).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(profilesCalls()).toHaveLength(1);
    expect(result.current.loading).toBe(false);
    expect(result.current.academic.level).toBe(1);
  });

  it("guests reset to DEFAULT_ACADEMIC without querying", async () => {
    authState.user = null;
    const { result } = renderHook(() => useUserAcademic());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.academic).toEqual({ level: null, semester: null, department_id: null });
    expect(profilesCalls()).toEqual([]);
  });
});

describe("executeWithRetry (profile fetch)", () => {
  it("retries transient 504 errors with 1s/2s backoff, max 3 attempts, then fetchFailed", async () => {
    chain.respondWith(
      { data: null, error: { message: "upstream boom", code: "504" } },
      { table: "profiles", method: "maybeSingle" },
    );

    const { result } = renderHook(() => useUserAcademic());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(profilesCalls()).toHaveLength(1);

    // Backoff 1 = 1000ms.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });
    expect(profilesCalls()).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(profilesCalls()).toHaveLength(2);

    // Backoff 2 = 2000ms.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1999);
    });
    expect(profilesCalls()).toHaveLength(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(profilesCalls()).toHaveLength(3);

    // Max retries reached — no 4th attempt, error surfaced as fetchFailed.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(profilesCalls()).toHaveLength(3);
    expect(result.current.fetchFailed).toBe(true);
    expect(result.current.loading).toBe(false);
    // Academic stays UNKNOWN (null), not empty — consumers must not read
    // this as "new student".
    expect(result.current.academic).toEqual({ level: null, semester: null, department_id: null });
  });

  it("does NOT retry non-transient errors (single attempt, fetchFailed)", async () => {
    chain.respondWith(
      { data: null, error: { message: "rls denied" } },
      { table: "profiles", method: "maybeSingle" },
    );

    const { result } = renderHook(() => useUserAcademic());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(profilesCalls()).toHaveLength(1);
    expect(result.current.fetchFailed).toBe(true);
  });

  it("recovers when a transient error is followed by success", async () => {
    chain.respondWith(
      { data: null, error: { message: "bad gateway", code: "502" } },
      { table: "profiles", method: "maybeSingle" },
    );

    const { result } = renderHook(() => useUserAcademic());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // attempt 2 fails
    });
    chain.respondWith(
      { data: { level: 1, semester: 1, department_id: null }, error: null },
      { table: "profiles", method: "maybeSingle" },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000); // attempt 3 succeeds
    });

    expect(profilesCalls()).toHaveLength(3);
    expect(result.current.fetchFailed).toBe(false);
    expect(result.current.academic.level).toBe(1);
    // Success refreshes the cooldown gate and the cache.
    expect(Number(sessionStorage.getItem(ACADEMIC_FETCH_KEY))).toBe(Date.now());
    expect(
      JSON.parse(sessionStorage.getItem(USER_ACADEMIC_CACHE_KEY)!).data.level,
    ).toBe(1);
  });
});

describe("fetchOptions", () => {
  it("fetches levels + departments in parallel, active-only, ordered", async () => {
    chain.respondWith(
      { data: [{ id: "l1", name: "Level 1", level_number: 1 }], error: null },
      { table: "academic_levels", method: "order" },
    );
    chain.respondWith(
      { data: [{ id: "d1", name: "Dept 1", academic_level_id: "l1" }], error: null },
      { table: "departments", method: "order" },
    );
    chain.respondWith(
      { data: { level: 1, semester: 1, department_id: null }, error: null },
      { table: "profiles", method: "maybeSingle" },
    );

    const { result } = renderHook(() => useUserAcademic());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.levels).toEqual([{ id: "l1", name: "Level 1", level_number: 1 }]);
    expect(result.current.departments).toEqual([{ id: "d1", name: "Dept 1", academic_level_id: "l1" }]);

    const lvEq = chain.calls.find((c) => c.table === "academic_levels" && c.method === "eq");
    expect(lvEq!.args).toEqual(["is_active", true]);
    const dpEq = chain.calls.find((c) => c.table === "departments" && c.method === "eq");
    expect(dpEq!.args).toEqual(["is_active", true]);
    expect(
      chain.calls.find((c) => c.table === "academic_levels" && c.method === "order")!.args,
    ).toEqual(["sort_order"]);
    expect(
      chain.calls.find((c) => c.table === "departments" && c.method === "order")!.args,
    ).toEqual(["sort_order"]);

    // Both option queries were KICKED OFF together (Promise.all): their
    // from() calls are consecutive builder starts.
    const fromOrder = chain.calls
      .filter((c) => c.method === "from")
      .map((c) => c.table);
    const levelsIdx = fromOrder.indexOf("academic_levels");
    const deptsIdx = fromOrder.indexOf("departments");
    expect(Math.abs(levelsIdx - deptsIdx)).toBe(1);

    // Options cache persisted for next time.
    expect(JSON.parse(localStorage.getItem(OPTIONS_CACHE_KEY)!).levels).toEqual([
      { id: "l1", name: "Level 1", level_number: 1 },
    ]);
  });

  it("serves options from the localStorage cache without querying", async () => {
    seedOptionsCache();
    chain.respondWith(
      { data: { level: 1, semester: 1, department_id: null }, error: null },
      { table: "profiles", method: "maybeSingle" },
    );

    const { result } = renderHook(() => useUserAcademic());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.levels).toEqual([{ id: "l1", name: "Level 1", level_number: 1 }]);
    expect(chain.calls.some((c) => c.table === "academic_levels")).toBe(false);
    expect(chain.calls.some((c) => c.table === "departments")).toBe(false);
  });
});

describe("setUserAcademic", () => {
  it("guests short-circuit with { success: false } and no upsert", async () => {
    authState.user = null;
    const { result } = renderHook(() => useUserAcademic());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    let res!: { success: boolean; message?: string };
    await act(async () => {
      res = await result.current.setUserAcademic({ level: 2, semester: 1, department_id: null });
    });

    expect(res).toEqual({ success: false });
    expect(chain.calls.filter((c) => c.method === "upsert")).toEqual([]);
  });

  it("upserts with onConflict:'id' and semester_manually_set/semester_updated_at on profile updates", async () => {
    seedOptionsCache();
    chain.respondWith(
      { data: { level: 1, semester: 1, department_id: null }, error: null },
      { table: "profiles", method: "maybeSingle" },
    );
    chain.respondWith({ data: null, error: null }, { table: "profiles", method: "upsert" });

    const { result } = renderHook(() => useUserAcademic());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    let res!: { success: boolean };
    await act(async () => {
      res = await result.current.setUserAcademic(
        { level: 2, semester: 3, department_id: "d1" },
        { isProfileUpdate: true },
      );
    });
    expect(res.success).toBe(true);

    const up = chain.calls.find((c) => c.table === "profiles" && c.method === "upsert");
    expect(up).toBeDefined();
    expect(up!.args[1]).toEqual({ onConflict: "id" });
    const payload = up!.args[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      id: "u-1",
      level: 2,
      semester: 3,
      department_id: "d1",
      semester_manually_set: true,
    });
    expect(typeof payload.semester_updated_at).toBe("string");
  });

  it("non-profile updates keep semester_manually_set false and omit semester_updated_at", async () => {
    seedOptionsCache();
    chain.respondWith(
      { data: { level: 1, semester: 1, department_id: null }, error: null },
      { table: "profiles", method: "maybeSingle" },
    );
    chain.respondWith({ data: null, error: null }, { table: "profiles", method: "upsert" });

    const { result } = renderHook(() => useUserAcademic());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      await result.current.setUserAcademic({ level: 2, semester: 3, department_id: "d1" });
    });

    const payload = chain.calls.find((c) => c.table === "profiles" && c.method === "upsert")!
      .args[0] as Record<string, unknown>;
    expect(payload.semester_manually_set).toBe(false);
    expect("semester_updated_at" in payload).toBe(false);
  });

  it("invalidates the subjects queryCache prefix (memory + localStorage mirror)", async () => {
    seedOptionsCache();
    chain.respondWith(
      { data: { level: 1, semester: 1, department_id: null }, error: null },
      { table: "profiles", method: "maybeSingle" },
    );
    chain.respondWith({ data: null, error: null }, { table: "profiles", method: "upsert" });
    queryCache.set("subjects_all", [{ id: "s-1" }], 60_000);

    const { result } = renderHook(() => useUserAcademic());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(queryCache.get("subjects_all")).toEqual([{ id: "s-1" }]);
    await act(async () => {
      await result.current.setUserAcademic({ level: 2, semester: 1, department_id: null });
    });
    expect(queryCache.get("subjects_all")).toBeNull();
    expect(localStorage.getItem("cache_subjects_all")).toBeNull();
  });

  it("rate-limits isProfileUpdate to 5 per window, then blocks for 60s", async () => {
    seedOptionsCache();
    chain.respondWith(
      { data: { level: 1, semester: 1, department_id: null }, error: null },
      { table: "profiles", method: "maybeSingle" },
    );
    chain.respondWith({ data: null, error: null }, { table: "profiles", method: "upsert" });

    const { result } = renderHook(() => useUserAcademic());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    for (let i = 0; i < 5; i++) {
      let res!: { success: boolean };
      await act(async () => {
        res = await result.current.setUserAcademic(
          { level: 2, semester: 1, department_id: null },
          { isProfileUpdate: true },
        );
      });
      expect(res.success).toBe(true);
    }

    const rl = JSON.parse(sessionStorage.getItem(RATE_LIMIT_KEY)!);
    expect(rl.count).toBe(5);
    expect(rl.blockUntil).toBe(Date.now() + 60_000);

    // 6th call inside the window → blocked with an Arabic countdown message.
    let blocked!: { success: boolean; message?: string };
    await act(async () => {
      blocked = await result.current.setUserAcademic(
        { level: 2, semester: 1, department_id: null },
        { isProfileUpdate: true },
      );
    });
    expect(blocked.success).toBe(false);
    expect(blocked.message).toContain("60");

    // The blocked call never reached the DB.
    const upserts = chain.calls.filter((c) => c.table === "profiles" && c.method === "upsert");
    expect(upserts).toHaveLength(5);

    // After the 60s block expires, updates flow again.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    let after!: { success: boolean };
    await act(async () => {
      after = await result.current.setUserAcademic(
        { level: 2, semester: 1, department_id: null },
        { isProfileUpdate: true },
      );
    });
    expect(after.success).toBe(true);
    expect(
      chain.calls.filter((c) => c.table === "profiles" && c.method === "upsert"),
    ).toHaveLength(6);
  });
});

describe("cross-tab re-sync", () => {
  it("storage events for the academic cache key re-read the cache", async () => {
    academicCache.setUserAcademic("u-1", { level: 2, semester: 1, department_id: null });
    sessionStorage.setItem(ACADEMIC_FETCH_KEY, Date.now().toString());
    seedOptionsCache();

    const { result } = renderHook(() => useUserAcademic());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.academic.level).toBe(2);

    // Another tab wrote a newer cache: mirror it via the storage event.
    sessionStorage.setItem(
      USER_ACADEMIC_CACHE_KEY,
      JSON.stringify({
        data: { level: 5, semester: 2, department_id: null },
        timestamp: Date.now(),
      }),
    );
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: USER_ACADEMIC_CACHE_KEY }));
    });
    expect(result.current.academic.level).toBe(5);

    // Unrelated storage keys are ignored.
    sessionStorage.setItem(
      USER_ACADEMIC_CACHE_KEY,
      JSON.stringify({
        data: { level: 9, semester: 2, department_id: null },
        timestamp: Date.now(),
      }),
    );
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: "something_else" }));
    });
    expect(result.current.academic.level).toBe(5);

    // The in-app custom event (academicCache.setUserAcademic) re-syncs too.
    await act(async () => {
      academicCache.setUserAcademic("u-1", { level: 4, semester: 1, department_id: null });
    });
    expect(result.current.academic.level).toBe(4);
  });
});
