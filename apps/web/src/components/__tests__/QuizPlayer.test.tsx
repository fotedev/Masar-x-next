import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setMockIntlLocale, nextIntlMockFactory } from "@/test/mocks/next-intl";

const states = vi.hoisted(() => {
  const mkQuestion = (id: string, n: number) => ({
    id,
    question: `Question ${n}`,
    options: ["a", "b", "c"],
    correct_answer: 1,
  });
  const questions = Array.from({ length: 10 }, (_, i) => mkQuestion(`q${i + 1}`, i + 1));
  const runtimeDefaults = {
    currentQuestion: questions[0],
    currentQuestionIndex: 0,
    selectedOption: null as number | null,
    isAnswered: false,
    showResults: false,
    hasStarted: false,
    timeLeftSeconds: null as number | null,
    timeTakenSeconds: null as number | null,
    endedByTimeout: false,
    durationMinutes: null as number | null,
    formatTime: (s: number) => `fmt-${s}`,
    startQuiz: () => {},
    handleOptionSelect: () => {},
    handleSubmitAnswer: () => {},
    handleNextQuestion: () => {},
    handlePreviousQuestion: () => {},
  };
  return {
    authState: { user: null as { id: string } | null, loading: false },
    trackEvent: undefined as unknown as ReturnType<typeof vi.fn>,
    dataState: {
      loading: false,
      quiz: null as { title: string; description?: string } | null,
      questions: [] as Array<{ id: string; question: string; options: string[]; correct_answer: number }>,
      loadQuiz: undefined as unknown as ReturnType<typeof vi.fn>,
    },
    attemptState: {
      answers: {} as Record<string, { is_correct: boolean }>,
      saving: false,
      saveAnswer: undefined as unknown as ReturnType<typeof vi.fn>,
      finishAttempt: undefined as unknown as ReturnType<typeof vi.fn>,
      startTime: null as number | null,
      isGuest: false,
      error: null as string | null,
    },
    attemptProps: { current: null as unknown },
    dataProps: { current: null as unknown },
    runtimeProps: { current: null as unknown },
    runtimeDefaults,
    questions,
    runtimeState: { ...runtimeDefaults, currentQuestion: questions[0] } as Record<string, unknown>,
    routerPush: undefined as unknown as ReturnType<typeof vi.fn>,
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => states.authState,
}));

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: () => ({ trackEvent: states.trackEvent }),
}));

vi.mock("@/hooks/useQuizAttempt", () => ({
  useQuizAttempt: (props: unknown) => {
    states.attemptProps.current = props;
    return states.attemptState;
  },
}));

vi.mock("@/hooks/useQuizPlayerData", () => ({
  useQuizPlayerData: (props: unknown) => {
    states.dataProps.current = props;
    return states.dataState;
  },
}));

vi.mock("@/hooks/useQuizPlayerRuntime", () => ({
  useQuizPlayerRuntime: (props: unknown) => {
    states.runtimeProps.current = props;
    return states.runtimeState;
  },
}));

vi.mock("@/navigation", () => ({
  useRouter: () => ({ push: states.routerPush }),
}));

vi.mock("../ReviewSection", () => ({
  ReviewSection: () => null,
}));

// Deferred inline wrapper: vi.mock hoists above imports, so the shared
// factory must only be *called* once "@/test/mocks/next-intl" has evaluated
// (this file imports it before the component under test).
vi.mock("next-intl", () => nextIntlMockFactory());

import { QuizPlayer } from "../QuizPlayer";

function setRuntime(overrides: Partial<typeof states.runtimeDefaults> = {}) {
  states.runtimeState = { ...states.runtimeDefaults, ...overrides };
}

function primeLoadedQuiz() {
  states.dataState.quiz = { title: "Final Exam" };
  states.dataState.questions = states.questions;
}

beforeEach(() => {
  setMockIntlLocale("en");
  states.trackEvent = vi.fn();
  states.dataState.loadQuiz = vi.fn();
  states.attemptState.saveAnswer = vi.fn();
  states.attemptState.finishAttempt = vi.fn(async () => null);
  states.routerPush = vi.fn();
  states.authState.user = null;
  states.authState.loading = false;
  states.dataState.loading = false;
  states.dataState.quiz = null;
  states.dataState.questions = [];
  states.attemptState.answers = {};
  states.attemptState.saving = false;
  states.attemptState.startTime = null;
  states.attemptState.isGuest = false;
  states.attemptState.error = null;
  setRuntime();
});

