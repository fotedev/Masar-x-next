/**
 * Pure drag math for the chat overlay scrollbar (issue #241). Extracted from
 * ChatScrollbar so the pointer→scrollTop mapping is unit-testable — the
 * shipped delta-based drag could desync from the rendered thumb (stale track
 * measurements) and never reach the transcript end; the position-based
 * mapping here pins the thumb to the pointer absolutely, so dragging to the
 * track bottom always lands on the last pixel of scrollable content.
 */

export const MIN_THUMB_PX = 36;
export const TRACK_INSET_PX = 8; // inset-y-2 on the overlay

/** Rendered thumb height: content-fraction of the track, clamped to a minimum. */
export const thumbHeight = (
  clientHeight: number,
  scrollHeight: number,
  trackHeight: number,
): number => {
  if (scrollHeight <= 0 || trackHeight <= 0) return MIN_THUMB_PX;
  return Math.max(MIN_THUMB_PX, (clientHeight / scrollHeight) * trackHeight);
};

/**
 * Pointer Y → thumb position as a clamped [0, 1] ratio of the draggable
 * track span. The thumb is centered on the pointer: dragging the thumb top
 * to the track top yields 0, dragging its bottom edge past the track bottom
 * yields exactly 1 (the transcript end), and overshoot clamps at the ends.
 */
export const dragRatio = (
  clientY: number,
  trackTop: number,
  thumbH: number,
  trackHeight: number,
): number => {
  const denominator = trackHeight - thumbH;
  if (denominator <= 0) return 0;
  return Math.min(1, Math.max(0, (clientY - trackTop - thumbH / 2) / denominator));
};

/** Thumb ratio → scroller scrollTop. Ratio 1 = the true end of the content. */
export const scrollTopForRatio = (ratio: number, scrollable: number): number =>
  ratio * scrollable;
