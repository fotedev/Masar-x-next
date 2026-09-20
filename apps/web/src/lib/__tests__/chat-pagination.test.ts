import { describe, expect, it } from 'vitest';

import { CHAT_HISTORY_CAP, CHAT_PAGE_SIZE, hasMoreAfterLoad, nextOlderRange } from '../chat-pagination';

describe('nextOlderRange (spec 011 lazy sync)', () => {
  it('walks the retained window in CHAT_PAGE_SIZE steps', () => {
    expect(nextOlderRange(30)).toEqual({ start: 30, end: 59 });
    expect(nextOlderRange(60)).toEqual({ start: 60, end: 89 });
    expect(nextOlderRange(90)).toEqual({ start: 90, end: 99 });
  });

  it('clamps the last page to the cap', () => {
    expect(nextOlderRange(90)).toEqual({ start: 90, end: CHAT_HISTORY_CAP - 1 });
    const range = nextOlderRange(80);
    expect(range).toEqual({ start: 80, end: 99 });
  });

  it('returns null before any load and once the cap is reached', () => {
    expect(nextOlderRange(0)).toBeNull();
    expect(nextOlderRange(100)).toBeNull();
    expect(nextOlderRange(101)).toBeNull();
  });

  it('honors custom page size and cap', () => {
    expect(nextOlderRange(10, 5, 20)).toEqual({ start: 10, end: 14 });
    expect(nextOlderRange(18, 5, 20)).toEqual({ start: 18, end: 19 });
  });
});

describe('hasMoreAfterLoad (spec 011 lazy sync)', () => {
  it('stays true after a full page below the cap', () => {
    expect(hasMoreAfterLoad(30, CHAT_PAGE_SIZE, 60)).toBe(true);
  });

  it('flips false on a short page', () => {
    expect(hasMoreAfterLoad(7, CHAT_PAGE_SIZE, 37)).toBe(false);
  });

  it('flips false once the cap is reached', () => {
    expect(hasMoreAfterLoad(10, CHAT_PAGE_SIZE, CHAT_HISTORY_CAP)).toBe(false);
  });

  it('flips false on an empty fetch', () => {
    expect(hasMoreAfterLoad(0, CHAT_PAGE_SIZE, 30)).toBe(false);
  });
});
