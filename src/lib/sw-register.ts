"use client";

const SW_URL = "/sw.js";

/**
 * Registers the Masar X Service Worker.
 *
 * - Skipped during development to avoid stale-cache confusion with HMR.
 * - Safe to call multiple times: `navigator.serviceWorker.register()`
 *   is idempotent when scope + URL match an already-registered worker.
 * - Deferred to the `load` event so registration never competes with
 *   hydration or first paint on slow connections.
 * - Logs (does not throw) on registration failure so a broken SW
 *   cannot take down a page.
 */
export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV === "development") return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(SW_URL, { scope: "/" })
      .catch((err: unknown) => {
        console.warn("[sw] registration failed:", err);
      });
  });
}
