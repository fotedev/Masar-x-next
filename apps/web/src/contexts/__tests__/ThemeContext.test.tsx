import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { ThemeProvider, useTheme } from "../ThemeContext";

function Probe() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button onClick={toggleTheme} data-testid="probe">
      {theme}
    </button>
  );
}

function renderTheme() {
  return render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
}

describe("ThemeProvider", () => {
  it("defaults to light and persists toggles to localStorage + <html> class", () => {
    localStorage.removeItem("theme");
    document.documentElement.className = "";
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;

    renderTheme();
    expect(screen.getByTestId("probe")).toHaveTextContent("light");

    act(() => {
      screen.getByTestId("probe").click();
    });
    expect(screen.getByTestId("probe")).toHaveTextContent("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");

    act(() => {
      screen.getByTestId("probe").click();
    });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(localStorage.getItem("theme")).toBe("light");
    localStorage.removeItem("theme");
  });

  it("restores a saved theme from localStorage", () => {
    localStorage.setItem("theme", "dark");
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
    renderTheme();
    expect(screen.getByTestId("probe")).toHaveTextContent("dark");
    localStorage.removeItem("theme");
  });

  it("honours prefers-color-scheme: dark when nothing is saved", () => {
    localStorage.removeItem("theme");
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
    renderTheme();
    expect(screen.getByTestId("probe")).toHaveTextContent("dark");
    localStorage.removeItem("theme");
  });

  it("useTheme outside a provider throws a helpful error", () => {
    expect(() => render(<Probe />)).toThrow(/useTheme must be used within a ThemeProvider/);
  });
});
