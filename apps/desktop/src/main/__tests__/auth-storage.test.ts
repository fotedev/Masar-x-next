import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { existsSync, mkdirSync, rmSync } from 'node:fs';

// ============================================================================
// T021 — Contract test for LocalAuthSession (auth-storage.ts)
//
// Spec: specs/004-multi-platform-expansion/tasks.md §T021
// Data: specs/004-multi-platform-expansion/data-model.md §"LocalAuthSession"
//
// This test defines the contract that `apps/desktop/src/main/auth-storage.ts`
// must satisfy. It is written FIRST (TDD red phase). It MUST fail until T021
// implements the LocalAuthSession class.
//
// The contract has four assertions:
//   1. read() returns `null` on a fresh userData dir (no session yet).
//   2. write() → read() round-trips a Session losslessly.
//   3. The on-disk file is NOT plaintext (the access_token literal must
//      not appear in the raw bytes).
//   4. clear() removes the file AND read() returns `null` afterwards.
//
// Encryption layer: Electron's `safeStorage` API (DPAPI on Windows,
// Keychain on macOS, libsecret/kwallet on Linux). We mock it here so
// the test does not require a real OS keystore, but the contract is
// "the file on disk is ciphertext, not plaintext".
// ============================================================================

// --- safeStorage mock --------------------------------------------------------
// `safeStorage.encryptString` returns Buffer; `safeStorage.decryptString`
// returns the plaintext string. We model these as a trivial XOR-with-
// rotating-key round-trip so the on-disk bytes are NOT the raw plaintext
// (the contract test asserts this).

const safeStorageMockState = {
  available: true,
  backend: 'gnome_libsecret' as string,
};

const MOCK_KEY = [0x5a, 0xa5, 0x3c, 0xc3, 0x0f, 0xf0, 0x99];

function mockEncrypt(plain: string): Buffer {
  const src = Buffer.from(plain, 'utf8');
  const out = Buffer.alloc(src.length);
  for (let i = 0; i < src.length; i++) {
    out[i] = src[i] ^ MOCK_KEY[i % MOCK_KEY.length];
  }
  return out;
}

function mockDecrypt(buf: Buffer): string {
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) {
    out[i] = buf[i] ^ MOCK_KEY[i % MOCK_KEY.length];
  }
  return out.toString('utf8');
}

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => safeStorageMockState.available,
    getSelectedStorageBackend: () => safeStorageMockState.backend,
    encryptString: (plaintext: string) => mockEncrypt(plaintext),
    decryptString: (encrypted: Buffer) => mockDecrypt(encrypted),
  },
}));

// Import AFTER the mock is registered. Vitest hoists vi.mock() so this is
// safe even though it looks like a sequencing violation.
import { LocalAuthSession, type StoredSession } from '../auth-storage.js';

// --- per-test temp dir -------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  // Unique tmp dir per test so parallel runs don't collide.
  tmpDir = path.join(
    os.tmpdir(),
    `masarx-auth-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(async () => {
  if (existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

const sampleSession = {
  access_token: 'eyJhbGciOiJIUzI1NiJ9.PLAINTEXT_TOKEN_DO_NOT_LOG',
  refresh_token: 'refresh_PLAINTEXT_DO_NOT_LOG',
  expires_at: 1_900_000_000,
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'user-123', email: 'test@example.com' },
} as const;

// --- tests -------------------------------------------------------------------

describe('T021 — LocalAuthSession contract', () => {
  it('returns null on a fresh userData dir (no session yet)', async () => {
    const storage = new LocalAuthSession({ userDataPath: tmpDir });
    const session = await storage.read();
    expect(session).toBeNull();
  });

  it('round-trips a Session through write → read', async () => {
    const storage = new LocalAuthSession({ userDataPath: tmpDir });
    await storage.write(sampleSession as unknown as StoredSession);
    const readBack = await storage.read();
    expect(readBack).toEqual(sampleSession);
  });

  it('writes ciphertext (NOT plaintext) to disk', async () => {
    const storage = new LocalAuthSession({ userDataPath: tmpDir });
    await storage.write(sampleSession as unknown as StoredSession);

    const sessionFile = path.join(tmpDir, 'auth', 'session.bin');
    expect(existsSync(sessionFile)).toBe(true);

    const onDisk = await fs.readFile(sessionFile);
    const onDiskText = onDisk.toString('utf8');

    // The raw plaintext must NOT appear on disk. If it does, encryption
    // is broken and the contract is violated.
    expect(onDiskText).not.toContain(sampleSession.access_token);
    expect(onDiskText).not.toContain(sampleSession.refresh_token);
    expect(onDiskText).not.toContain('test@example.com');
  });

  it('clears the session on signOut', async () => {
    const storage = new LocalAuthSession({ userDataPath: tmpDir });
    await storage.write(sampleSession as unknown as StoredSession);
    expect(await storage.read()).not.toBeNull();

    await storage.clear();

    expect(await storage.read()).toBeNull();
    const sessionFile = path.join(tmpDir, 'auth', 'session.bin');
    expect(existsSync(sessionFile)).toBe(false);
  });

  it('emits onChange events on write and clear', async () => {
    const storage = new LocalAuthSession({ userDataPath: tmpDir });
    const events: Array<unknown> = [];
    const unsub = storage.onChange((s) => events.push(s));

    await storage.write(sampleSession as unknown as StoredSession);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(sampleSession);

    await storage.clear();
    expect(events).toHaveLength(2);
    expect(events[1]).toBeNull();

    unsub();
    await storage.write(sampleSession as unknown as StoredSession);
    // After unsubscribe, no new events.
    expect(events).toHaveLength(2);
  });
});
