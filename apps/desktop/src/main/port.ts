import { connect, createServer, type AddressInfo } from 'node:net';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Poll a loopback TCP port until it accepts a connection (spec 041 R13).
 *
 * Replaces the flat "wait 500 ms and hope" gate on the spawned Next server:
 * success now means the port actually listens. Polls every `intervalMs`
 * with a 1s per-attempt connect cap and rejects after `timeoutMs` in total.
 */
export function waitForPort(
  port: number,
  timeoutMs: number,
  intervalMs = 150,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    const attempt = () => {
      const socket = connect(port, '127.0.0.1');
      const settle = (ok: boolean) => {
        socket.removeAllListeners();
        socket.destroy();
        if (ok) {
          resolve();
          return;
        }
        if (Date.now() >= deadline) {
          reject(
            new Error(
              `waitForPort: 127.0.0.1:${port} did not accept connections within ${timeoutMs}ms`,
            ),
          );
          return;
        }
        setTimeout(attempt, intervalMs);
      };
      socket.once('connect', () => settle(true));
      socket.once('error', () => settle(false));
      // A hung connect counts as "not listening yet" and retries.
      socket.setTimeout(1000, () => settle(false));
    };

    attempt();
  });
}

/**
 * Find a free TCP port by asking the OS to assign one.
 *
 * The standard pattern: open a listener on port 0 (OS-assigned), read the
 * assigned port from `server.address()`, then close. The kernel may reuse
 * the port immediately for another process, so this is a "best effort"
 * negotiation. For the desktop app, the gap between close() and the
 * production server's listen() is microseconds — race-prone in theory,
 * safe in practice on a single-user machine.
 *
 * Returns a port in the range [1024, 65535] on success; rejects on error.
 */
export async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr === null || typeof addr === 'string') {
        server.close();
        reject(new Error('findFreePort: could not determine assigned port'));
        return;
      }
      const port = (addr as AddressInfo).port;
      server.close(() => resolve(port));
    });
  });
}

/**
 * Write the chosen port to a JSON sidecar file in the userData directory.
 *
 * The sidecar is read by external tools (smoke tests, the electron-builder
 * packaging scripts) that need to know the port the desktop app bound to
 * without having to parse the process's stdout.
 */
export async function writePortSidecar(userDataPath: string, port: number): Promise<void> {
  const sidecarPath = path.join(userDataPath, 'port.json');
  await fs.writeFile(
    sidecarPath,
    JSON.stringify({ port, writtenAt: new Date().toISOString() }, null, 2),
    'utf8',
  );
}
