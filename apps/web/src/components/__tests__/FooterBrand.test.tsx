import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { FooterBrand } from "../footer/FooterBrand";

// Spec 052 — FooterBrand is presentational: the footer passes the faculty
// sub-brand strings resolved from NEXT_PUBLIC_FACULTY. Core deployments
// must render exactly the legacy brand title; faculty deployments swap in
// the preset name and add the powered-by line.

const t = (key: string) => `footer.${key}`;

describe("FooterBrand — core branding (no faculty preset)", () => {
  it("renders the Masar X brand title with no powered-by line", () => {
    render(<FooterBrand t={t} />);
    expect(screen.getByText("footer.brandTitle")).toBeInTheDocument();
    expect(screen.getByText("footer.brandDescription")).toBeInTheDocument();
    expect(screen.queryByText(/Powered by/)).not.toBeInTheDocument();
  });
});

describe("FooterBrand — faculty sub-brand (spec 052)", () => {
  it("renders the faculty display name in place of the brand title", () => {
    render(
      <FooterBrand
        t={t}
        facultyName="FCAI ASNU X"
        facultyPoweredBy="Powered by Masar X"
      />,
    );
    expect(screen.getByText("FCAI ASNU X")).toBeInTheDocument();
    expect(screen.queryByText("footer.brandTitle")).not.toBeInTheDocument();
    expect(screen.getByText("footer.brandDescription")).toBeInTheDocument();
    // Spec 054 (FR-5): the powered-by line links to the Masar-X org; the
    // accessible name states the destination (visible text unchanged).
    const poweredByLink = screen.getByRole("link", {
      name: "footer.githubOrgAria",
    });
    expect(poweredByLink).toHaveAttribute("href", "https://github.com/Masar-X");
    expect(poweredByLink).toHaveAttribute("target", "_blank");
    expect(poweredByLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("Powered by Masar X")).toBeInTheDocument();
  });

  it("keeps the core title when the powered-by string is missing (defensive)", () => {
    render(<FooterBrand t={t} facultyName="FCAI ASNU X" facultyPoweredBy={null} />);
    // Name still swaps in — the powered-by line is the only conditional.
    expect(screen.getByText("FCAI ASNU X")).toBeInTheDocument();
    expect(screen.queryByText(/Powered by/)).not.toBeInTheDocument();
  });
});
