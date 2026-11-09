// Spec 040 Wave 3 — useLectureContent unit tests.
// Supabase via the shared chain mock; logger mocked so the warn-not-throw
// inference path is assertable; lecture-inference stays REAL.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const { chain, loggerWarn, loggerError } = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/test/mocks/supabase");
  return {
    chain: createSupabaseMock({ data: [], error: null }),
    loggerWarn: vi.fn(),
    loggerError: vi.fn(),
  };
});

vi.mock("@/lib/supabase", () => ({ supabase: chain.supabase }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: loggerWarn, error: loggerError, info: vi.fn() },
}));

import { useLectureContent } from "../useLectureContent";
import type { SupabaseQueryResult } from "@/test/mocks/supabase";

const LECTURE = { id: "lec-1", lecture_key: "ch-1" };
const INDEX = [
  { id: "lec-1", title: "Chapter 1", lecture_key: "ch-1" },
  { id: "lec-2", title: "Chapter 2", lecture_key: "ch-2" },
];

const base = (over: Record<string, unknown> = {}) => ({
  show: true,
  subject: "math",
  lecture: LECTURE,
  lecturesIndex: INDEX,
  ...over,
});

const mkRow = (id: string) => ({
  id,
  lecture_id: "lec-1",
  lecture_key: null,
  title: "t",
  created_at: "2026-01-01T00:00:00Z",
});

const tables = ["summaries", "videos", "files", "quizzes"] as const;

beforeEach(() => {
  vi.clearAllMocks();
  chain.calls.length = 0;
});

