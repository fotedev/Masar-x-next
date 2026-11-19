import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { QuizGridItem } from "../QuizGridItem";
import type { Quiz } from "@/types/database";

const t = (key: string) => key;

const meta = {
  subject: "البرمجة الكائنية",
  department: "AI",
  year: "المستوى الثاني",
  semester: "1",
  descriptionText: "",
};

// Partial row — the card only reads title/status/duration_seconds and the
// count embed, so a full Row fixture would drift on every new column.
type CardQuiz = Quiz & { quiz_questions?: { count: number }[] };

const baseQuiz = {
  id: "11111111-1111-1111-1111-111111111111",
  user_id: "22222222-2222-2222-2222-222222222222",
  title: "البرمجة الكائنية — الشيت 7",
  description: "{}",
  status: "approved",
  duration_seconds: 300,
} as unknown as CardQuiz;

const props = (quiz: CardQuiz) => ({
  quiz,
  meta,
  isAdmin: false,
  t,
  onPlay: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onViewSummary: vi.fn(),
});

describe("QuizGridItem question count", () => {
  it("renders the count from the quiz_questions(count) embed", () => {
    render(
      <QuizGridItem
        {...props({
          ...baseQuiz,
          quiz_questions: [{ count: 7 }],
        })}
      />,
    );
    expect(screen.getByText("البرمجة الكائنية — الشيت 7")).toBeInTheDocument();
    expect(screen.getByText("7 questions")).toBeInTheDocument();
    expect(screen.getByText("5 minutes")).toBeInTheDocument();
  });

  it("falls back to 0 when the embed is missing (cached rows)", () => {
    render(<QuizGridItem {...props(baseQuiz)} />);
    expect(screen.getByText("0 questions")).toBeInTheDocument();
  });

  it("falls back to 0 when the embed array is empty", () => {
    render(
      <QuizGridItem {...props({ ...baseQuiz, quiz_questions: [] })} />,
    );
    expect(screen.getByText("0 questions")).toBeInTheDocument();
  });
});
