import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock is hoisted above top-level const declarations, so the shared mock
// instance must itself be created inside vi.hoisted (async allowed in vitest 2).
const { chain } = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/test/mocks/supabase");
  return { chain: createSupabaseMock() };
});

vi.mock("@/lib/supabase", () => ({ supabase: chain.supabase }));

import { QuizService, quizService } from "../quiz";

const QUIZ_DATA = {
  title: "Cardio Quiz",
  description: "Chapter 3",
  questions: [
    { question: "Q1?", options: ["a", "b"], correctAnswer: 0, explanation: "e" },
    { question: "Q2?", options: ["x", "y"], correctAnswer: 1 },
  ],
};

beforeEach(() => {
  chain.calls.length = 0;
});

describe("QuizService.submitQuickQuizForReview", () => {
  it("inserts a pending quick-quiz submission plus ordered questions", async () => {
    chain.respondWith({ data: { id: "quiz-1" }, error: null });
    const id = await new QuizService().submitQuickQuizForReview("u1", QUIZ_DATA);
    expect(id).toBe("quiz-1");

    const quizInsert = chain.calls.find((c) => c.table === "quizzes" && c.method === "insert");
    expect(quizInsert).toBeDefined();
    const payload = quizInsert!.args[0] as Record<string, unknown>;
    expect(payload.user_id).toBe("u1");
    expect(payload.source_type).toBe("quick_quiz_submission");
    expect(payload.status).toBe("pending");

    const qInsert = chain.calls.find((c) => c.table === "quiz_questions" && c.method === "insert");
    const rows = qInsert!.args[0] as Array<Record<string, unknown>>;
    expect(rows.map((r) => r.order_index)).toEqual([0, 1]);
    expect(rows[0].quiz_id).toBe("quiz-1");
    expect(rows[1].correct_answer).toBe(1);
    expect(rows[1].image_url).toBeUndefined();
  });

  it("propagates a PostgREST error from the quiz insert", async () => {
    chain.respondWith({ data: null, error: { message: "RLS violation" } });
    await expect(
      new QuizService().submitQuickQuizForReview("u1", QUIZ_DATA),
    ).rejects.toThrow(/RLS/);
  });
});

describe("QuizService.saveAiGeneratedDraft", () => {
  it("upserts a draft with ai_generated source and ZANE AI subject", async () => {
    chain.respondWith({ data: { id: "d-1" }, error: null });
    const id = await new QuizService().saveAiGeneratedDraft("u1", QUIZ_DATA);
    expect(id).toBe("d-1");

    const upsert = chain.calls.find((c) => c.table === "quizzes" && c.method === "upsert");
    const payload = upsert!.args[0] as Record<string, unknown>;
    expect(payload.status).toBe("draft");
    expect(payload.source_type).toBe("ai_generated_draft");
    expect(payload.subject).toBe("ZANE AI");
    expect(payload.level).toBe(0);
    // Draft payload is JSON-encoded into description, questions into content.
    expect(JSON.parse(payload.description as string)).toMatchObject({
      is_draft: true,
      draft_type: "ai_generated",
    });
  });
});

describe("QuizService.syncLocalQuizzes", () => {
  it("returns zero for empty input or missing userId", async () => {
    expect(await quizService.syncLocalQuizzes("", [{} as never])).toEqual({
      success: true,
      count: 0,
    });
    expect(await quizService.syncLocalQuizzes("u1", [])).toEqual({
      success: true,
      count: 0,
    });
  });

  it("regenerates ids for local_ prefixed ids and counts successes", async () => {
    chain.respondWith({ data: { id: "synced" }, error: null });
    const res = await quizService.syncLocalQuizzes("u1", [
      { data: { ...QUIZ_DATA }, localId: "local_abc" },
      { data: { ...QUIZ_DATA }, localId: undefined },
    ]);
    expect(res).toEqual({ success: true, count: 2 });
    const upserts = chain.calls.filter((c) => c.method === "upsert");
    const ids = upserts.map((c) => (c.args[0] as Record<string, unknown>).id);
    expect(String(ids[0])).not.toContain("local_");
  });
});

describe("QuizService.getAiGeneratedDraftsForUser", () => {
  it("filters by user + draft + ai_generated source, newest first", async () => {
    chain.respondWith({ data: [{ id: "draft-1" }], error: null });
    const rows = await new QuizService().getAiGeneratedDraftsForUser("u1", 5);
    expect(rows).toEqual([{ id: "draft-1" }]);

    const eqs = chain.calls.filter((c) => c.table === "quizzes" && c.method === "eq");
    expect(eqs.map((c) => c.args)).toEqual([
      ["user_id", "u1"],
      ["status", "draft"],
      ["source_type", "ai_generated_draft"],
    ]);
    const order = chain.calls.find((c) => c.method === "order");
    expect(order!.args).toEqual(["created_at", { ascending: false }]);
    expect(chain.calls.find((c) => c.method === "limit")!.args).toEqual([5]);
  });
});

