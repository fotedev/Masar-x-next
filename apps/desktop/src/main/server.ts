import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { findFreePort, writePortSidecar } from './port.js';

export interface ServerOptions {
  /** Resolved `app.getPath('userData')` value. */
  userDataPath: string;
  /** True if running unpackaged (e.g. `electron .` in development). */
  isPackaged: boolean;
  /** True if the user explicitly opted into dev mode (e.g. via env override). */
  forceDev: boolean;
}

export interface RunningServer {
  port: number;
  /**
   * Stop the server. Resolves when the child Next.js process has exited
   * (or the dev-mode no-op completes).
   */
  stop(): Promise<void>;
}

/**
 * Start the local Next.js server that the desktop app loads in its
 * BrowserWindow.
 *
 * Two modes:
 *   - Dev:  the server is already running externally (typically
 *           `pnpm --filter web dev` on `MASARX_DESKTOP_PORT`, default 3000).
 *           We return that port without spawning anything.
 *   - Prod: spawn the Next.js standalone server.js as a child process on a
 *           free port. The standalone build is read from
 *           `process.resourcesPath/web/apps/web/server.js` (wired up via
 *           electron-builder `extraResources` — see T019, T020.2). The
 *           server's stdout/stderr are piped through the main process so
 *           the runtime console shows Next.js logs alongside the Electron
 *           logs, and a SIGTERM with SIGKILL fallback cleans up on stop().
 */
export async function startLocalServer(opts: ServerOptions): Promise<RunningServer> {
  const isDev = !opts.isPackaged || opts.forceDev;

  if (isDev) {
    const port = parseInt(process.env.MASARX_DESKTOP_PORT ?? '3000', 10);
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      throw new Error(
        `startLocalServer: invalid MASARX_DESKTOP_PORT=${process.env.MASARX_DESKTOP_PORT}`,
      );
    }
    return {
      port,
      stop: async () => {
        // Dev server is managed externally; nothing to stop here.
      },
    };
  }

  return startProductionServer(opts.userDataPath);
}

async function startProductionServer(userDataPath: string): Promise<RunningServer> {
  const port = await findFreePort();
  await writePortSidecar(userDataPath, port);

  // Resolve the packaged standalone tree. electron-builder copies
  // apps/web/.next/standalone to resources/web/, and we add the
  // .next/static and public siblings under resources/web/apps/web/ so
  // server.js (at resources/web/apps/web/server.js) finds them via
  // its __dirname-relative lookups.
  const webAppDir = path.join(process.resourcesPath || '', 'web', 'apps', 'web');
  const serverPath = path.join(webAppDir, 'server.js');

  // Fail fast with a clear error if the packaged app is missing the
  // standalone server entry. Without this check, a broken package would
  // surface as a generic spawn ENOENT deep inside the Electron logs.
  try {
    await fs.access(serverPath);
  } catch {
    throw new Error(
      `startProductionServer: server.js not found at ${serverPath}. ` +
        `Did electron-builder copy the Next.js standalone output? ` +
        `Check apps/desktop/electron-builder.yml extraResources.`,
    );
  }

  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      // T020.2: in Electron's main process, process.execPath points at the
      // Electron binary (Masar X.exe), not at the system node. Without
      // ELECTRON_RUN_AS_NODE=1, spawn() re-enters the Electron app
      // lifecycle with server.js as the main entry -- opening a new window
      // and (under double-click launch) cascading into a fork bomb. With
      // this env var set, the same binary runs as a plain Node.js
      // interpreter and executes server.js as a script. This is the
      // documented Electron pattern for running JS entry points from
      // inside a packaged app.
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: webAppDir,
    windowsHide: true,
  });

  // Pipe child stdout/stderr through the main process so Electron's
  // terminal / devtools console shows Next.js output, and so we can
  // surface early-failure diagnostics if the server crashes on boot.
  const tag = '[next-server]';
  child.stdout?.on('data', (chunk: Buffer) => {
    process.stdout.write(`${tag} ${chunk}`);
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(`${tag} ${chunk}`);
  });

  // Detect early spawn failures (e.g. wrong Node version, missing
  // bundled dep) before the caller assumes the port is live.
  const earlyError = await new Promise<Error | null>((resolve) => {
    const onError = (err: Error) => {
      cleanup();
      resolve(err);
    };
    const onExit = (code: number | null) => {
      cleanup();
      resolve(new Error(`startProductionServer: server.js exited before becoming ready (code=${code})`));
    };
    const cleanup = () => {
      child.removeListener('error', onError);
      child.removeListener('exit', onExit);
    };
    child.once('error', onError);
    child.once('exit', onExit);
    // Give Next a brief window to bind the port or fail loudly. 500ms is
    // generous: on a healthy machine the listener is up in <50ms; a
    // longer wait would just delay the window paint.
    setTimeout(() => {
      cleanup();
      resolve(null);
    }, 500);
  });
  if (earlyError) throw earlyError;
  if (child.exitCode !== null) {
    throw new Error(
      `startProductionServer: server.js exited immediately (code=${child.exitCode})`,
    );
  }

  return {
    port,
    stop: () => stopChild(child),
  };
}

/**
 * Terminate a child Next.js server gracefully: SIGTERM first, then
 * SIGKILL after a 2s grace period. Resolves when the process has
 * actually exited (not just when the signal was sent).
 */
function stopChild(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null) {
      resolve();
      return;
    }
    let settled = false;
    const onExit = () => {
      if (settled) return;
      settled = true;
      clearTimeout(killer);
      resolve();
    };
    child.once('exit', onExit);

    try {
      child.kill('SIGTERM');
    } catch {
      // Process may already be gone (race after the exitCode check above).
      onExit();
      return;
    }
    // Hard-kill fallback if SIGTERM is ignored or the process is stuck.
    const killer = setTimeout(() => {
      if (settled) return;
      try {
        child.kill('SIGKILL');
      } catch {
        // Already gone.
      }
      // Don't wait for SIGKILL to land — resolve after the grace period
      // so the caller doesn't hang on a wedged child.
      settled = true;
      child.removeListener('exit', onExit);
      resolve();
    }, 2000);
  });
}