describe("scoped fetching", () => {
  it("issues exactly one scoped query per table (4 parallel fetches)", async () => {
    for (const t of tables) {
      chain.respondWith(
        { data: [mkRow(`${t}-1`)], error: null },
        { table: t, method: "limit" },
      );
    }

    const { result } = renderHook(() => useLectureContent(base()));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const froms = chain.calls.filter((c) => c.method === "from").map((c) => c.table);
    expect(froms).toEqual(["summaries", "videos", "files", "quizzes"]);

    // Scoped shape: subject eq + lecture scoping + recency order + limits.
    for (const t of tables) {
      expect(chain.calls.find((c) => c.table === t && c.method === "eq")!.args).toEqual([
        "subject",
        "math",
      ]);
      expect(chain.calls.find((c) => c.table === t && c.method === "or")!.args).toEqual([
        "lecture_id.eq.lec-1,lecture_key.eq.ch-1",
      ]);
      expect(chain.calls.find((c) => c.table === t && c.method === "order")!.args).toEqual([
        "created_at",
        { ascending: false },
      ]);
    }
    expect(chain.calls.find((c) => c.table === "summaries" && c.method === "limit")!.args).toEqual([400]);
    expect(chain.calls.find((c) => c.table === "quizzes" && c.method === "limit")!.args).toEqual([500]);

    expect(result.current.summaries.map((r) => r.id)).toEqual(["summaries-1"]);
    expect(result.current.videos.map((r) => r.id)).toEqual(["videos-1"]);
    expect(result.current.files.map((r) => r.id)).toEqual(["files-1"]);
    expect(result.current.quizzes.map((r) => r.id)).toEqual(["quizzes-1"]);
  });

  it("falls back to a broad fetch when the scoped query comes back empty", async () => {
    // Gate every await: the scoped phase hangs first, then the broad phase.
    let releaseScoped!: (v: unknown) => void;
    let releaseBroad!: (v: unknown) => void;
    chain.respondWith(
      new Promise((res) => { releaseScoped = res; }) as unknown as SupabaseQueryResult,
    );

    const { result } = renderHook(() => useLectureContent(base()));
    await waitFor(() =>
      expect(chain.calls.filter((c) => c.method === "from")).toHaveLength(4),
    );

    // Pushed AFTER the scoped awaits snapshot their response → only the
    // broad chains (issued once the scoped ones resolve empty) see this.
    chain.respondWith(
      new Promise((res) => { releaseBroad = res; }) as unknown as SupabaseQueryResult,
    );
    releaseScoped({ data: [], error: null });

    await waitFor(() =>
      expect(chain.calls.filter((c) => c.method === "from")).toHaveLength(8),
    );
    releaseBroad({
      data: [{ ...mkRow("b1") }],
      error: null,
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    const froms = chain.calls.filter((c) => c.method === "from").map((c) => c.table);
    expect(froms).toEqual([
      "summaries", "videos", "files", "quizzes",
      "summaries", "videos", "files", "quizzes",
    ]);
    // Exactly one or-clause per table — the broad queries are unscoped.
    expect(chain.calls.filter((c) => c.method === "or")).toHaveLength(4);

    expect(result.current.summaries.map((r) => r.id)).toEqual(["b1"]);
    expect(result.current.videos.map((r) => r.id)).toEqual(["b1"]);
    expect(result.current.files.map((r) => r.id)).toEqual(["b1"]);
    expect(result.current.quizzes.map((r) => r.id)).toEqual(["b1"]);
  });
});

describe("3-tier lectureMatch", () => {
  it("matches by lecture_id, then lecture_key, then title inference", async () => {
    chain.respondWith(
      {
        data: [
          { ...mkRow("r1"), lecture_id: "lec-1", title: "unrelated" }, // tier 1: id
          { ...mkRow("r2"), lecture_id: null, lecture_key: "ch-1" }, // tier 2: key
          { ...mkRow("r3"), lecture_id: null, lecture_key: null, title: "Chapter 1" }, // tier 3: inference
          { ...mkRow("r4"), lecture_id: null, lecture_key: null, title: "Chapter 2" }, // infers ch-2 → excluded
        ],
        error: null,
      },
      { table: "summaries", method: "limit" },
    );

    const { result } = renderHook(() => useLectureContent(base()));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.summaries.map((r) => r.id)).toEqual(["r1", "r2", "r3"]);
    // Rows carry their content type for the consumer.
    expect(result.current.summaries[0].type).toBe("summary");
  });

  it("warns (does not throw) when inference fails, keeping id/key tiers working", async () => {
    chain.respondWith(
      {
        data: [
          mkRow("r1"), // tier 1 — inference never reached
          { ...mkRow("r4"), lecture_id: null, lecture_key: null, title: "Chapter 2" },
        ],
        error: null,
      },
      { table: "summaries", method: "limit" },
    );

    // A malformed index makes inferLectureKeyFromTitle throw for any row
    // that reaches tier 3 — the hook must warn and drop the row, not crash.
    const { result } = renderHook(() =>
      useLectureContent({
        ...base(),
        lecturesIndex: null as unknown as { id: string; title: string; lecture_key: string }[],
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.summaries.map((r) => r.id)).toEqual(["r1"]);
    expect(loggerWarn).toHaveBeenCalledWith(
      "Lecture inference failed for row",
      expect.objectContaining({ rowId: "r4" }),
    );
    expect(loggerError).not.toHaveBeenCalled();
  });
});

describe("error handling", () => {
  it("resets every content list to [] when any fetch fails", async () => {
    chain.respondWith(
      { data: [mkRow("sm1")], error: null },
      { table: "summaries", method: "limit" },
    );
    chain.respondWith(
      { data: null, error: { message: "boom" } },
      { table: "videos", method: "limit" },
    );

    const { result } = renderHook(() => useLectureContent(base()));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.summaries).toEqual([]);
    expect(result.current.videos).toEqual([]);
    expect(result.current.files).toEqual([]);
    expect(result.current.quizzes).toEqual([]);
    expect(loggerError).toHaveBeenCalled();
  });
});

describe("guards", () => {
  it("does not fetch when hidden, subject is empty, or lecture is null", async () => {
    renderHook(() =>
      useLectureContent({ show: false, subject: "math", lecture: LECTURE, lecturesIndex: INDEX }),
    );
    renderHook(() =>
      useLectureContent({ show: true, subject: "", lecture: LECTURE, lecturesIndex: INDEX }),
    );
    renderHook(() =>
      useLectureContent({ show: true, subject: "math", lecture: null, lecturesIndex: INDEX }),
    );

    // Effects already ran (synchronously on mount) — nothing was fetched.
    expect(chain.calls).toEqual([]);
  });
});
