import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { FooterDeveloper } from "../footer/FooterDeveloper";

// Spec 054 — the developer block's GitHub link targets the Masar-X org
// (not the personal fotedev account) as a real anchor, and hosts the star
// badge threaded from the server layout. Stub-t pattern per
// FooterBrand.test.tsx.

const t = (key: string) => `footer.${key}`;
const ORG_HREF = "https://github.com/Masar-X";
const REPO_HREF = "https://github.com/Masar-X/Masar-x";

describe("FooterDeveloper — org link (FR-1)", () => {
  it("renders Follow on GitHub as a real anchor to the Masar-X org", () => {
    render(<FooterDeveloper tFooter={t} locale="en" />);
    const link = screen.getByRole("link", { name: /footer\.followOnGithub/ });
    expect(link).toHaveAttribute("href", ORG_HREF);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});

describe("FooterDeveloper — star badge (FR-2/FR-4)", () => {
  it("renders the badge with the threaded count", () => {
    render(<FooterDeveloper tFooter={t} repoStars={1234} locale="en" />);
    const badge = screen.getByRole("link", { name: /footer\.starOnGithub/ });
    expect(badge).toHaveAttribute("href", REPO_HREF);
    expect(screen.getByText("1.2K")).toBeInTheDocument();
  });

  it("renders the badge without a count when repoStars is missing", () => {
    render(<FooterDeveloper tFooter={t} locale="en" />);
    const badge = screen.getByRole("link", { name: /footer\.starOnGithub/ });
    expect(badge).toHaveAttribute("href", REPO_HREF);
    expect(screen.queryByText("1.2K")).not.toBeInTheDocument();
  });
});
