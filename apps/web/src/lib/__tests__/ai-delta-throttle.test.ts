import { describe, expect, it, vi } from 'vitest';

import { createDeltaThrottle } from '../ai/delta-throttle';

/** Manual scheduler: holds one callback until the test fires it. */
const makeManualSchedule = () => {
  let pending: (() => void) | null = null;
  return {
    schedule: (cb: () => void) => {
      pending = cb;
      return () => {
        pending = null;
      };
    },
    flush: () => {
      const cb = pending;
      pending = null;
      cb?.();
    },
    hasPending: () => pending !== null,
  };
};

describe('createDeltaThrottle (spec 011)', () => {
  it('flushes only the latest payload, once per scheduled tick', () => {
    const manual = makeManualSchedule();
    const flush = vi.fn();
    const throttle = createDeltaThrottle(flush, manual.schedule);

    throttle.update('a');
    throttle.update('ab');
    throttle.update('abc');
    expect(manual.hasPending()).toBe(true);

    manual.flush();
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith('abc');
    expect(manual.hasPending()).toBe(false);
  });

  it('schedules a new tick for updates arriving after a flush', () => {
    const manual = makeManualSchedule();
    const flush = vi.fn();
    const throttle = createDeltaThrottle(flush, manual.schedule);

    throttle.update('first');
    manual.flush();
    throttle.update('second');
    manual.flush();

    expect(flush).toHaveBeenNthCalledWith(1, 'first');
    expect(flush).toHaveBeenNthCalledWith(2, 'second');
  });

  it('cancel drops the pending flush without running it', () => {
    const manual = makeManualSchedule();
    const flush = vi.fn();
    const throttle = createDeltaThrottle(flush, manual.schedule);

    throttle.update('partial');
    throttle.cancel();
    expect(manual.hasPending()).toBe(false);
    manual.flush();
    expect(flush).not.toHaveBeenCalled();
  });

  it('cancel clears buffered state so a later update starts clean', () => {
    const manual = makeManualSchedule();
    const flush = vi.fn();
    const throttle = createDeltaThrottle(flush, manual.schedule);

    throttle.update('stale');
    throttle.cancel();
    throttle.update('fresh');
    manual.flush();

    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith('fresh');
  });
});
