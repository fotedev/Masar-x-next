import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The circuit breaker holds module-level counters, so every test gets a
 * fresh module instance via resetModules + dynamic import.
 */
async function freshModule() {
  vi.resetModules();
  return import('@/lib/ai/circuit-breaker');
}

const transportError = () => new Error('websocket is closed before the connection is established');
const nonTransportError = () => new Error('model gpt-9 does not exist or you do not have access to it');

describe('ai circuit-breaker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('withPuterRetry returns the first success without retrying', async () => {
    const { withPuterRetry } = await freshModule();
    let calls = 0;
    const result = await withPuterRetry(async () => {
      calls++;
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(calls).toBe(1);
  });

  it('withPuterRetry retries transport errors and recovers', async () => {
    const { withPuterRetry } = await freshModule();
    let calls = 0;
    const result = await withPuterRetry(
      async () => {
        calls++;
        if (calls === 1) throw transportError();
        return 'recovered';
      },
      { baseDelayMs: 200 },
    );
    expect(result).toBe('recovered');
    expect(calls).toBe(2);
  });

  it('withPuterRetry never retries model-availability errors', async () => {
    const { withPuterRetry } = await freshModule();
    let calls = 0;
    await expect(
      withPuterRetry(
        async () => {
          calls++;
          throw nonTransportError();
        },
        { baseDelayMs: 200 },
      ),
    ).rejects.toThrow('does not exist');
    expect(calls).toBe(1);
  });

  it('withPuterRetry gives up after maxAttempts', async () => {
    const { withPuterRetry } = await freshModule();
    let calls = 0;
    await expect(
      withPuterRetry(
        async () => {
          calls++;
          throw transportError();
        },
        { maxAttempts: 2, baseDelayMs: 200 },
      ),
    ).rejects.toThrow('websocket is closed');
    expect(calls).toBe(2);
  });

  it('notePuterTransportFailure opens the circuit after two failures in the window', async () => {
    const { notePuterTransportFailure, isPuterCircuitOpen } = await freshModule();
    expect(isPuterCircuitOpen()).toBe(false);
    notePuterTransportFailure(transportError());
    expect(isPuterCircuitOpen()).toBe(false);
    notePuterTransportFailure(transportError());
    expect(isPuterCircuitOpen()).toBe(true);
  });

  it('non-transport failures do not open the circuit', async () => {
    const { notePuterTransportFailure, isPuterCircuitOpen } = await freshModule();
    notePuterTransportFailure(nonTransportError());
    notePuterTransportFailure(nonTransportError());
    expect(isPuterCircuitOpen()).toBe(false);
  });

  it('the circuit closes again after its 45s window', async () => {
    vi.useFakeTimers();
    try {
      const { notePuterTransportFailure, isPuterCircuitOpen } = await freshModule();
      notePuterTransportFailure(transportError());
      notePuterTransportFailure(transportError());
      expect(isPuterCircuitOpen()).toBe(true);
      vi.setSystemTime(Date.now() + 46_000);
      expect(isPuterCircuitOpen()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a successful call resets the failure count', async () => {
    const mod = await freshModule();
    mod.notePuterTransportFailure(transportError());
    await mod.withPuterRetry(async () => 'ok');
    mod.notePuterTransportFailure(transportError());
    expect(mod.isPuterCircuitOpen()).toBe(false);
  });
});
