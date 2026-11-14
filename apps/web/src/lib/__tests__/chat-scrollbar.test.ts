// Issue #241 — chat scrollbar drag math (position-based mapping).
// The shipped delta-based drag could desync from the rendered thumb and
// never reach the transcript end; these tests lock the pure mapping the
// drag now uses: clamped [0,1], thumb centered on the pointer, ratio 1 =
// the true end of the scrollable content.
import { describe, expect, it } from "vitest";
import {
  MIN_THUMB_PX,
  dragRatio,
  scrollTopForRatio,
  thumbHeight,
} from "../chat-scrollbar";

describe("thumbHeight", () => {
  it("is proportional to the content fraction of the track", () => {
    // clientHeight = 500 of scrollHeight = 2000 → a quarter of the track.
    expect(thumbHeight(500, 2000, 400)).toBeCloseTo(100);
  });

  it("clamps to the minimum thumb size when the content is very tall", () => {
    // (500/50000) of the track = 4px → below the 36px minimum.
    expect(thumbHeight(500, 50000, 400)).toBe(MIN_THUMB_PX);
  });

  it("falls back to the minimum thumb for degenerate metrics", () => {
    expect(thumbHeight(500, 0, 400)).toBe(MIN_THUMB_PX);
    expect(thumbHeight(500, 2000, 0)).toBe(MIN_THUMB_PX);
    expect(thumbHeight(500, -10, 400)).toBe(MIN_THUMB_PX);
  });
});

describe("dragRatio", () => {
  const TRACK_TOP = 100;
  const THUMB_H = 40;
  const TRACK_H = 300; // draggable span = 300 - 40 = 260

  it("centers the thumb at ratio 0 when its middle sits at the track top", () => {
    expect(dragRatio(TRACK_TOP + THUMB_H / 2, TRACK_TOP, THUMB_H, TRACK_H)).toBe(0);
  });

  it("reaches exactly 1 when the thumb bottom meets the track bottom", () => {
    expect(dragRatio(TRACK_TOP + TRACK_H - THUMB_H / 2, TRACK_TOP, THUMB_H, TRACK_H)).toBeCloseTo(1);
  });

  it("clamps overshoot past both track ends", () => {
    expect(dragRatio(TRACK_TOP - 500, TRACK_TOP, THUMB_H, TRACK_H)).toBe(0);
    expect(dragRatio(TRACK_TOP + TRACK_H + 500, TRACK_TOP, THUMB_H, TRACK_H)).toBe(1);
  });

  it("maps the midpoint of the draggable span to 0.5", () => {
    const y = TRACK_TOP + THUMB_H / 2 + (TRACK_H - THUMB_H) / 2;
    expect(dragRatio(y, TRACK_TOP, THUMB_H, TRACK_H)).toBeCloseTo(0.5);
  });

  it("returns 0 when the thumb fills the track (no draggable span)", () => {
    expect(dragRatio(TRACK_TOP + 150, TRACK_TOP, TRACK_H, TRACK_H)).toBe(0);
    expect(dragRatio(TRACK_TOP + 150, TRACK_TOP, TRACK_H + 10, TRACK_H)).toBe(0);
  });
});

describe("scrollTopForRatio", () => {
  it("maps ratio 1 to the true end of the scrollable content", () => {
    expect(scrollTopForRatio(1, 4600)).toBe(4600);
  });

  it("maps proportionally in between", () => {
    expect(scrollTopForRatio(0.5, 4600)).toBe(2300);
    expect(scrollTopForRatio(0, 4600)).toBe(0);
  });
});
