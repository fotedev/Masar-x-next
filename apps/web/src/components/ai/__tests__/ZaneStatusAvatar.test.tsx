import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { nextIntlMockFactory } from "@/test/mocks/next-intl";

// ZaneAvatar (child) pulls useReducedMotion from framer-motion.
vi.mock("framer-motion", () => ({ useReducedMotion: () => false }));
vi.mock("next-intl", () => nextIntlMockFactory());

import { ZaneStatusAvatar } from "../ZaneStatusAvatar";

// Silence jsdom's "not implemented" media noise (the child avatar
// auto-plays the active clip on mount).
beforeEach(() => {
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(
    () => Promise.resolve(),
  );
  vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(
    () => undefined,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

function videos(container: HTMLElement) {
  return Array.from(container.querySelectorAll("video"));
}

describe("ZaneStatusAvatar (spec 048)", () => {
  it("renders the assistant name with the idle label and green connected state", () => {
    const { container } = render(<ZaneStatusAvatar status="idle" />);
    expect(screen.getByText("aiAssistant.assistantName")).toBeInTheDocument();
    expect(screen.getByText("aiAssistant.statusConnected")).toBeInTheDocument();
    expect(screen.queryByText("aiAssistant.statusWorking")).toBeNull();
    // idle icon: filled Zap
    const icon = container.querySelector("svg.fill-current");
    expect(icon).not.toBeNull();
    // two crossfaded clips; idle visible
    const els = videos(container);
    expect(els).toHaveLength(2);
    expect(
      els.find((el) => el.getAttribute("src")?.includes("zane-idle-face.mp4"))?.style.opacity,
    ).toBe("1");
  });

  it("flips to the working label and wrench icon while loading", () => {
    const { container } = render(<ZaneStatusAvatar status="working" />);
    expect(screen.getByText("aiAssistant.statusWorking")).toBeInTheDocument();
    expect(screen.queryByText("aiAssistant.statusConnected")).toBeNull();
    const els = videos(container);
    expect(
      els.find((el) => el.getAttribute("src")?.includes("zane-typing-close.mp4"))?.style.opacity,
    ).toBe("1");
  });

  it("keeps the floating overlay pointer-events-none so bubbles stay interactive", () => {
    const { container } = render(<ZaneStatusAvatar status="idle" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("pointer-events-none");
    expect(root.className).toContain("max-lg:top-3");
    // Spec 048 narrow-viewport fix: the avatar stacks vertically at ALL
    // sizes (flex-col is unconditional) so the pill overlaps its bottom
    // edge — never side-by-side.
    expect(root.className).toContain("flex-col");
    expect(root.className).not.toContain("lg:flex-col");
  });
});
