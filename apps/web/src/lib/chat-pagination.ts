/**
 * Range pagination for the lazily synced chat history (spec 011). The DB
 * retains the newest CHAT_HISTORY_CAP rows per (user, mode) (spec 008 prune);
 * the UI loads the newest page first and walks backwards through the retained
 * window as the user scrolls up.
 */

export const CHAT_PAGE_SIZE = 30;
export const CHAT_HISTORY_CAP = 100;

export interface OlderRange {
  start: number;
  end: number;
}

/** Next [start, end] window of older rows, or null when nothing remains. */
export const nextOlderRange = (
  loadedCount: number,
  pageSize: number = CHAT_PAGE_SIZE,
  cap: number = CHAT_HISTORY_CAP,
): OlderRange | null => {
  if (loadedCount <= 0 || loadedCount >= cap) return null;
  return { start: loadedCount, end: Math.min(loadedCount + pageSize, cap) - 1 };
};

/** Whether a full page was fetched and the retained window is not exhausted. */
export const hasMoreAfterLoad = (
  fetchedCount: number,
  requestedCount: number,
  newLoadedCount: number,
  cap: number = CHAT_HISTORY_CAP,
): boolean => fetchedCount >= requestedCount && newLoadedCount < cap;
