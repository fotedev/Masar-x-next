// Spec 040 Wave 3 — useQuizPlayerRuntime unit tests.
// Pure-props hook: no react-query, no supabase — nearly mock-free, driven
// entirely by props + vi.useFakeTimers. Lives in .test.tsx (jsdom) because
// the hook binds window listeners (beforeunload) and window.setInterval,
// which do not exist in the node test environment.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useQuizPlayerRuntime } from "../useQuizPlayerRuntime";

type RuntimeProps = Parameters<typeof useQuizPlayerRuntime>[0];

const mkQuestion = (i: number, correct = 1) => ({
  id: `q-${i}`,
  question: `Question ${i}`,
  options: ["A", "B", "C", "D"],
  correct_answer: correct,
});

function baseProps(over: Partial<RuntimeProps> = {}): RuntimeProps {
  return {
    quizId: "quiz-1",
    quiz: { id: "quiz-1", title: "Quiz", duration_seconds: 0 },
    questions: [mkQuestion(0), mkQuestion(1)],
    savedAnswers: {},
    attemptStartTime: Date.now(),
    score: 0,
    saveAnswer: vi.fn(),
    saveFinishAttempt: vi.fn(async () => null),
    trackEvent: vi.fn(),
    onComplete: vi.fn(),
    ...over,
  };
}

