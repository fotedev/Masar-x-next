import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QuizPlayerStart } from "../QuizPlayerStart";

const t = (key: string, values?: Record<string, string | number | Date>) =>
  values && Object.keys(values).length > 0
    ? `${key} ${JSON.stringify(values)}`
    : key;

const baseQuiz = { title: "Chapter 1 Quiz", description: "Intro material" };

describe("QuizPlayerStart", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  it("renders the quiz title and plain-text description", () => {
    render(
      <QuizPlayerStart
        quiz={baseQuiz}
        questionsCount={12}
        durationMinutes={15}
        onStart={vi.fn()}
        onClose={vi.fn()}
        t={t}
      />,
    );
    expect(screen.getByText("Chapter 1 Quiz")).toBeInTheDocument();
    expect(screen.getByText("Intro material")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("questionsCountLabel")).toBeInTheDocument();
    expect(screen.getByText("15 minutes")).toBeInTheDocument();
    expect(screen.getByText("timeLabel")).toBeInTheDocument();
  });

  it("unwraps a JSON-encoded description payload", () => {
    render(
      <QuizPlayerStart
        quiz={{
          title: "T",
          description: JSON.stringify({ description: "  nested text  " }),
        }}
        questionsCount={1}
        durationMinutes={null}
        onStart={vi.fn()}
        t={t}
      />,
    );
    expect(screen.getByText("nested text")).toBeInTheDocument();
    // null durationMinutes falls back to the open-time label
    expect(screen.getByText("openTime")).toBeInTheDocument();
  });

  it("renders no description paragraph when the field is blank", () => {
    render(
      <QuizPlayerStart
        quiz={{ title: "T", description: "   " }}
        questionsCount={1}
        durationMinutes={null}
        onStart={vi.fn()}
        t={t}
      />,
    );
    expect(screen.getByText("T")).toBeInTheDocument();
    // count/time tiles still render; open time replaces the minute figure
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("openTime")).toBeInTheDocument();
  });

  it("start button invokes onStart and cancel invokes onClose", async () => {
    const onStart = vi.fn();
    const onClose = vi.fn();
    render(
      <QuizPlayerStart
        quiz={baseQuiz}
        questionsCount={5}
        durationMinutes={10}
        onStart={onStart}
        onClose={onClose}
        t={t}
      />,
    );
    await user.click(screen.getByRole("button", { name: "startNow" }));
    expect(onStart).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
