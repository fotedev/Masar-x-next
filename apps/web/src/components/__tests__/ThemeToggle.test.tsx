import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setMockIntlLocale, nextIntlMockFactory } from "@/test/mocks/next-intl";

const themeState = vi.hoisted(() => ({
  theme: "light" as "light" | "dark",
  toggleTheme: undefined as unknown as ReturnType<typeof vi.fn>,
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ theme: themeState.theme, toggleTheme: themeState.toggleTheme }),
}));

vi.mock("next-intl", () => nextIntlMockFactory());

import { ThemeToggle } from "../ThemeToggle";

beforeEach(() => {
  setMockIntlLocale("en");
  themeState.theme = "light";
  themeState.toggleTheme = vi.fn();
});

describe("ThemeToggle", () => {
  it("renders the toggle once mounted (no aria-hidden placeholder left behind)", () => {
    // RTL render flushes effects inside act, so the pre-mount placeholder
    // has already been replaced by the real button by assertion time
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "theme.enableDark" })).toBeInTheDocument();
    expect(document.querySelector("span[aria-hidden='true']")).toBeNull();
  });

  it("appears after mount and toggles from light", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    const button = await screen.findByRole("button", { name: "theme.enableDark" });
    await user.click(button);
    expect(themeState.toggleTheme).toHaveBeenCalledTimes(1);
  });

  it("dark theme flips the label to enableLight", async () => {
    themeState.theme = "dark";
    const { rerender } = render(<ThemeToggle />);

    await screen.findByRole("button", { name: "theme.enableLight" });
    themeState.theme = "light";
    rerender(<ThemeToggle />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "theme.enableDark" })).toBeInTheDocument(),
    );
    expect(themeState.toggleTheme).not.toHaveBeenCalled();
  });
});
