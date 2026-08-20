import { createServer, type AddressInfo } from 'node:net';
import { promises as fs } from 'node:fs';
import path from 'node:path';

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

export async function readPortSidecar(userDataPath: string): Promise<number | undefined> {
  try {
    const sidecarPath = path.join(userDataPath, 'port.json');
    const raw = await fs.readFile(sidecarPath, 'utf8');
    const parsed = JSON.parse(raw) as { port?: unknown };
    return typeof parsed.port === 'number' ? parsed.port : undefined;
  } catch {
    return undefined;
  }
}
