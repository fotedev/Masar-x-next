import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { formatStarCount, FooterStarBadge } from "../footer/FooterStarBadge";

// Spec 054 — FooterStarBadge is presentational (t + stars + locale via
// props, same pattern as FooterBrand). The same anchor renders with the
// compact count when the cached GitHub fetch succeeded and without it on
// any failure — never an error state.

const t = (key: string) => `footer.${key}`;
const REPO_HREF = "https://github.com/Masar-X/Masar-x";

describe("formatStarCount — compact per-locale (FR-8)", () => {
  it("formats compact in en", () => {
    expect(formatStarCount(1234, "en")).toBe("1.2K");
    expect(formatStarCount(28, "en")).toBe("28");
  });

  it("applies the Arabic compact unit in ar (ICU may use latn digits)", () => {
    const ar = formatStarCount(1234, "ar");
    // Locale-aware compact: the Arabic thousand word, and NOT the raw
    // number (whether this ICU picks arab or latn digits).
    expect(ar).toContain("ألف");
    expect(ar).not.toBe("1234");
  });
});

describe("FooterStarBadge — fallback (stars unavailable)", () => {
  it("renders the plain star link with no count", () => {
    const { container } = render(
      <FooterStarBadge t={t} stars={null} locale="en" />,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", REPO_HREF);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("footer.starOnGithub")).toBeInTheDocument();
    // Only the label span — no count span (FR-2 graceful fallback).
    expect(container.querySelectorAll("a span")).toHaveLength(1);
  });
});

describe("FooterStarBadge — live count", () => {
  it("renders the compact count between the icon and the label", () => {
    render(<FooterStarBadge t={t} stars={1234} locale="en" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", REPO_HREF);
    expect(screen.getByText("1.2K")).toBeInTheDocument();
    expect(screen.getByText("footer.starOnGithub")).toBeInTheDocument();
    expect(link.querySelectorAll("span")).toHaveLength(2);
  });

  it("renders a real 0 as a count (not the fallback)", () => {
    render(<FooterStarBadge t={t} stars={0} locale="en" />);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("footer.starOnGithub")).toBeInTheDocument();
  });
});