function renderRuntime(props: RuntimeProps) {
  return renderHook((p: RuntimeProps) => useQuizPlayerRuntime(p), {
    initialProps: props,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("startQuiz + countdown", () => {
  it("seeds timeLeft from duration_seconds and ticks down every second", () => {
    const props = baseProps({
      quiz: { id: "quiz-1", title: "Quiz", duration_seconds: 10 },
    });
    const { result } = renderRuntime(props);

    expect(result.current.timeLeftSeconds).toBeNull();
    expect(result.current.hasStarted).toBe(false);

    act(() => result.current.startQuiz());

    expect(result.current.hasStarted).toBe(true);
    expect(result.current.timeLeftSeconds).toBe(10);
    expect(props.trackEvent).toHaveBeenCalledWith("quiz_started", {
      quiz_id: "quiz-1",
      title: "Quiz",
    });

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.timeLeftSeconds).toBe(9);

    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.timeLeftSeconds).toBe(7);
  });

  it("auto-finishes at 0 with endedByTimeout and quiz_completed(ended_by_timeout)", async () => {
    const props = baseProps({
      quiz: { id: "quiz-1", title: "Quiz", duration_seconds: 5 },
    });
    const { result } = renderRuntime(props);
    act(() => result.current.startQuiz());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(result.current.timeLeftSeconds).toBe(0);
    expect(result.current.endedByTimeout).toBe(true);
    expect(result.current.showResults).toBe(true);
    expect(props.saveFinishAttempt).toHaveBeenCalledTimes(1);
    expect(props.trackEvent).toHaveBeenCalledWith(
      "quiz_completed",
      expect.objectContaining({ quiz_id: "quiz-1", ended_by_timeout: true }),
    );
    expect(props.onComplete).toHaveBeenCalledWith(0);

    // The interval must be gone: more time changes nothing.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(props.saveFinishAttempt).toHaveBeenCalledTimes(1);
  });

  it("clears the countdown interval on unmount", async () => {
    const props = baseProps({
      quiz: { id: "quiz-1", title: "Quiz", duration_seconds: 10 },
    });
    const { result, unmount } = renderRuntime(props);
    act(() => result.current.startQuiz());

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(props.saveFinishAttempt).not.toHaveBeenCalled();
  });

  it("no duration_seconds → no countdown at all", async () => {
    const props = baseProps({
      quiz: { id: "quiz-1", title: "Quiz" },
    });
    const { result } = renderRuntime(props);
    act(() => result.current.startQuiz());

    expect(result.current.timeLeftSeconds).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(result.current.timeLeftSeconds).toBeNull();
    expect(result.current.showResults).toBe(false);
    expect(props.saveFinishAttempt).not.toHaveBeenCalled();
  });

  it("exposes durationMinutes rounded from duration_seconds", () => {
    const props = baseProps({
      quiz: { id: "quiz-1", title: "Quiz", duration_seconds: 90 },
    });
    const { result } = renderRuntime(props);
    expect(result.current.durationMinutes).toBe(2);
  });
});

describe("finishQuiz", () => {
  it("is re-entrant: a second concurrent call returns early", async () => {
    const props = baseProps();
    const { result } = renderRuntime(props);

    let p1!: Promise<void>;
    let p2!: Promise<void>;
    await act(async () => {
      // Sync portion of the first call (sets finishingRef) runs before any
      // await, so the second synchronous call must short-circuit.
      p1 = result.current.finishQuiz();
      p2 = result.current.finishQuiz();
      await Promise.all([p1, p2]);
    });

    expect(props.saveFinishAttempt).toHaveBeenCalledTimes(1);
    expect(props.trackEvent).toHaveBeenCalledTimes(1);
    expect(props.onComplete).toHaveBeenCalledTimes(1);
  });

  it("computes timeTakenSeconds from attemptStartTime", async () => {
    const start = Date.now();
    const props = baseProps({ attemptStartTime: start });
    const { result } = renderRuntime(props);

    act(() => vi.advanceTimersByTime(4000));
    await act(async () => {
      await result.current.finishQuiz();
    });

    expect(props.saveFinishAttempt).toHaveBeenCalledWith(0, 4);
  });

  it("clamps negative elapsed time to 0", async () => {
    // attemptStartTime in the future (clock skew) must not produce a
    // negative duration.
    const props = baseProps({ attemptStartTime: Date.now() + 5000 });
    const { result } = renderRuntime(props);

    await act(async () => {
      await result.current.finishQuiz();
    });

    expect(props.saveFinishAttempt).toHaveBeenCalledWith(0, 0);
  });

  it("sends the LATEST score after a score change (T038 scoreRef regression)", async () => {
    const props = baseProps({ score: 0 });
    const { result, rerender } = renderRuntime(props);

    // Capture the finishQuiz reference BEFORE the score change: the T038
    // bug was a stale closure reading the old score.
    const finishBeforeScoreChange = result.current.finishQuiz;

    rerender({ ...props, score: 7 });

    await act(async () => {
      await finishBeforeScoreChange();
    });

    expect(props.saveFinishAttempt).toHaveBeenCalledWith(7, expect.any(Number));
    expect(props.trackEvent).toHaveBeenCalledWith(
      "quiz_completed",
      expect.objectContaining({ score: 7 }),
    );
    expect(props.onComplete).toHaveBeenCalledWith(7);
  });

  it("swallows saveFinishAttempt rejection but still fires quiz_completed + onComplete", async () => {
    const props = baseProps({
      saveFinishAttempt: vi.fn(async () => {
        throw new Error("db down");
      }),
    });
    const { result } = renderRuntime(props);

    await act(async () => {
      await expect(result.current.finishQuiz()).resolves.toBeUndefined();
    });

    expect(props.trackEvent).toHaveBeenCalledWith(
      "quiz_completed",
      expect.anything(),
    );
    expect(props.onComplete).toHaveBeenCalledTimes(1);
    expect(result.current.showResults).toBe(true);
  });
});

describe("answering", () => {
  it("handleSubmitAnswer computes is_correct, saves and tracks", () => {
    const props = baseProps(); // correct_answer = 1
    const { result } = renderRuntime(props);

    act(() => result.current.handleOptionSelect(2));
    expect(result.current.selectedOption).toBe(2);

    act(() => result.current.handleSubmitAnswer());

    expect(props.saveAnswer).toHaveBeenCalledWith("q-0", 2, false);
    expect(props.trackEvent).toHaveBeenCalledWith("question_answered", {
      quiz_id: "quiz-1",
      question_index: 0,
      is_correct: false,
    });
    expect(result.current.isAnswered).toBe(true);
  });

  it("marks the correct option as is_correct=true", () => {
    const props = baseProps();
    const { result } = renderRuntime(props);

    act(() => result.current.handleOptionSelect(1));
    act(() => result.current.handleSubmitAnswer());

    expect(props.saveAnswer).toHaveBeenCalledWith("q-0", 1, true);
    expect(props.trackEvent).toHaveBeenCalledWith(
      "question_answered",
      expect.objectContaining({ is_correct: true }),
    );
  });

  it("ignores handleOptionSelect once the question is answered", () => {
    const props = baseProps();
    const { result } = renderRuntime(props);

    act(() => result.current.handleOptionSelect(0));
    act(() => result.current.handleSubmitAnswer());
    act(() => result.current.handleOptionSelect(3));

    expect(result.current.selectedOption).toBe(0);
  });

  it("handleSubmitAnswer with no selection is a no-op", () => {
    const props = baseProps();
    const { result } = renderRuntime(props);

    act(() => result.current.handleSubmitAnswer());

    expect(props.saveAnswer).not.toHaveBeenCalled();
    expect(props.trackEvent).not.toHaveBeenCalled();
  });

  it("hydrates selection/isAnswered from savedAnswers", () => {
    const props = baseProps({
      savedAnswers: { "q-0": { selected_option: 2, is_correct: false } },
    });
    const { result } = renderRuntime(props);

    expect(result.current.selectedOption).toBe(2);
    expect(result.current.isAnswered).toBe(true);
  });
});

describe("navigation", () => {
  it("previous at index 0 stays at 0", () => {
    const props = baseProps();
    const { result } = renderRuntime(props);

    act(() => result.current.handlePreviousQuestion());
    expect(result.current.currentQuestionIndex).toBe(0);
  });

  it("next/prev walk within bounds", () => {
    const props = baseProps();
    const { result } = renderRuntime(props);

    act(() => result.current.handleNextQuestion());
    expect(result.current.currentQuestionIndex).toBe(1);
    expect(result.current.currentQuestion?.id).toBe("q-1");

    act(() => result.current.handlePreviousQuestion());
    expect(result.current.currentQuestionIndex).toBe(0);
  });

  it("next on the last question finishes the quiz", async () => {
    const props = baseProps();
    const { result } = renderRuntime(props);

    act(() => result.current.handleNextQuestion());
    expect(result.current.currentQuestionIndex).toBe(1);

    await act(async () => {
      result.current.handleNextQuestion();
    });

    expect(result.current.showResults).toBe(true);
    expect(props.saveFinishAttempt).toHaveBeenCalledTimes(1);
    expect(props.trackEvent).toHaveBeenCalledWith(
      "quiz_completed",
      expect.objectContaining({ ended_by_timeout: false }),
    );
  });
});

describe("beforeunload guard", () => {
  // dispatchEvent's return value / the event's defaultPrevented (read AFTER
  // dispatch settles) tells us whether any listener called preventDefault —
  // no extra listener needed (one registered mid-test would run BEFORE the
  // hook's re-registered handler and observe a stale flag).
  function dispatchBeforeUnload(): boolean {
    const ev = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(ev);
    return ev.defaultPrevented;
  }

  it("guards only while started && !showResults && questions exist", async () => {
    const props = baseProps();
    const { result } = renderRuntime(props);

    // Before start: no guard.
    expect(dispatchBeforeUnload()).toBe(false);

    // Started, questions present, results not shown: guard active.
    act(() => result.current.startQuiz());
    expect(dispatchBeforeUnload()).toBe(true);

    // After finishing: no guard.
    await act(async () => {
      await result.current.finishQuiz();
    });
    expect(dispatchBeforeUnload()).toBe(false);
  });

  it("does not guard when there are no questions", async () => {
    const props = baseProps({ questions: [] });
    const { result } = renderRuntime(props);

    act(() => result.current.startQuiz());
    expect(dispatchBeforeUnload()).toBe(false);
  });
});

describe("resetRuntime / formatTime", () => {
  it("resetRuntime clears every piece of runtime state and re-arms finishQuiz", async () => {
    const props = baseProps();
    const { result } = renderRuntime(props);

    act(() => result.current.startQuiz());
    act(() => result.current.handleOptionSelect(1));
    act(() => result.current.handleSubmitAnswer());
    await act(async () => {
      result.current.handleNextQuestion();
    });
    expect(result.current.currentQuestionIndex).toBe(1);
    await act(async () => {
      result.current.handleNextQuestion(); // last question → finish
    });
    expect(result.current.showResults).toBe(true);

    act(() => result.current.resetRuntime());

    expect(result.current.currentQuestionIndex).toBe(0);
    expect(result.current.selectedOption).toBeNull();
    expect(result.current.isAnswered).toBe(false);
    expect(result.current.showResults).toBe(false);
    expect(result.current.hasStarted).toBe(false);
    expect(result.current.timeLeftSeconds).toBeNull();
    expect(result.current.timeTakenSeconds).toBeNull();
    expect(result.current.endedByTimeout).toBe(false);

    // finishingRef was reset: finishQuiz may run again.
    await act(async () => {
      await result.current.finishQuiz();
    });
    expect(props.saveFinishAttempt).toHaveBeenCalledTimes(2);
  });

  it("records timeTakenSeconds on finish", async () => {
    const props = baseProps();
    const { result } = renderRuntime(props);
    await act(async () => {
      await result.current.finishQuiz();
    });
    expect(result.current.timeTakenSeconds).toBe(0);
  });

  it("formatTime renders m:ss and clamps negatives", () => {
    const props = baseProps();
    const { result } = renderRuntime(props);

    expect(result.current.formatTime(0)).toBe("0:00");
    expect(result.current.formatTime(5)).toBe("0:05");
    expect(result.current.formatTime(65)).toBe("1:05");
    expect(result.current.formatTime(600)).toBe("10:00");
    expect(result.current.formatTime(-3)).toBe("0:00");
  });
});