describe("QuizPlayer orchestration", () => {
  it("shows the preparing spinner while auth or quiz data is loading", () => {
    states.authState.loading = true;
    render(<QuizPlayer quizId="qz" />);
    expect(screen.getByText("quizzes.preparing")).toBeInTheDocument();
    expect(screen.queryByText("quizzes.startNow")).toBeNull();
  });

  it("renders the failure card and retries via loadQuiz", async () => {
    const user = userEvent.setup();
    render(<QuizPlayer quizId="qz" />);
    expect(screen.getByText("quizzes.failed")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "quizzes.retry" }));
    expect(states.dataState.loadQuiz).toHaveBeenCalledTimes(1);
  });

  it("forwards quizId/initialQuiz/quizData/trackEvent into useQuizPlayerData", () => {
    const initialQuiz = { quiz: { title: "x" }, questions: [] };
    const quizData = { title: "local", questions: [] };
    render(<QuizPlayer quizId="qz" initialQuiz={initialQuiz} quizData={quizData} />);
    expect(states.dataProps.current).toMatchObject({
      quizId: "qz",
      initialQuiz,
      quizData,
      trackEvent: states.trackEvent,
    });
  });

  it("passes the auth user id into useQuizAttempt (undefined for local attempts)", () => {
    states.authState.user = { id: "u-1" };
    const { rerender } = render(<QuizPlayer quizId="qz" />);
    expect(states.attemptProps.current).toMatchObject({ userId: "u-1", quizId: "qz" });

    rerender(<QuizPlayer quizId="qz" forceLocalAttempt />);
    expect(states.attemptProps.current).toMatchObject({ userId: undefined });
  });

  it("renders Start before starting and wires the start callback", async () => {
    const user = userEvent.setup();
    primeLoadedQuiz();
    const startQuiz = vi.fn();
    setRuntime({ hasStarted: false, durationMinutes: 8, startQuiz });
    render(<QuizPlayer quizId="qz" />);

    expect(screen.getByText("Final Exam")).toBeInTheDocument();
    expect(screen.getByText(String(states.questions.length))).toBeInTheDocument();
    expect(screen.getByText("8 quizzes.minutes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "quizzes.startNow" }));
    expect(startQuiz).toHaveBeenCalledTimes(1);
  });

  it("renders the question mid-flow and wires option select / submit / navigation", async () => {
    const user = userEvent.setup();
    primeLoadedQuiz();
    const handleOptionSelect = vi.fn();
    const handleSubmitAnswer = vi.fn();
    const handlePreviousQuestion = vi.fn();
    setRuntime({
      hasStarted: true,
      currentQuestion: states.questions[1],
      currentQuestionIndex: 1,
      handleOptionSelect,
      handleSubmitAnswer,
      handlePreviousQuestion,
    });
    const { rerender } = render(<QuizPlayer quizId="qz" />);

    expect(screen.getByText("Question 2")).toBeInTheDocument();
    // option button's accessible name is "<letter badge> <option text>"
    await user.click(screen.getByRole("button", { name: "C c" }));
    expect(handleOptionSelect).toHaveBeenCalledWith(2);

    // the runtime records the selection, re-render, then confirm unlocks
    states.runtimeState.selectedOption = 2;
    rerender(<QuizPlayer quizId="qz" />);
    await user.click(screen.getByRole("button", { name: "quizzes.confirmAnswer" }));
    expect(handleSubmitAnswer).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "quizzes.previous" }));
    expect(handlePreviousQuestion).toHaveBeenCalledTimes(1);
  });

  it("forwards guest flag and attempt error into the question view", () => {
    primeLoadedQuiz();
    setRuntime({ hasStarted: true });
    states.attemptState.isGuest = true;
    states.attemptState.error = "sync failed";
    render(<QuizPlayer quizId="qz" />);
    expect(screen.getByText("quizzes.guestAttemptNotice")).toBeInTheDocument();
    expect(screen.getByText("sync failed")).toBeInTheDocument();
  });

  it("results fall back to the client score when no server payload exists", async () => {
    const user = userEvent.setup();
    primeLoadedQuiz();
    setRuntime({ showResults: true, timeTakenSeconds: 42, endedByTimeout: true });
    // 2 of the first 5 answers marked correct by the client
    states.attemptState.answers = {
      q1: { is_correct: true },
      q2: { is_correct: false },
      q3: { is_correct: true },
      q4: { is_correct: false },
      q5: { is_correct: true },
    };
    const onClose = vi.fn();
    render(<QuizPlayer quizId="qz" onClose={onClose} />);

    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(screen.getByText("3/10")).toBeInTheDocument();
    expect(screen.getByText("42s")).toBeInTheDocument();
    expect(screen.getByText("quizzes.endedTimeout")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "quizzes.backToHome" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("spec 030: results show the server-regraded score over the client computation", async () => {
    const user = userEvent.setup();
    primeLoadedQuiz();
    // client-side tally says 1 correct...
    states.attemptState.answers = { q1: { is_correct: true } };
    // ...but the RPC re-graded the attempt to 7/10
    states.attemptState.finishAttempt = vi.fn(async () => ({ score: 7, totalQuestions: 10 }));

    setRuntime({
      hasStarted: true,
      isAnswered: true,
      currentQuestionIndex: states.questions.length - 1,
      currentQuestion: states.questions[states.questions.length - 1],
      selectedOption: 0,
    });
    // mirror the real runtime: advancing past the last question finishes the attempt
    states.runtimeState.handleNextQuestion = async () => {
      await (states.runtimeProps.current as { saveFinishAttempt: (s: number, t?: number) => Promise<unknown> })
        .saveFinishAttempt(1, 60);
      states.runtimeState.showResults = true;
    };

    render(<QuizPlayer quizId="qz" />);
    await user.click(screen.getByRole("button", { name: "quizzes.showResults" }));

    await waitFor(() => expect(screen.getByText("70%")).toBeInTheDocument());
    expect(screen.getByText("7/10")).toBeInTheDocument();
    expect(screen.queryByText("1/10")).toBeNull();
    expect(states.attemptState.finishAttempt).toHaveBeenCalledWith(1, 60);
  });

  it("defaults the exit path to the quizzes hub when no onClose is passed", async () => {
    const user = userEvent.setup();
    primeLoadedQuiz();
    setRuntime({ showResults: true });
    render(<QuizPlayer />);
    await user.click(screen.getByRole("button", { name: "quizzes.backToHome" }));
    expect(states.routerPush).toHaveBeenCalledWith("/quizzes");
  });
});
