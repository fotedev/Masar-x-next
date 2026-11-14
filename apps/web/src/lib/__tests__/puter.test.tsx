import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Issue #243 — Puter startup-banner suppression timing.
 *
 * The SDK's printDevCTA runs during module evaluation and reads
 * `this.quiet || globalThis.PUTER_QUIET`, so the pre-load global is the
 * only switch that can beat the banner; the instance flag set after the
 * awaited import is always too late. The mock factory below executes
 * exactly when the SDK module is first imported and snapshots the global
 * at that instant — the timing proof itself.
 *
 * vi.resetModules() clears the module registry but NOT the mock registry —
 * the factory result is built once and reused (same pattern as
 * puter-client.test.tsx), so the mocked SDK object lives in hoisted scope
 * and the instance-flag assertion reads it directly.
 */
const probe = vi.hoisted(() => {
  return {
    quietAtSdkImport: null as boolean | null,
    sdk: {
      auth: {
        isSignedIn: () => false,
        signIn: async () => ({}),
        signOut: () => undefined,
        getUser: async () => ({}),
      },
      ai: { chat: async () => ({}) },
    } as { quiet?: boolean; auth: { isSignedIn: () => boolean }; ai: { chat: () => Promise<unknown> } },
  };
});

vi.mock('@heyputer/puter.js', () => {
  probe.quietAtSdkImport =
    (globalThis as unknown as { PUTER_QUIET?: boolean }).PUTER_QUIET === true;
  return { puter: probe.sdk };
});

async function freshModule() {
  vi.resetModules();
  return import('../puter');
}

beforeEach(() => {
  probe.quietAtSdkImport = null;
  delete (globalThis as unknown as { PUTER_QUIET?: boolean }).PUTER_QUIET;
  delete probe.sdk.quiet;
  localStorage.clear();
});

afterEach(() => {
  delete (globalThis as unknown as { PUTER_QUIET?: boolean }).PUTER_QUIET;
});

describe('loadRealPuterClient — issue #243 banner suppression', () => {
  it('sets globalThis.PUTER_QUIET before the SDK module is imported', async () => {
    const { warmupPuterAuth } = await freshModule();
    await warmupPuterAuth();

    expect(probe.quietAtSdkImport).toBe(true);
    expect((globalThis as unknown as { PUTER_QUIET?: boolean }).PUTER_QUIET).toBe(true);
  });

  it('still sets the instance-level quiet flag after load', async () => {
    const { warmupPuterAuth } = await freshModule();
    await warmupPuterAuth();

    expect(probe.sdk.quiet).toBe(true);
  });
});
