// Spec 040 Wave 3 — useQuizPlayerData unit tests.
// Only quizService.getQuiz is mocked; the hook is otherwise pure. Lives in
// .test.tsx because the renderHook harness needs a DOM container.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const { getQuizMock } = await vi.hoisted(async () => ({
  getQuizMock: vi.fn(),
}));

vi.mock("@/lib/quiz", () => ({ quizService: { getQuiz: getQuizMock } }));

import { useQuizPlayerData } from "../useQuizPlayerData";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useQuizPlayerData", () => {
  it("server-seeded initialQuiz → loading:false at first render, zero fetches", () => {
    const initialQuiz = {
      quiz: { id: "q-1", title: "Seeded Quiz" },
      questions: [
        { id: "s1", question: "Q", options: ["a", "b"], correct_answer: 1 },
      ],
    };
    const trackEvent = vi.fn();
    const { result } = renderHook(() =>
      useQuizPlayerData({ initialQuiz, trackEvent }),
    );

    // First render already carries the server payload (spec 033 Track A).
    expect(result.current.loading).toBe(false);
    expect(result.current.quiz).toEqual(initialQuiz.quiz);
    expect(result.current.questions).toEqual(initialQuiz.questions);
    expect(getQuizMock).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("null initialQuiz (server had nothing) falls through to the client fetch", async () => {
    getQuizMock.mockResolvedValue({
      quiz: { id: "q-2", title: "DB Quiz" },
      questions: [{ id: "d1", question: "Q", options: ["a"], correct_answer: 0 }],
    });
    const trackEvent = vi.fn();
    const { result } = renderHook(() =>
      useQuizPlayerData({ initialQuiz: null, quizId: "q-2", trackEvent }),
    );

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getQuizMock).toHaveBeenCalledWith("q-2");
    expect(result.current.quiz).toEqual({ id: "q-2", title: "DB Quiz" });
  });

  it("quizData local JSON → id 'local' with questions remapped to local-N ids", async () => {
    const quizData = {
      title: "Local Quiz",
      description: "desc",
      questions: [
        { question: "Q1", options: ["a", "b"], correctAnswer: 1, explanation: "e" },
        { question: "Q2", options: ["x"], correctAnswer: 0 },
      ],
    };
    const trackEvent = vi.fn();
    const { result } = renderHook(() =>
      useQuizPlayerData({ quizData, trackEvent }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.quiz).toEqual({
      id: "local",
      title: "Local Quiz",
      description: "desc",
    });
    expect(result.current.questions[0]).toEqual({
      id: "local-0",
      question: "Q1",
      options: ["a", "b"],
      correct_answer: 1,
      explanation: "e",
    });
    expect(result.current.questions[1].id).toBe("local-1");
    expect(getQuizMock).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("quizId without seed → quizService.getQuiz + quiz_loaded event", async () => {
    getQuizMock.mockResolvedValue({
      quiz: { id: "q9", title: "DB Quiz" },
      questions: [{ id: "dq1", question: "Q", options: ["a"], correct_answer: 0 }],
    });
    const trackEvent = vi.fn();
    const { result } = renderHook(() =>
      useQuizPlayerData({ quizId: "q9", trackEvent }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getQuizMock).toHaveBeenCalledWith("q9");
    expect(result.current.quiz).toEqual({ id: "q9", title: "DB Quiz" });
    expect(trackEvent).toHaveBeenCalledWith("quiz_loaded", {
      quiz_id: "q9",
      title: "DB Quiz",
    });
  });

  it("getQuiz rejection is swallowed → loading false, quiz null, no event", async () => {
    getQuizMock.mockRejectedValue(new Error("db down"));
    const trackEvent = vi.fn();
    const { result } = renderHook(() =>
      useQuizPlayerData({ quizId: "q9", trackEvent }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.quiz).toBeNull();
    expect(result.current.questions).toEqual([]);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("no args → inert (no fetch, no event, stays loading)", async () => {
    const trackEvent = vi.fn();
    const { result } = renderHook(() => useQuizPlayerData({ trackEvent }));

    // Give the effect every chance to misbehave.
    await waitFor(() => expect(getQuizMock).not.toHaveBeenCalled());
    expect(trackEvent).not.toHaveBeenCalled();
    expect(result.current.quiz).toBeNull();
    expect(result.current.questions).toEqual([]);
    expect(result.current.loading).toBe(true);
  });
});
