"use client";

const SW_URL = "/sw.js";

/**
 * Registers the Masar X Service Worker.
 *
 * - Outside production, any Service Worker left behind by an earlier
 *   production-like session is actively UNREGISTERED (FR-026): a stale
 *   worker must never be able to keep serving old bundles over HMR.
 * - In production, registration is deferred to the `load` event so it
 *   never competes with hydration or first paint on slow connections.
 * - Safe to call multiple times: `navigator.serviceWorker.register()`
 *   is idempotent when scope + URL match an already-registered worker.
 * - Logs (does not throw) on registration failure so a broken SW
 *   cannot take down a page.
 */
export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  if (process.env.NODE_ENV !== "production") {
    // FR-026: outside production, purge any worker registered by an
    // earlier production-like session instead of merely skipping registration.
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        for (const registration of registrations) {
          void registration
            .unregister()
            .then((unregistered) => {
              if (unregistered) {
                console.info(
                  "[sw] stale service worker unregistered (non-production)",
                );
              }
            })
            .catch((err: unknown) => {
              console.warn("[sw] unregistration failed:", err);
            });
        }
      })
      .catch((err: unknown) => {
        console.warn("[sw] registration lookup failed:", err);
      });
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(SW_URL, { scope: "/" })
      .catch((err: unknown) => {
        console.warn("[sw] registration failed:", err);
      });
  });
}
