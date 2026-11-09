import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { masarxDesktopApi } from '../desktop-bridge';

// Spec 040 — the runtime fallback values (the `?? Promise.*` branches when
// `globalThis.ipcRenderer` is absent) and the forwarded-args shape were
// unpinned; the preload script ships this literal to Electron's
// contextBridge, so a fallback regression silently changes renderer behavior.

type IpcStub = { invoke: ReturnType<typeof vi.fn> };

describe('masarxDesktopApi without ipcRenderer (browser/plain node)', () => {
  it('app.version() rejects with "not in preload"', async () => {
    await expect(masarxDesktopApi.app.version()).rejects.toThrow(
      'not in preload',
    );
  });

  it('app.openExternal() resolves (no-op fallback)', async () => {
    await expect(masarxDesktopApi.app.openExternal('https://x')).resolves.toBeUndefined();
  });

  it('auth.rendererReady() resolves null (no pending exchange)', async () => {
    await expect(masarxDesktopApi.auth.rendererReady()).resolves.toBeNull();
  });

  it('auth.onDeepLink() returns a callable unsubscribe', () => {
    const unsubscribe = masarxDesktopApi.auth.onDeepLink(() => {});
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });

  it('updates.installAndRestart()/skip() resolve', async () => {
    await expect(masarxDesktopApi.updates.installAndRestart()).resolves.toBeUndefined();
    await expect(masarxDesktopApi.updates.skip('1.2.3')).resolves.toBeUndefined();
  });

  it('window namespace falls back: toggleMaximize/isMaximized resolve false, void actions resolve', async () => {
    await expect(masarxDesktopApi.window.toggleMaximize()).resolves.toBe(false);
    await expect(masarxDesktopApi.window.isMaximized()).resolves.toBe(false);
    await expect(masarxDesktopApi.window.minimize()).resolves.toBeUndefined();
    await expect(masarxDesktopApi.window.close()).resolves.toBeUndefined();
  });
});

describe('masarxDesktopApi with an ipcRenderer stub (preload context)', () => {
  let ipc: IpcStub;

  beforeEach(() => {
    ipc = { invoke: vi.fn(async (channel: string) => `ok:${channel}`) };
    vi.stubGlobal('ipcRenderer', ipc);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('app.version() forwards to the app:version channel', async () => {
    await expect(masarxDesktopApi.app.version()).resolves.toBe('ok:app:version');
    expect(ipc.invoke).toHaveBeenCalledWith('app:version');
  });

  it('app.openExternal(url) forwards the URL argument', async () => {
    await masarxDesktopApi.app.openExternal('https://masarx.vercel.app');
    expect(ipc.invoke).toHaveBeenCalledWith(
      'app:openExternal',
      'https://masarx.vercel.app',
    );
  });

  it('updates.skip(version) forwards the version argument', async () => {
    await masarxDesktopApi.updates.skip('9.9.9');
    expect(ipc.invoke).toHaveBeenCalledWith('updates:skip', '9.9.9');
  });

  it('window.isMaximized() forwards to its channel and returns the boolean', async () => {
    ipc.invoke.mockResolvedValueOnce(true);
    await expect(masarxDesktopApi.window.isMaximized()).resolves.toBe(true);
    expect(ipc.invoke).toHaveBeenCalledWith('window:isMaximized');
  });
});
