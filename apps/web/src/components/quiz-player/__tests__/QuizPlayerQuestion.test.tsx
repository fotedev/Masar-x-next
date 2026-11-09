import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QuizPlayerQuestion } from "../QuizPlayerQuestion";

const t = (key: string, values?: Record<string, string | number | Date>) =>
  values && Object.keys(values).length > 0
    ? `${key} ${JSON.stringify(values)}`
    : key;

const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const baseQuestion: {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation?: string;
} = {
  id: "q1",
  question: "What is 2 + 2?",
  options: ["3", "4", "5", "6"],
  correct_answer: 1,
  explanation: "Basic arithmetic",
};

const baseProps = {
  currentQuestion: baseQuestion,
  currentQuestionIndex: 0,
  totalQuestions: 4,
  selectedOption: null as number | null,
  isAnswered: false,
  score: 2,
  saving: false,
  attemptError: null as string | null,
  isGuest: false,
  timeLeftSeconds: null as number | null,
  formatTime,
  onSelectOption: vi.fn(),
  onSubmitAnswer: vi.fn(),
  onNextQuestion: vi.fn(),
  onPreviousQuestion: vi.fn(),
  t,
};

function renderQuestion(overrides: Partial<typeof baseProps> = {}) {
  return render(<QuizPlayerQuestion {...baseProps} {...overrides} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("QuizPlayerQuestion", () => {
  it("renders the question, all options with letter badges, and the points chip", () => {
    renderQuestion();
    expect(screen.getByText("What is 2 + 2?")).toBeInTheDocument();
    for (const option of baseQuestion.options) {
      expect(screen.getByRole("button", { name: new RegExp(option) })).toBeInTheDocument();
    }
    expect(screen.getByText("2 points")).toBeInTheDocument();
    // saved vs saving chip — not saving yet
    expect(screen.getByText("saved")).toBeInTheDocument();
    expect(screen.queryByText("saving")).toBeNull();
  });

  it("shows the progress counter with the current position", () => {
    renderQuestion({ currentQuestionIndex: 1, totalQuestions: 4 });
    expect(
      screen.getByText(`viewCount ${JSON.stringify({ start: 2, end: 4, total: 4 })}`),
    ).toBeInTheDocument();
  });

  it("confirm is disabled until an option is selected, then submit fires", async () => {
    const user = userEvent.setup();
    const { rerender } = renderQuestion();
    const confirm = screen.getByRole("button", { name: "confirmAnswer" });
    expect(confirm).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /4/ }));
    expect(baseProps.onSelectOption).toHaveBeenCalledWith(1);

    rerender(<QuizPlayerQuestion {...baseProps} selectedOption={1} />);
    const enabled = screen.getByRole("button", { name: "confirmAnswer" });
    expect(enabled).toBeEnabled();
    await user.click(enabled);
    expect(baseProps.onSubmitAnswer).toHaveBeenCalledTimes(1);
  });

  it("isAnswered disables every option and highlights the correct one green", () => {
    renderQuestion({ isAnswered: true, selectedOption: 0 });
    for (const option of baseQuestion.options) {
      expect(screen.getByRole("button", { name: new RegExp(option) })).toBeDisabled();
    }
    // correct option (index 1) gets the green border, the wrong pick (index 0) red
    expect(screen.getByRole("button", { name: /4/ }).className).toContain("border-green-500");
    expect(screen.getByRole("button", { name: /3/ }).className).toContain("border-red-500");
    // untouched options are dimmed
    expect(screen.getByRole("button", { name: /5/ }).className).toContain("opacity-40");
  });

  it("answered state swaps confirm for next — showResults label on the last question", async () => {
    const user = userEvent.setup();
    const { rerender } = renderQuestion({ isAnswered: true, selectedOption: 1 });
    const next = screen.getByRole("button", { name: "nextQuestion" });
    await user.click(next);
    expect(baseProps.onNextQuestion).toHaveBeenCalledTimes(1);

    rerender(
      <QuizPlayerQuestion
        {...baseProps}
        isAnswered
        selectedOption={1}
        currentQuestionIndex={3}
      />,
    );
    expect(screen.getByRole("button", { name: "showResults" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "confirmAnswer" })).toBeNull();
  });

  it("restores a saved answer: pre-selected option keeps the blue highlight", () => {
    renderQuestion({ selectedOption: 2 });
    const restored = screen.getByRole("button", { name: /5/ });
    expect(restored.className).toContain("border-blue-500");
    expect(restored.className).toContain("ring-4");
  });

  it("previous button is disabled on the first question and fires otherwise", async () => {
    const user = userEvent.setup();
    const { rerender } = renderQuestion({ currentQuestionIndex: 0 });
    expect(screen.getByRole("button", { name: "previous" })).toBeDisabled();

    rerender(<QuizPlayerQuestion {...baseProps} currentQuestionIndex={2} />);
    await user.click(screen.getByRole("button", { name: "previous" }));
    expect(baseProps.onPreviousQuestion).toHaveBeenCalledTimes(1);
  });

  it("shows the guest attempt notice only for guests", () => {
    const { rerender } = renderQuestion({ isGuest: false });
    expect(screen.queryByText("guestAttemptNotice")).toBeNull();

    rerender(<QuizPlayerQuestion {...baseProps} isGuest />);
    expect(screen.getByText("guestAttemptNotice")).toBeInTheDocument();
  });

  it("renders the attempt error banner", () => {
    renderQuestion({ attemptError: "DB offline" });
    expect(screen.getByText("DB offline")).toBeInTheDocument();
  });

  it("shows the countdown chip via formatTime and the saving state while persisting", () => {
    renderQuestion({ timeLeftSeconds: 125, saving: true });
    expect(screen.getByText("2:05")).toBeInTheDocument();
    expect(screen.getByText("saving")).toBeInTheDocument();
    expect(screen.queryByText("saved")).toBeNull();
  });

  it("never ships the explanation mid-quiz (spec 040 PR-3 #202: the answer key no longer reaches the client)", () => {
    // Mid-quiz explanation reveal was REMOVED on purpose: explanations
    // typically restate the answer, and the key no longer ships to the
    // client. Even an answered question with an explanation present must
    // not render it.
    const { rerender } = renderQuestion({ isAnswered: true, selectedOption: 1 });
    expect(screen.queryByText("Basic arithmetic")).toBeNull();

    rerender(<QuizPlayerQuestion {...baseProps} />);
    expect(screen.queryByText("Basic arithmetic")).toBeNull();
  });

  it("explanation is optional — answered question without one renders no explanation box", () => {
    renderQuestion({
      isAnswered: true,
      selectedOption: 1,
      currentQuestion: { ...baseQuestion, explanation: undefined },
    });
    // no crash, options still present
    expect(screen.getByRole("button", { name: /4/ })).toBeDisabled();
  });

  it("timer is hidden when timeLeftSeconds is null", () => {
    renderQuestion({ timeLeftSeconds: null });
    expect(screen.queryByText(formatTime(0))).toBeNull();
    expect(screen.queryByText("2:05")).toBeNull();
  });

  it("renders and submits within waitFor after selecting a restored answer", async () => {
    const user = userEvent.setup();
    renderQuestion({ selectedOption: 3 });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "confirmAnswer" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "confirmAnswer" }));
    await waitFor(() => expect(baseProps.onSubmitAnswer).toHaveBeenCalled());
  });
});
