import { describe, expect, it, vi } from 'vitest';

import { createSupabaseClient } from '../index';
import { makeJwt } from './jwt-helper';

// Spec 040 — the mobile runtime path with a storage adapter is
// apps/mobile's real production config (SecureStoreAdapter); the original
// factory suite only pinned the desktop twin.

const URL = 'https://example.supabase.co';
const ANON = makeJwt({ role: 'anon' });

function makeStorage() {
  return {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  };
}

describe('createSupabaseClient mobile runtime (with storage adapter)', () => {
  it('constructs a client and tags platform=mobile in __clientInfo', () => {
    const client = createSupabaseClient({
      runtime: 'mobile',
      url: URL,
      anonKey: ANON,
      storage: makeStorage(),
      appVersion: '0.7.0',
    });
    expect((client as { __clientInfo?: string }).__clientInfo).toBe(
      'platform=mobile; app_version=0.7.0',
    );
  });

  it('defaults the version to 0.0.0 when appVersion is omitted', () => {
    const client = createSupabaseClient({
      runtime: 'mobile',
      url: URL,
      anonKey: ANON,
      storage: makeStorage(),
    });
    expect((client as { __clientInfo?: string }).__clientInfo).toBe(
      'platform=mobile; app_version=0.0.0',
    );
  });

  it('exposes an auth surface (persistSession wired through supabase-js)', () => {
    const client = createSupabaseClient({
      runtime: 'mobile',
      url: URL,
      anonKey: ANON,
      storage: makeStorage(),
    });
    expect(typeof client.auth.getSession).toBe('function');
    expect(typeof client.auth.getUser).toBe('function');
  });

  it('still requires the storage adapter and names SecureStoreAdapter in the error', () => {
    expect(() =>
      createSupabaseClient({ runtime: 'mobile', url: URL, anonKey: ANON }),
    ).toThrow(/SecureStoreAdapter/);
  });

  it('HARD GUARANTEE still applies on the mobile path', () => {
    expect(() =>
      createSupabaseClient({
        runtime: 'mobile',
        url: URL,
        anonKey: makeJwt({ role: 'service_role' }),
        storage: makeStorage(),
      }),
    ).toThrow(/service_role/);
  });
});
