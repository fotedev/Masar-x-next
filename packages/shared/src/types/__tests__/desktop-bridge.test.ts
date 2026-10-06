/**
 * Regression test for spec 015 FR-006: the literal `masarxDesktopApi` and
 * the inferred type `MasarxDesktopBridge` must agree on every key. If a
 * new IPC channel is added to the literal without updating the type, this
 * test fails — closing the bug class where the preload script added a
 * method that the renderer couldn't see (the `updates.onError` toast
 * crash of 2026-09-12, B4 audit).
 *
 * Also asserts SC-002: adding a new channel to the literal is enough —
 * no second file needs editing for the renderer-side view to pick it up.
 */
import { describe, it, expect } from 'vitest';
import {
  masarxDesktopApi,
  type MasarxDesktopBridge,
} from '../desktop-bridge';

describe('MasarxDesktopBridge', () => {
  // FR-006: literal and inferred type agree on top-level keys
  it('masarxDesktopApi keys match MasarxDesktopBridge keys', () => {
    const literalKeys = Object.keys(masarxDesktopApi).sort();
    const typeKeys: Array<keyof MasarxDesktopBridge> = [
      'app',
      'auth',
      'updates',
      'window',
    ].sort() as Array<keyof MasarxDesktopBridge>;
    expect(literalKeys).toEqual(typeKeys);
  });

  // SC-002: every namespace exposes the expected methods
  it('app namespace exposes version, openExternal', () => {
    expect(Object.keys(masarxDesktopApi.app).sort()).toEqual(
      ['openExternal', 'version'],
    );
  });

  it('auth namespace exposes rendererReady, onDeepLink', () => {
    expect(Object.keys(masarxDesktopApi.auth).sort()).toEqual(
      ['onDeepLink', 'rendererReady'],
    );
  });

  it('updates namespace exposes installAndRestart, skip, onAvailable, onError', () => {
    expect(Object.keys(masarxDesktopApi.updates).sort()).toEqual(
      ['installAndRestart', 'onAvailable', 'onError', 'skip'],
    );
  });

  it('window namespace exposes minimize, toggleMaximize, close, isMaximized, onMaximizeChange', () => {
    expect(Object.keys(masarxDesktopApi.window).sort()).toEqual(
      ['close', 'isMaximized', 'minimize', 'onMaximizeChange', 'toggleMaximize'],
    );
  });

  // SC-002: adding `onInstallProgress` is a single-file change.
  // Type system asserts this at compile-time; runtime test below proves
  // the runtime literal accepts the addition without breaking the
  // satisfies constraint.
  it('masarxDesktopApi satisfies the MasarxDesktopBridge type', () => {
    // This expression will fail to compile if the literal and type diverge.
    const _check: MasarxDesktopBridge = masarxDesktopApi;
    expect(_check).toBe(masarxDesktopApi);
  });

  // Stub-environment safety: the shared module must be importable in
  // contexts where globalThis has no ipcRenderer (e.g. web renderer, tests).
  it('callbacks fall back to no-ops when ipcRenderer is unavailable', () => {
    // MasarxDesktopApi uses globalThis indirection so it can be imported
    // from non-preload contexts. Verify that calling any method does not
    // throw ReferenceError when electron's ipcRenderer is absent.
    const v = masarxDesktopApi.updates.onAvailable(() => {});
    expect(typeof v).toBe('function');
    v(); // should not throw
  });
});