import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The component reads user-facing strings via useTranslations (spec 041
// i18n batch) — the namespace-echo mock pins the keys it renders.
vi.mock("next-intl", () => nextIntlMockFactory());
import { nextIntlMockFactory } from "@/test/mocks/next-intl";

import { ReviewForm } from "../ReviewForm";

const USER = { id: "u-1" };

const baseProps = {
  onSubmit: vi.fn<(content: string, rating: number) => Promise<void>>(),
  user: USER as typeof USER | null,
  onCancel: undefined as undefined | (() => void),
};

function renderForm(overrides: Partial<typeof baseProps> = {}) {
  return render(<ReviewForm {...baseProps} {...overrides} />);
}

function starButtons() {
  // the five star buttons lead the form (no accessible names, icon-only);
  // submit/cancel come after them
  const buttons = screen.getAllByRole("button");
  return buttons.slice(0, 5);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ReviewForm", () => {
  it("guest sees the login-required notice instead of the form", () => {
    renderForm({ user: null });
    expect(
      screen.getByText("reviews.loginRequired"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("defaults to a 5-star rating", () => {
    renderForm();
    expect(screen.getByText("5 من 5")).toBeInTheDocument();
  });

  it("submit is disabled while the review is empty", () => {
    renderForm();
    const submit = screen.getByRole("button", { name: /reviews\.submit/ });
    expect(submit).toBeDisabled();
  });

  it("clicking a star updates the rating", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(starButtons()[2]);
    expect(screen.getByText("3 من 5")).toBeInTheDocument();
  });

  it("submit calls onSubmit(trimmed content, rating) then clears the fields", async () => {
    const user = userEvent.setup();
    baseProps.onSubmit.mockResolvedValue(undefined);
    renderForm();

    const textarea = screen.getByPlaceholderText("reviews.placeholder");
    await user.type(textarea, "  ممتاز جدا  ");
    await user.click(starButtons()[3]); // 4 stars
    await user.click(screen.getByRole("button", { name: /reviews\.submit/ }));

    await waitFor(() =>
      expect(baseProps.onSubmit).toHaveBeenCalledWith("ممتاز جدا", 4),
    );
    // fields reset for the next review
    await waitFor(() => expect(textarea).toHaveValue(""));
    expect(screen.getByText("5 من 5")).toBeInTheDocument();
  });

  it("submit stays disabled while the promise is in flight", async () => {
    const user = userEvent.setup();
    let resolveSubmit: () => void = () => {};
    baseProps.onSubmit.mockImplementation(
      () => new Promise<void>((resolve) => (resolveSubmit = resolve)),
    );
    const { container } = renderForm();

    await user.type(screen.getByPlaceholderText("reviews.placeholder"), "waiting");
    await user.click(screen.getByRole("button", { name: /reviews\.submit/ }));
    // while submitting the label swaps to a spinner — query by type=submit
    const submit = container.querySelector('button[type="submit"]');
    expect(submit).toBeDisabled();

    resolveSubmit();
  });

  it("submitting failure keeps the content (error handled by the parent)", async () => {
    const user = userEvent.setup();
    baseProps.onSubmit.mockRejectedValueOnce(new Error("boom"));
    renderForm();

    const textarea = screen.getByPlaceholderText("reviews.placeholder");
    await user.type(textarea, "kept content");
    await user.click(screen.getByRole("button", { name: /reviews\.submit/ }));

    await waitFor(() => expect(textarea).toHaveValue("kept content"));
    expect(baseProps.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("cancel button renders only when onCancel is provided", async () => {
    const user = userEvent.setup();
    const { rerender } = renderForm();
    expect(screen.queryByRole("button", { name: "reviews.cancel" })).toBeNull();

    const onCancel = vi.fn();
    rerender(<ReviewForm {...baseProps} onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: "reviews.cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