describe("QuizService.getQuiz", () => {
  it("fetches the quiz row then its ordered questions", async () => {
    chain.respondWith({ data: { id: "quiz-9", title: "T" }, error: null }, { table: "quizzes" });
    chain.respondWith({ data: [{ question: "Q?" }], error: null }, { table: "quiz_questions" });

    const { quiz, questions } = await new QuizService().getQuiz("quiz-9");
    expect(quiz.id).toBe("quiz-9");
    expect(questions).toEqual([{ question: "Q?" }]);
    expect(chain.calls.filter((c) => c.method === "eq").map((c) => c.args)).toEqual([
      ["id", "quiz-9"],
      ["quiz_id", "quiz-9"],
    ]);
  });
});

describe("QuizService.attempt lifecycle", () => {
  it("resumes an unfinished attempt with its answers", async () => {
    chain.respondWith({ data: { id: "att-1" }, error: null }, { table: "quiz_attempts" });
    chain.respondWith({ data: [{ attempt_id: "att-1" }], error: null }, { table: "quiz_answers" });

    const { attempt, answers } = await new QuizService().startAttempt("quiz-1", "u1");
    expect(attempt).toEqual({ id: "att-1" });
    expect(answers).toEqual([{ attempt_id: "att-1" }]);
    // Resume check filters on finished_at IS NULL.
    const isCall = chain.calls.find((c) => c.table === "quiz_attempts" && c.method === "is");
    expect(isCall!.args).toEqual(["finished_at", null]);
  });

  it("creates a new attempt when none is unfinished", async () => {
    // Method-scoped responses: the resume probe (maybeSingle) sees no
    // unfinished attempt; the insert chain (single) returns the new row.
    chain.respondWith({ data: null, error: null }, { table: "quiz_attempts", method: "maybeSingle" });
    chain.respondWith({ data: { id: "att-new", score: 0 }, error: null }, { table: "quiz_attempts", method: "single" });
    const { attempt, answers } = await new QuizService().startAttempt("quiz-1", "u1");
    expect(attempt.id).toBe("att-new");
    expect(answers).toEqual([]);
    const insert = chain.calls.find((c) => c.table === "quiz_attempts" && c.method === "insert");
    const payload = insert!.args[0] as Record<string, unknown>;
    expect(payload.score).toBe(0);
    expect(payload.user_id).toBe("u1");
    expect(typeof payload.started_at).toBe("string");
  });

  it("upserts answers with the attempt_id+question_id conflict key", async () => {
    chain.respondWith({ data: null, error: null });
    await new QuizService().saveAnswer("att-1", "q-1", 2, true);
    const upsert = chain.calls.find((c) => c.table === "quiz_answers" && c.method === "upsert");
    expect(upsert!.args[1]).toEqual({ onConflict: "attempt_id, question_id" });
    expect((upsert!.args[0] as Record<string, unknown>).is_correct).toBe(true);
  });

  it("finishAttempt writes score/total/finished_at", async () => {
    chain.respondWith({ data: null, error: null });
    await new QuizService().finishAttempt("att-1", 8, 10, []);
    const update = chain.calls.find((c) => c.table === "quiz_attempts" && c.method === "update");
    const payload = update!.args[0] as Record<string, unknown>;
    expect(payload.score).toBe(8);
    expect(payload.total_questions).toBe(10);
    expect(typeof payload.finished_at).toBe("string");
    expect(update!.args[1]).toBeUndefined(); // the .eq follows separately
    const eq = chain.calls.find((c) => c.method === "eq");
    expect(eq!.args).toEqual(["id", "att-1"]);
  });

  it("submitAttempt (legacy) inserts a completed attempt payload", async () => {
    chain.respondWith({ data: null, error: null });
    await new QuizService().submitAttempt("quiz-1", "u1", 4, 5, [], "2025-01-01T00:00:00Z", undefined, 120);
    const insert = chain.calls.find((c) => c.table === "quiz_attempts" && c.method === "insert");
    const payload = insert!.args[0] as Record<string, unknown>;
    expect(payload.status).toBe("completed");
    expect(payload.time_taken_seconds).toBe(120);
    expect(payload.finished_at).toBeNull();
  });
});
