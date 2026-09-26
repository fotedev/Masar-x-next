import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/mocks/supabase";

const store = vi.hoisted(() => new Map<string, string>());

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    getAllKeys: vi.fn(async () => [...store.keys()]),
    multiRemove: vi.fn(async (keys: string[]) => {
      for (const key of keys) store.delete(key);
    }),
  },
}));

import {
  fetchQuizWithQuestions,
  finishAttempt,
  getGuestResult,
  listGuestResults,
  saveAnswer,
  saveGuestResult,
  startAttempt,
} from "../quiz";

beforeEach(() => {
  store.clear();
});

describe("fetchQuizWithQuestions", () => {
  it("maps quiz + ordered question rows to the player shape", async () => {
    const chain = createSupabaseMock();
    chain.respondWith(
      { data: { id: "q1", title: "T", description: "D", duration_seconds: 600 }, error: null },
      { table: "quizzes" },
    );
    chain.respondWith(
      {
        data: [
          { id: "qq1", quiz_id: "q1", question: "Q?", options: ["a", "b"], correct_answer: 1, explanation: "e", image_url: null, order_index: 0 },
        ],
        error: null,
      },
      { table: "quiz_questions" },
    );

    const res = await fetchQuizWithQuestions(chain.supabase as never, "q1");
    expect(res.title).toBe("T");
    expect(res.durationSeconds).toBe(600);
    // Current mapping omits imageUrl entirely (parity gap noted in spec 022 §5).
    expect(res.questions[0]).toEqual({
      id: "qq1",
      question: "Q?",
      options: ["a", "b"],
      correctAnswer: 1,
      explanation: "e",
    });
    expect(chain.calls.find((c) => c.method === "order")!.args).toEqual([
      "order_index",
      { ascending: true },
    ]);
  });

  it("throws quiz_not_found when the row is missing", async () => {
    const chain = createSupabaseMock();
    chain.respondWith({ data: null, error: null }, { table: "quizzes" });
    await expect(fetchQuizWithQuestions(chain.supabase as never, "gone")).rejects.toThrow(
      "quiz_not_found",
    );
  });

  it("treats null options as empty arrays", async () => {
    const chain = createSupabaseMock();
    chain.respondWith(
      { data: { id: "q1", title: "T", description: null, duration_seconds: null }, error: null },
      { table: "quizzes" },
    );
    chain.respondWith(
      { data: [{ id: "qq1", question: "Q?", options: null, correct_answer: 0 }], error: null },
      { table: "quiz_questions" },
    );
    const res = await fetchQuizWithQuestions(chain.supabase as never, "q1");
    expect(res.questions[0].options).toEqual([]);
    expect(res.durationSeconds).toBeNull();
  });
});

describe("attempt lifecycle", () => {
  it("startAttempt resumes an unfinished attempt before inserting", async () => {
    const chain = createSupabaseMock();
    chain.respondWith({ data: { id: "att-1" }, error: null });
    const attempt = await startAttempt(chain.supabase as never, "q1", "u1");
    expect(attempt).toEqual({ id: "att-1" });
    expect(chain.calls.filter((c) => c.method === "insert")).toHaveLength(0);
    const is = chain.calls.find((c) => c.method === "is");
    expect(is!.args).toEqual(["finished_at", null]);
  });

  it("startAttempt creates a new attempt when none is open", async () => {
    const chain = createSupabaseMock({ data: null, error: null });
    await startAttempt(chain.supabase as never, "q1", "u1");
    expect(chain.calls.some((c) => c.method === "insert")).toBe(true);
    const insert = chain.calls.find((c) => c.method === "insert");
    expect((insert!.args[0] as Record<string, unknown>).user_id).toBe("u1");
  });

  it("saveAnswer upserts with the composite conflict key", async () => {
    const chain = createSupabaseMock();
    await saveAnswer(chain.supabase as never, "att-1", "qq-1", 2, true);
    const upsert = chain.calls.find((c) => c.method === "upsert");
    expect(upsert!.args[1]).toEqual({ onConflict: "attempt_id,question_id" });
    expect((upsert!.args[0] as Record<string, unknown>).is_correct).toBe(true);
  });

  it("finishAttempt writes score/status and optional details", async () => {
    const chain = createSupabaseMock();
    await finishAttempt(chain.supabase as never, "att-1", 4, 5, {
      timeTakenSeconds: 120,
      answers: [{ question_id: "qq-1", selected_option: 1, is_correct: true }],
    });
    const update = chain.calls.find((c) => c.method === "update");
    const payload = update!.args[0] as Record<string, unknown>;
    expect(payload.score).toBe(4);
    expect(payload.status).toBe("completed");
    expect(payload.time_taken_seconds).toBe(120);
    expect(payload.answers).toEqual([
      { question_id: "qq-1", selected_option: 1, is_correct: true },
    ]);
  });
});

describe("guest results (on-device only)", () => {
  it("saves and reads a guest result through the cache", async () => {
    await saveGuestResult("q9", {
      quizId: "q9",
      score: 3,
      total: 5,
      finishedAt: new Date().toISOString(),
      title: "T",
      answers: [],
    });
    const res = await getGuestResult("q9");
    expect(res?.score).toBe(3);
    expect(res?.quizId).toBe("q9");
  });

  it("returns null for quizzes with no saved result", async () => {
    expect(await getGuestResult("never-saved")).toBeNull();
  });

  it("listGuestResults enumerates every saved quiz", async () => {
    await saveGuestResult("qA", { quizId: "qA", score: 1, total: 2, finishedAt: "x" });
    await saveGuestResult("qB", { quizId: "qB", score: 2, total: 2, finishedAt: "y" });
    const list = await listGuestResults();
    expect(list.map((e) => e.quizId).sort()).toEqual(["qA", "qB"]);
  });
});
