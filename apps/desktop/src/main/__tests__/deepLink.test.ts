import { describe, it, expect } from 'vitest';
import { parseDeepLinkUrl } from '../deepLink';

// ============================================================================
// Spec 014 R030 — unit tests for the masarx:// deep-link parser.
//
// Repo lesson (normalizeLatexDelimiters, 52d7c12): every parser gets real
// tests with non-trivial inputs the moment it is extracted. These pin the
// exact acceptance shape — main never forwards an argv entry this parser
// would reject.
// ============================================================================

describe('parseDeepLinkUrl', () => {
  it('extracts a valid auth callback from realistic argv (exe path + flags first)', () => {
    const argv = [
      'C:\\Program Files\\Masar X\\Masar X.exe',
      '--some-flag',
      'masarx://auth/callback?code=abc123',
    ];
    expect(parseDeepLinkUrl(argv)).toBe('masarx://auth/callback?code=abc123');
  });

  it('returns the FIRST matching deep link when several are present', () => {
    const argv = [
      'masarx://auth/callback?code=first',
      'masarx://auth/callback?code=second',
    ];
    expect(parseDeepLinkUrl(argv)).toBe('masarx://auth/callback?code=first');
  });

  it('returns null when no deep link is present', () => {
    expect(parseDeepLinkUrl([])).toBeNull();
    expect(parseDeepLinkUrl(['C:\\app\\Masar X.exe', '--flag'])).toBeNull();
  });

  it('rejects a wrong host (open-redirect style masarx://evil/callback)', () => {
    expect(parseDeepLinkUrl(['masarx://evil/callback?code=x'])).toBeNull();
  });

  it('rejects a wrong path (masarx://auth/other)', () => {
    expect(parseDeepLinkUrl(['masarx://auth/other?code=x'])).toBeNull();
  });

  it('rejects a missing path (masarx://auth)', () => {
    expect(parseDeepLinkUrl(['masarx://auth'])).toBeNull();
  });

  it('rejects other protocols entirely', () => {
    expect(parseDeepLinkUrl(['https://auth/callback?code=x'])).toBeNull();
    expect(parseDeepLinkUrl(['file:///c:/auth/callback'])).toBeNull();
  });

  it('rejects malformed URLs without throwing', () => {
    expect(parseDeepLinkUrl(['masarx://'])).toBeNull();
    expect(parseDeepLinkUrl(['masarx://\\bad'])).toBeNull();
  });

  it('is case-insensitive on the protocol prefix and host, but the path stays exact', () => {
    expect(parseDeepLinkUrl(['MASARX://auth/callback?code=up'])).toBe(
      'MASARX://auth/callback?code=up',
    );
    // A case-variant path is a different route — rejected.
    expect(parseDeepLinkUrl(['masarx://auth/CALLBACK?code=up'])).toBeNull();
  });
});
