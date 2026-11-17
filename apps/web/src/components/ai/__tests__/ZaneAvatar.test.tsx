import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { useReducedMotion } from "framer-motion";

// ZaneAvatar only needs useReducedMotion from framer-motion — pin it so the
// reduced-motion branch is exercisable per test.
vi.mock("framer-motion", () => ({ useReducedMotion: vi.fn(() => false) }));

import { ZaneAvatar } from "../ZaneAvatar";

let playSpy: ReturnType<typeof vi.spyOn>;
let pauseSpy: ReturnType<typeof vi.spyOn>;

// jsdom's `paused` is a getter-only stub that never reflects playback —
// swap it for a WeakSet-backed accessor so the play/pause mocks behave
// like a real element (playing ⇒ paused === false).
const playingEls = new WeakSet<HTMLMediaElement>();
let originalPaused: PropertyDescriptor | undefined;

beforeEach(() => {
  originalPaused = Object.getOwnPropertyDescriptor(
    window.HTMLMediaElement.prototype,
    "paused",
  );
  Object.defineProperty(window.HTMLMediaElement.prototype, "paused", {
    get(this: HTMLMediaElement) {
      return !playingEls.has(this);
    },
    configurable: true,
  });
  playSpy = vi
    .spyOn(window.HTMLMediaElement.prototype, "play")
    .mockImplementation(function (this: HTMLMediaElement) {
      playingEls.add(this);
      return Promise.resolve();
    });
  pauseSpy = vi
    .spyOn(window.HTMLMediaElement.prototype, "pause")
    .mockImplementation(function (this: HTMLMediaElement) {
      playingEls.delete(this);
    });
});

afterEach(() => {
  playSpy.mockRestore();
  pauseSpy.mockRestore();
  if (originalPaused) {
    Object.defineProperty(window.HTMLMediaElement.prototype, "paused", originalPaused);
  }
  vi.mocked(useReducedMotion).mockReturnValue(false);
});

function videos(container: HTMLElement) {
  return Array.from(container.querySelectorAll("video"));
}

function bySrc(els: HTMLVideoElement[], fragment: string) {
  return els.find((el) => el.getAttribute("src")?.includes(fragment));
}

describe("ZaneAvatar (spec 048)", () => {
  it("mounts both videos permanently (no src swap on status change)", () => {
    const { container, rerender } = render(<ZaneAvatar status="idle" />);
    let els = videos(container);
    expect(els).toHaveLength(2);
    expect(bySrc(els, "zane-idle-face.mp4")).toBeDefined();
    expect(bySrc(els, "zane-typing-close.mp4")).toBeDefined();

    rerender(<ZaneAvatar status="working" />);
    els = videos(container);
    // same element count and sources — crossfade only, no remount
    expect(els).toHaveLength(2);
    expect(bySrc(els, "zane-idle-face.mp4")).toBeDefined();
  });

  it("idle: only the idle clip is visible and playing; working never plays", () => {
    const { container } = render(<ZaneAvatar status="idle" />);
    const els = videos(container);
    expect(bySrc(els, "zane-idle-face.mp4")?.style.opacity).toBe("1");
    expect(bySrc(els, "zane-typing-close.mp4")?.style.opacity).toBe("0");
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(bySrc(els, "zane-idle-face.mp4")).toBe(playSpy.mock.instances[0]);
  });

  it("working: crossfades opacity and plays only the typing clip", () => {
    const { container, rerender } = render(<ZaneAvatar status="idle" />);
    rerender(<ZaneAvatar status="working" />);
    const els = videos(container);
    expect(bySrc(els, "zane-idle-face.mp4")?.style.opacity).toBe("0");
    expect(bySrc(els, "zane-typing-close.mp4")?.style.opacity).toBe("1");
    const playedSrcs = playSpy.mock.instances.map((el: object) =>
      (el as HTMLVideoElement).getAttribute("src"),
    );
    expect(playedSrcs.at(-1)).toContain("zane-typing-close.mp4");
  });

  it("clips are muted, looping, inline and preload eagerly (autoplay policy safe)", () => {
    const { container } = render(<ZaneAvatar status="idle" />);
    for (const el of videos(container)) {
      expect(el.muted).toBe(true);
      expect(el.loop).toBe(true);
      expect(el.hasAttribute("playsinline")).toBe(true);
      expect(el.getAttribute("preload")).toBe("auto");
      expect(el.getAttribute("src")).toBeTruthy();
      expect(el.getAttribute("poster")).toBeTruthy();
    }
  });

  it("reduced motion never starts playback (poster/first frame stays)", () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    const { container } = render(<ZaneAvatar status="idle" />);
    const els = videos(container);
    expect(playSpy).not.toHaveBeenCalled();
    expect(bySrc(els, "zane-idle-face.mp4")?.style.opacity).toBe("1");
  });

  it("hidden tab pauses everything (visibilitychange)", () => {
    render(<ZaneAvatar status="idle" />);
    expect(playSpy).toHaveBeenCalled();
    playSpy.mockClear();

    // simulate tab going hidden then visible again
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(pauseSpy).toHaveBeenCalled();
    expect(playSpy).not.toHaveBeenCalled();

    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(playSpy).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });
});
