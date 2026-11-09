// Spec 040 Wave 3 — useQuizAttempt unit tests.
// The hook's I/O surface is quizService (../lib/quiz) + useAuth; both are
// mocked. sessionStorage (jsdom) carries the T029 merge/progress contract.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const { quizServiceMock, authState } = await vi.hoisted(async () => {
  return {
    quizServiceMock: {
      startAttempt: vi.fn(),
      saveAnswer: vi.fn(),
      finishAttempt: vi.fn(),
    },
    authState: { loading: false },
  };
});

vi.mock("@/lib/quiz", () => ({ quizService: quizServiceMock }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => authState }));
// The hook reads user-facing strings via useTranslations (spec 041 i18n batch).
vi.mock("next-intl", () => nextIntlMockFactory());

import { nextIntlMockFactory } from "@/test/mocks/next-intl";
import { useQuizAttempt } from "../useQuizAttempt";

const QUIZ_ID = "quiz-1";
const USER_ID = "u-1";
const attemptKey = (uid: string) => `quiz_attempt_${QUIZ_ID}_${uid}`;

const ATTEMPT = { id: "att-1", started_at: "2026-01-01T00:00:00Z" };

function defaultStart(answers: unknown[] = []) {
  quizServiceMock.startAttempt.mockResolvedValue({
    attempt: ATTEMPT,
    answers,
  });
}

async function renderLoaded(props?: Partial<Parameters<typeof useQuizAttempt>[0]>) {
  const base: Parameters<typeof useQuizAttempt>[0] = {
    quizId: QUIZ_ID,
    userId: USER_ID,
    totalQuestions: 10,
    quizTitle: "Algebra Quiz",
    ...props,
  };
  const utils = renderHook((p: Parameters<typeof useQuizAttempt>[0]) => useQuizAttempt(p), {
    initialProps: base,
  });
  await waitFor(() => expect(utils.result.current.loading).toBe(false));
  return { ...utils, props: base };
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  authState.loading = false;
  defaultStart();
  quizServiceMock.saveAnswer.mockResolvedValue(undefined);
  quizServiceMock.finishAttempt.mockResolvedValue({ score: 5, totalQuestions: 10 });
});

