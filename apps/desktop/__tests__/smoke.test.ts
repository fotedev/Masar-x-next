import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { request as httpRequest } from 'node:http';

// ============================================================================
// T018 — Smoke test for the desktop app
// Spec: specs/004-multi-platform-expansion/tasks.md §T018
//
// Red phase (today, before T020 lands):
//   This test boots the Electron process in headless mode, waits for the
//   local Next.js server to come up on a free port, and verifies the home
//   page renders and the AI assistant endpoint is reachable.
//
// It will FAIL until T020 (Electron main process) is implemented, because
// the headless launcher has nothing to spawn yet. The assertions below
// describe the contract — once T020 lands, they should all turn green.
// ============================================================================

const SMOKE_LAUNCH_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 250;

describe('T018 — Desktop app smoke test (red until T020)', () => {
  let child: ChildProcess | null = null;
  let discoveredPort: number | null = null;
  let stderrBuf = '';
  let stdoutBuf = '';

  beforeAll(async () => {
    // Boot the headless Electron build. The launcher writes the chosen
    // port to stdout in the form `MASARX_DESKTOP_PORT=<n>` so the test
    // can discover it without a fixed port.
    child = spawn(
      process.execPath,
      [
        '--no-warnings',
        './node_modules/electron/cli.js',
        '.',
        '--masarx-smoke',
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          ELECTRON_DISABLE_SANDBOX: '1',
          MASARX_SMOKE: '1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    child.stdout?.on('data', (chunk: Buffer) => {
      const s = chunk.toString();
      stdoutBuf += s;
      const m = stdoutBuf.match(/MASARX_DESKTOP_PORT=(\d+)/);
      if (m && discoveredPort === null) {
        discoveredPort = Number(m[1]);
      }
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString();
    });

    // Wait for the port banner to appear, or for the timeout.
    const start = Date.now();
    while (discoveredPort === null && Date.now() - start < SMOKE_LAUNCH_TIMEOUT_MS) {
      if (child.exitCode !== null) break;
      await wait(POLL_INTERVAL_MS);
    }
  }, SMOKE_LAUNCH_TIMEOUT_MS + 5_000);

  afterAll(async () => {
    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      // Give it a moment to exit cleanly; force-kill if not.
      const exited = await Promise.race([
        new Promise<boolean>((r) => child!.once('exit', () => r(true))),
        wait(2_000).then(() => false),
      ]);
      if (!exited) child.kill('SIGKILL');
    }
  });

  it('launches the Electron process and discovers a local port', () => {
    expect(child).not.toBeNull();
    expect(child!.exitCode).toBeNull();
    expect(discoveredPort).not.toBeNull();
    expect(discoveredPort).toBeGreaterThan(0);
  });

  it('serves the home page over the local Next.js server', async () => {
    if (discoveredPort === null) throw new Error('port not discovered');
    const body = await new Promise<string>((resolve, reject) => {
      const req = httpRequest(
        { host: '127.0.0.1', port: discoveredPort!, path: '/', method: 'GET' },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c.toString()));
          res.on('end', () => resolve(data));
        },
      );
      req.on('error', reject);
      req.end();
    });
    // The Next.js home page should at least mention the Masar X brand.
    expect(body.toLowerCase()).toMatch(/masar/);
  });

  it('exposes the AI assistant endpoint at /api/ai-assistant', async () => {
    if (discoveredPort === null) throw new Error('port not discovered');
    // A POST with no body should respond — even if 4xx — to prove the
    // route is wired. Auth-required routes return 401, which is fine.
    const status = await new Promise<number>((resolve, reject) => {
      const req = httpRequest(
        {
          host: '127.0.0.1',
          port: discoveredPort!,
          path: '/api/ai-assistant',
          method: 'POST',
          headers: { 'content-type': 'application/json' },
        },
        (res) => {
          res.on('data', () => undefined);
          res.on('end', () => resolve(res.statusCode ?? 0));
        },
      );
      req.on('error', reject);
      req.write('{}');
      req.end();
    });
    // The route exists if we get any HTTP status (200/400/401/etc),
    // not a connection-level error.
    expect(status).toBeGreaterThan(0);
    expect(status).toBeLessThan(600);
  });

  it('did not crash during the smoke window', () => {
    if (!child) return;
    expect(child.exitCode).toBeNull();
    // Stderr should not contain fatal error markers. Framework warnings
    // (e.g. "DevTools listening") are allowed.
    expect(stderrBuf).not.toMatch(/Uncaught Exception/i);
    expect(stderrBuf).not.toMatch(/FATAL:/i);
  });
});
