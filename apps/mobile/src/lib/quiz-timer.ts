/**
 * Quiz timer math (spec 019 C6/T094/T098) — pure, wall-clock-based
 * helpers for the QuizPlay countdown. Deriving remaining from an
 * absolute endTime makes the timer background-safe by construction:
 * JS intervals may be suspended while the app is backgrounded, but the
 * next tick (or the AppState foreground re-check) recomputes the truth
 * from Date.now() and auto-finishes exactly once.
 */

/**
 * Whole seconds remaining until endTimeMs, clamped at 0.
 * ceil so a half-second left still displays as "1s left".
 */
export function computeRemainingSeconds(endTimeMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((endTimeMs - nowMs) / 1000));
}

/** True once the deadline has passed (boundary inclusive: 0 remaining = expired). */
export function isTimeExpired(endTimeMs: number, nowMs: number): boolean {
  return endTimeMs - nowMs <= 0;
}

/** Split whole seconds into minutes/seconds for the mm-ss display. */
export function splitTime(totalSeconds: number): { minutes: number; seconds: number } {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  return {
    minutes: Math.floor(clamped / 60),
    seconds: clamped % 60,
  };
}

/** Elapsed quiz time in whole seconds (web parity: round((now - start)/1000)). */
export function computeTimeTakenSeconds(startedAtMs: number, nowMs: number): number {
  return Math.max(0, Math.round((nowMs - startedAtMs) / 1000));
}