describe("initialization (resume-or-create)", () => {
  it("resumes the existing attempt and hydrates DB answers", async () => {
    defaultStart([
      {
        question_id: "q1",
        selected_option: 2,
        is_correct: true,
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);
    const { result } = await renderLoaded();

    expect(quizServiceMock.startAttempt).toHaveBeenCalledWith(QUIZ_ID, USER_ID);
    expect(result.current.attemptId).toBe("att-1");
    expect(result.current.startTime).toBe(new Date(ATTEMPT.started_at).getTime());
    expect(result.current.answers["q1"]).toEqual({
      question_id: "q1",
      selected_option: 2,
      is_correct: true,
      updated_at: "2026-01-01T00:00:00Z",
    });
  });

  it("local answer wins when it is NEWER than the DB answer", async () => {
    defaultStart([
      {
        question_id: "q1",
        selected_option: 2,
        is_correct: true,
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);
    sessionStorage.setItem(
      attemptKey(USER_ID),
      JSON.stringify({
        q1: {
          question_id: "q1",
          selected_option: 3,
          is_correct: false,
          updated_at: "2026-01-02T00:00:00Z",
        },
      }),
    );

    const { result } = await renderLoaded();

    expect(result.current.answers["q1"].selected_option).toBe(3);
    // Merged map synced back to the progress key.
    const synced = JSON.parse(sessionStorage.getItem(attemptKey(USER_ID)) || "{}");
    expect(synced["q1"].selected_option).toBe(3);
  });

  it("DB answer wins when the local answer is OLDER", async () => {
    defaultStart([
      {
        question_id: "q1",
        selected_option: 2,
        is_correct: true,
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);
    sessionStorage.setItem(
      attemptKey(USER_ID),
      JSON.stringify({
        q1: {
          question_id: "q1",
          selected_option: 0,
          is_correct: false,
          updated_at: "2025-12-01T00:00:00Z",
        },
      }),
    );

    const { result } = await renderLoaded();

    expect(result.current.answers["q1"].selected_option).toBe(2);
    const synced = JSON.parse(sessionStorage.getItem(attemptKey(USER_ID)) || "{}");
    expect(synced["q1"].selected_option).toBe(2);
  });

  it("local answer fills in when the DB has no answer for that question", async () => {
    defaultStart([]);
    sessionStorage.setItem(
      attemptKey(USER_ID),
      JSON.stringify({
        q7: {
          question_id: "q7",
          selected_option: 1,
          is_correct: true,
          updated_at: "2026-01-02T00:00:00Z",
        },
      }),
    );

    const { result } = await renderLoaded();

    expect(result.current.answers["q7"].selected_option).toBe(1);
    expect(sessionStorage.getItem(attemptKey(USER_ID))).toContain("q7");
  });

  it("startAttempt failure is swallowed and loading settles false", async () => {
    quizServiceMock.startAttempt.mockRejectedValue(new Error("network"));
    const { result } = await renderLoaded();

    expect(result.current.attemptId).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("skips init without a userId and does not call startAttempt", async () => {
    const { result } = await renderLoaded({ userId: undefined });

    expect(quizServiceMock.startAttempt).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("localOnly skips init entirely", async () => {
    const { result } = await renderLoaded({ localOnly: true });

    expect(quizServiceMock.startAttempt).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });
});

describe("saveAnswer", () => {
  it("writes sessionStorage first and still does when the DB save fails", async () => {
    const { result } = await renderLoaded();

    quizServiceMock.saveAnswer.mockRejectedValue({ message: "pg down" });
    await act(async () => {
      await expect(result.current.saveAnswer("q9", 1, false)).rejects.toBeTruthy();
    });

    // Optimistic local write survived the DB failure.
    const stored = JSON.parse(sessionStorage.getItem(attemptKey(USER_ID)) || "{}");
    expect(stored["q9"]).toMatchObject({ selected_option: 1, is_correct: false });

    expect(quizServiceMock.saveAnswer).toHaveBeenCalledWith("att-1", "q9", 1, false);
    // Non-Error rejection → i18n fallback key (spec 041 i18n batch); the
    // namespace-echo mock surfaces the raw key.
    expect(result.current.error).toBe("quizzes.saveAnswerCloudError");
    expect(result.current.saving).toBe(false);
  });

  it("surfaces an Error rejection message verbatim and rethrows", async () => {
    const { result } = await renderLoaded();

    quizServiceMock.saveAnswer.mockRejectedValue(new Error("rls denied"));
    await act(async () => {
      await expect(result.current.saveAnswer("q9", 2, true)).rejects.toThrow(
        "rls denied",
      );
    });

    expect(result.current.error).toBe("rls denied");
  });

  it("toggles the saving flag while the DB call is in flight", async () => {
    const { result } = await renderLoaded();

    let release!: () => void;
    quizServiceMock.saveAnswer.mockImplementation(
      () => new Promise((res) => { release = res as () => void; }),
    );

    let pending!: Promise<void>;
    await act(async () => {
      pending = result.current.saveAnswer("q9", 0, false).catch(() => {});
    });
    expect(result.current.saving).toBe(true);

    release();
    await act(async () => {
      await pending;
    });
    expect(result.current.saving).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("skips the DB call without an attemptId but still writes sessionStorage", async () => {
    quizServiceMock.startAttempt.mockRejectedValue(new Error("no attempt"));
    const { result } = await renderLoaded();

    await act(async () => {
      await result.current.saveAnswer("q1", 1, true);
    });

    expect(quizServiceMock.saveAnswer).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(attemptKey(USER_ID))).toContain("q1");
    // Init failures now surface an error banner (spec 040 PR-2 #201) — the
    // seeded "no attempt" rejection is expected to still be showing here.
    expect(result.current.error).toBe("no attempt");
  });
});

describe("finishAttempt", () => {
  it("builds the history entry, dedupes by attemptId, patches with the SERVER score/total", async () => {
    defaultStart([
      {
        question_id: "q1",
        selected_option: 1,
        is_correct: true,
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);
    sessionStorage.setItem(
      "quiz_history",
      JSON.stringify([
        { id: "att-1", score: 0, total_questions: 0 },
        { id: "other-attempt", score: 9, total_questions: 10 },
      ]),
    );
    sessionStorage.setItem(attemptKey(USER_ID), JSON.stringify({ q1: {} }));

    const { result } = await renderLoaded();

    let returned: { score: number; totalQuestions: number } | null = null;
    await act(async () => {
      returned = await result.current.finishAttempt(3, 45);
    });

    // finish_quiz_attempt RPC via quizService.finishAttempt
    expect(quizServiceMock.finishAttempt).toHaveBeenCalledWith("att-1", 45);

    expect(returned).toEqual({ score: 5, totalQuestions: 10 });

    const history = JSON.parse(sessionStorage.getItem("quiz_history") || "[]");
    // Dedupe: exactly one att-1 entry, patched to the SERVER numbers.
    const attEntries = history.filter((h: { id: string }) => h.id === "att-1");
    expect(attEntries).toHaveLength(1);
    expect(attEntries[0]).toMatchObject({
      id: "att-1",
      quiz_id: QUIZ_ID,
      user_id: USER_ID,
      score: 5,
      total_questions: 10,
      time_taken_seconds: 45,
      status: "completed",
      is_local: false,
      quizzes: { title: "Algebra Quiz" },
    });
    expect(history.some((h: { id: string }) => h.id === "other-attempt")).toBe(true);

    // Progress key cleared for the signed-in user.
    expect(sessionStorage.getItem(attemptKey(USER_ID))).toBeNull();
  });

  it("guest fallback: user_id 'guest', is_local true, no DB finish, removes _guest key", async () => {
    const { result } = await renderLoaded({ userId: undefined, quizTitle: undefined });

    await act(async () => {
      await result.current.saveAnswer("q1", 1, true);
    });
    sessionStorage.setItem(`quiz_attempt_${QUIZ_ID}_guest`, "stale");

    let returned: unknown = "unset";
    await act(async () => {
      returned = await result.current.finishAttempt(2, 10);
    });

    expect(quizServiceMock.finishAttempt).not.toHaveBeenCalled();
    expect(returned).toBeNull();

    const history = JSON.parse(sessionStorage.getItem("quiz_history") || "[]");
    expect(history[0]).toMatchObject({
      user_id: "guest",
      is_local: true,
      score: 2,
      total_questions: 10,
      quizzes: { title: "quizzes.defaultExamTitle" },
    });
    expect(history[0].id).toMatch(/^local_\d+$/);
    expect(sessionStorage.getItem(`quiz_attempt_${QUIZ_ID}_guest`)).toBeNull();
  });

  it("RPC error → setError + rethrow, history entry survives unpatched", async () => {
    const { result } = await renderLoaded();

    quizServiceMock.finishAttempt.mockRejectedValue(new Error("rpc failed"));
    await act(async () => {
      await expect(result.current.finishAttempt(3, 45)).rejects.toThrow("rpc failed");
    });

    expect(result.current.error).toBe("rpc failed");

    const history = JSON.parse(sessionStorage.getItem("quiz_history") || "[]");
    const entry = history.find((h: { id: string }) => h.id === "att-1");
    expect(entry).toBeDefined();
    // Still the LOCAL score — the server patch never happened.
    expect(entry.score).toBe(3);
    expect(entry.total_questions).toBe(10);
  });

  it("falls back to the generic error string for non-Error RPC failures", async () => {
    const { result } = await renderLoaded();

    quizServiceMock.finishAttempt.mockRejectedValue("boom");
    await act(async () => {
      await expect(result.current.finishAttempt(1, 5)).rejects.toBeTruthy();
    });

    expect(result.current.error).toBe("An unknown error occurred");
  });

  it("quizTitle falls back to the i18n default-exam title when not provided", async () => {
    const { result } = await renderLoaded({ quizTitle: undefined });

    await act(async () => {
      await result.current.finishAttempt(0, 1);
    });

    const history = JSON.parse(sessionStorage.getItem("quiz_history") || "[]");
    expect(history[0].quizzes.title).toBe("quizzes.defaultExamTitle");
  });
});

describe("isGuest", () => {
  it("stays false while auth is loading and flips only after authLoading settles", async () => {
    authState.loading = true;
    const utils = renderHook(
      (p: Partial<Parameters<typeof useQuizAttempt>[0]>) =>
        useQuizAttempt({ quizId: QUIZ_ID, userId: undefined, totalQuestions: 10, ...p }),
      { initialProps: {} as Partial<Parameters<typeof useQuizAttempt>[0]> },
    );

    // No userId yet, but auth still loading → not a guest.
    expect(utils.result.current.isGuest).toBe(false);

    authState.loading = false;
    utils.rerender({});
    await waitFor(() => expect(utils.result.current.isGuest).toBe(true));
  });
});
