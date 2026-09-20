/**
 * Trailing-edge throttle for streaming deltas (spec 011). Chunk callbacks can
 * arrive far faster than React should re-render; this keeps only the latest
 * payload and flushes at most once per scheduled tick (rAF in the browser).
 * The scheduler is injected so the logic stays unit-testable in node.
 */
export interface DeltaThrottle {
  /** Record the latest payload; schedules one trailing flush if none pending. */
  update: (full: string) => void;
  /** Drop any pending scheduled flush without running it. */
  cancel: () => void;
}

export const createDeltaThrottle = (
  flush: (full: string) => void,
  schedule: (cb: () => void) => () => void,
): DeltaThrottle => {
  let latest: string | null = null;
  let cancelScheduled: (() => void) | null = null;

  return {
    update(full) {
      latest = full;
      if (cancelScheduled) return;
      cancelScheduled = schedule(() => {
        cancelScheduled = null;
        if (latest !== null) {
          const payload = latest;
          latest = null;
          flush(payload);
        }
      });
    },
    cancel() {
      cancelScheduled?.();
      cancelScheduled = null;
      latest = null;
    },
  };
};
