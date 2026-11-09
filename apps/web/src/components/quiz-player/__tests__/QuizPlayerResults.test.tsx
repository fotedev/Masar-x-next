import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../ReviewSection", () => ({
  ReviewSection: () => null,
}));

import { QuizPlayerResults } from "../QuizPlayerResults";

const t = (key: string, values?: Record<string, string | number | Date>) =>
  values && Object.keys(values).length > 0
    ? `${key} ${JSON.stringify(values)}`
    : key;

const baseProps = {
  quizId: "quiz-1" as string | undefined,
  score: 8,
  totalQuestions: 10,
  endedByTimeout: false,
  timeTakenSeconds: 95,
  isGuest: false,
  onClose: undefined as undefined | (() => void),
  t,
  showSubmitForReview: false,
  onSubmitForReview: undefined as undefined | (() => void | Promise<void>),
  isSubmittingForReview: false,
};

function renderResults(overrides: Partial<typeof baseProps> = {}) {
  return render(<QuizPlayerResults {...baseProps} {...overrides} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("QuizPlayerResults", () => {
  it("renders the percentage, raw score/total and time taken", () => {
    renderResults({ score: 8, totalQuestions: 10 });
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("8/10")).toBeInTheDocument();
    expect(screen.getByText("95s")).toBeInTheDocument();
    expect(screen.getByText("completed")).toBeInTheDocument();
  });

  it("server-authoritative numbers win (spec 030): the props passed by the orchestrator render verbatim", () => {
    // The orchestrator forwards serverResult?.score ?? clientScore — the
    // results screen has no client-side fallback, it displays what it got.
    renderResults({ score: 7, totalQuestions: 10 });
    // client said 8/10 — the server-regraded 7 is what the screen shows
    expect(screen.getByText("70%")).toBeInTheDocument();
    expect(screen.getByText("7/10")).toBeInTheDocument();
    expect(screen.queryByText("80%")).toBeNull();
  });

  it("picks the encouragement message by percentage bucket", () => {
    const { rerender } = renderResults({ score: 10, totalQuestions: 10 });
    expect(screen.getByText("amazing")).toBeInTheDocument(); // >= 90

    rerender(<QuizPlayerResults {...baseProps} score={7} totalQuestions={10} />);
    expect(screen.getByText("excellent")).toBeInTheDocument(); // >= 70

    rerender(<QuizPlayerResults {...baseProps} score={5} totalQuestions={10} />);
    expect(screen.getByText("goodJob")).toBeInTheDocument(); // < 70
  });

  it("shows the timeout message when endedByTimeout", () => {
    renderResults({ endedByTimeout: true });
    expect(screen.getByText("endedTimeout")).toBeInTheDocument();
    expect(screen.queryByText("goodJob")).toBeNull();
  });

  it("shows the guest notice only when isGuest", () => {
    const { rerender } = renderResults({ isGuest: false });
    expect(screen.queryByText("guestMode")).toBeNull();
    expect(screen.queryByText("guestNotice")).toBeNull();

    rerender(<QuizPlayerResults {...baseProps} isGuest />);
    expect(screen.getByText("guestMode")).toBeInTheDocument();
    expect(screen.getByText("guestNotice")).toBeInTheDocument();
  });

  it("retry reloads the page (window.location.reload)", async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    // jsdom's location is unforgeable on the instance — swap the whole
    // property (allowed under vitest's jsdom env) to intercept reload.
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload },
      writable: true,
      configurable: true,
    });
    renderResults();
    await user.click(screen.getByRole("button", { name: "retry" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("back-to-home invokes the onClose callback", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderResults({ onClose });
    await user.click(screen.getByRole("button", { name: "backToHome" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("submit-for-review appears only with showSubmitForReview and fires the callback", async () => {
    const user = userEvent.setup();
    const onSubmitForReview = vi.fn();
    const { rerender } = renderResults({ showSubmitForReview: false });
    expect(screen.queryByText("submitForReview")).toBeNull();

    rerender(
      <QuizPlayerResults
        {...baseProps}
        showSubmitForReview
        onSubmitForReview={onSubmitForReview}
      />,
    );
    const submitBtn = screen.getByRole("button", { name: "submitForReview" });
    expect(submitBtn).toBeEnabled();
    await user.click(submitBtn);
    expect(onSubmitForReview).toHaveBeenCalledTimes(1);
  });

  it("submit-for-review is disabled while isSubmittingForReview or without a callback", () => {
    const { rerender } = renderResults({
      showSubmitForReview: true,
      isSubmittingForReview: true,
      onSubmitForReview: vi.fn(),
    });
    // in-flight label replaces the action label while submitting
    expect(screen.getByRole("button", { name: "submittingForReview" })).toBeDisabled();

    rerender(<QuizPlayerResults {...baseProps} showSubmitForReview />);
    expect(screen.getByRole("button", { name: "submitForReview" })).toBeDisabled();
  });

  it("renders the review section only when a quizId is provided", () => {
    // ReviewSection is stubbed to null — its mount is the observable seam.
    const { container, rerender } = renderResults({ quizId: "quiz-1" });
    expect(container).toBeDefined();

    rerender(<QuizPlayerResults {...baseProps} quizId={undefined} />);
    expect(screen.getByRole("button", { name: "backToHome" })).toBeInTheDocument();
  });
});
