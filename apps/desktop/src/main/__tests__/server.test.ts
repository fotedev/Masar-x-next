import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';

// ============================================================================
// Spec 028 — Contract test for the Next.js child-server log routing
// (server.ts production path)
//
// Closes the gap recorded at ledger closeout 2026-09-30 in
// specs/028-desktop-crashpad-logs/spec.md: the routing was implemented
// (child stdout/stderr piped through nextServerLog) but untested.
//
// Contract assertions:
//   1. Each stdout data chunk lands on nextServerLog.info as ONE call,
//      with trailing whitespace/newlines trimmed (trimEnd) and inner
//      lines intact — no per-line splitting, no full trim().
//   2. Each stderr data chunk lands on nextServerLog.error the same way.
//   3. No cross-talk: a stdout chunk never reaches error level and a
//      stderr chunk never reaches info level.
//   4. Null streams (child spawned without piped stdio) are tolerated —
//      the child.stdout?./child.stderr?. guards must not throw.
//
// The logging scope wiring itself (log.scope('next-server')) is covered
// by logging.test.ts; this suite mocks ./logging.js to assert the exact
// routing surface server.ts owns.
// ============================================================================

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

vi.mock('node:fs', () => ({
  promises: {
    access: vi.fn(),
  },
}));

vi.mock('../port.js', () => ({
  findFreePort: vi.fn(),
  writePortSidecar: vi.fn(),
}));

vi.mock('../logging.js', () => ({
  nextServerLog: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Import AFTER mocks (same pattern as logging.test.ts).
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { findFreePort, writePortSidecar } from '../port.js';
import { nextServerLog } from '../logging.js';
import { startLocalServer } from '../server.js';

const SPAWN_PORT = 41234;

interface FakeChildOptions {
  /** 'pipe' wires a real EventEmitter; anything else leaves the stream null. */
  stdout?: 'pipe' | null;
  stderr?: 'pipe' | null;
}

/** Minimal ChildProcess double: EventEmitters for the piped stdio streams. */
function makeFakeChild({ stdout = 'pipe', stderr = 'pipe' }: FakeChildOptions = {}) {
  const child = new EventEmitter() as unknown as ChildProcess;
  (child as unknown as { stdout: EventEmitter | null }).stdout =
    stdout === 'pipe' ? new EventEmitter() : null;
  (child as unknown as { stderr: EventEmitter | null }).stderr =
    stderr === 'pipe' ? new EventEmitter() : null;
  (child as unknown as { exitCode: number | null }).exitCode = null;
  child.kill = vi.fn();
  return child;
}

/** Kick off the production path and burn the 500ms early-error wait. */
async function startProductionServer(child: ChildProcess) {
  vi.mocked(spawn).mockReturnValue(child);
  const pending = startLocalServer({
    userDataPath: '/fake/userData',
    isPackaged: true,
    forceDev: false,
  });
  // The early-failure detection waits 500ms for error/exit before treating
  // the spawn as healthy; flush it on the fake clock.
  await vi.advanceTimersByTimeAsync(501);
  return pending;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();

  vi.mocked(findFreePort).mockResolvedValue(SPAWN_PORT);
  vi.mocked(writePortSidecar).mockResolvedValue(undefined);
  vi.mocked(fs.access).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('next-server log routing (server.ts, spec 028)', () => {
  it('routes a stdout chunk to nextServerLog.info, trailing newline trimmed', async () => {
    const child = makeFakeChild();
    const server = await startProductionServer(child);

    child.stdout!.emit('data', Buffer.from('Ready in 120ms\n'));

    expect(nextServerLog.info).toHaveBeenCalledTimes(1);
    expect(nextServerLog.info).toHaveBeenCalledWith('Ready in 120ms');
    expect(nextServerLog.error).not.toHaveBeenCalled();
    expect(server.port).toBe(SPAWN_PORT);
  });

  it('routes a stderr chunk to nextServerLog.error, with no info cross-talk', async () => {
    const child = makeFakeChild();
    await startProductionServer(child);

    const chunk = 'Error: listen EADDRINUSE: address already in use 127.0.0.1:41234\n';
    child.stderr!.emit('data', Buffer.from(chunk));

    expect(nextServerLog.error).toHaveBeenCalledTimes(1);
    expect(nextServerLog.error).toHaveBeenCalledWith(chunk.trimEnd());
    expect(nextServerLog.info).not.toHaveBeenCalled();
  });

  it('forwards a multi-line chunk as ONE call with inner lines intact (trimEnd, not per-line split)', async () => {
    const child = makeFakeChild();
    await startProductionServer(child);

    child.stdout!.emit('data', Buffer.from('▲ Next.js 16\n- Local: http://127.0.0.1:41234\n'));

    expect(nextServerLog.info).toHaveBeenCalledTimes(1);
    expect(nextServerLog.info).toHaveBeenCalledWith(
      '▲ Next.js 16\n- Local: http://127.0.0.1:41234',
    );
  });

  it('does not throw when the child was spawned without piped streams (null stdout/stderr)', async () => {
    const child = makeFakeChild({ stdout: null, stderr: null });

    const server = await startProductionServer(child);

    expect(server.port).toBe(SPAWN_PORT);
    expect(nextServerLog.info).not.toHaveBeenCalled();
    expect(nextServerLog.error).not.toHaveBeenCalled();
  });

  it('dev mode never spawns a child (routing only exists on the production path)', async () => {
    const server = await startLocalServer({
      userDataPath: '/fake/userData',
      isPackaged: false,
      forceDev: false,
    });

    expect(spawn).not.toHaveBeenCalled();
    expect(nextServerLog.info).not.toHaveBeenCalled();
    expect(nextServerLog.error).not.toHaveBeenCalled();
    expect(server.port).toBe(3000);
  });
});
