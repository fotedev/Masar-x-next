import http from 'node:http';
import path from 'node:path';
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
   * Stop the server. Resolves when the HTTP listener is closed and the
   * Next.js handler has been released.
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
 *   - Prod: spawn the Next.js standalone server on a free port. The
 *           Next.js build artifacts are read from `process.resourcesPath`
 *           which electron-builder wires up via `extraResources` (T019).
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

  // Lazy import `next` so the dev-mode path (which returns the port without
  // touching Next.js) doesn't pull in the production-only dependency
  // graph when running under Vitest.
  const next = (await import('next')).default as (
    options: { dev: boolean; dir?: string },
  ) => {
    prepare(): Promise<void>;
    getRequestHandler(): (req: http.IncomingMessage, res: http.ServerResponse) => void;
  };

  const webDist = path.join(process.resourcesPath || '', '.next');
  const app = next({ dev: false, dir: webDist });
  await app.prepare();
  const handle = app.getRequestHandler();

  const httpServer = http.createServer((req, res) => handle(req, res));
  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, '127.0.0.1', () => resolve());
  });

  return {
    port,
    stop: async () => {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    },
  };
}
