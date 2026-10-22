/**
 * Client-side pings for the lean metrics system. Fire-and-forget by
 * contract: analytics must never delay or break a user flow, so every
 * call swallows its own errors. The server (POST /api/metrics/event)
 * authenticates the session cookie and writes Redis counters; these
 * helpers carry no ids beyond what the UI already shows.
 */

export interface TrackedDownload {
  id?: string;
  title?: string;
  fileUrl?: string;
}

const sendEvent = (payload: Record<string, unknown>): void => {
  if (typeof window === 'undefined') return;
  try {
    void fetch('/api/metrics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // ignore — metrics are best-effort
    });
  } catch {
    // ignore
  }
};

/** File opened/downloaded by the user (homework PDFs, lecture files). */
export const trackFileDownload = (file: TrackedDownload): void => {
  sendEvent({ type: 'download', id: file.id, title: file.title, fileUrl: file.fileUrl });
};

/** Authenticated presence heartbeat — one call per app load. */
export const pingActiveUser = (): void => {
  sendEvent({ type: 'active_ping' });
};
