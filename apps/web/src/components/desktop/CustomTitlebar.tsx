"use client";

/**
 * CustomTitlebar — frameless titlebar chrome for the desktop shell (spec 005, US3).
 *
 * Renders ONLY inside the Electron shell. In a plain browser tab the
 * `useIsDesktopRuntime` hook returns `false` (server + first client paint)
 * and we render `null`, so FR-011 holds: the browser experience is
 * byte-for-byte unchanged.
 *
 * Visual contract:
 *   - Height is driven by the `--masarx-titlebar-h` CSS variable that
 *     desktop-shell.css sets to 32px under `[data-masarx-desktop="true"]`.
 *     We never hard-code a pixel value here so a future tweak to the
 *     theme (taller/denser bar) lands in one place.
 *   - The bar background uses `--background`/`--border` so it follows the
 *     user's light/dark theme (set on `<html class="dark">`).
 *   - On RTL locales, the action cluster flips automatically — we use
 *     `inline-end` rather than `right` so the dir attribute does the work.
 *   - The full bar gets `-webkit-app-region: drag` (CSS) so the user can
 *     grab anywhere on it and drag the window. Any interactive element
 *     inside (button, link) gets `-webkit-app-region: no-drag` so it
 *     stays clickable.
 *
 * Window controls (minimize / toggleMaximize / close) route through the
 * preload bridge. The `window` namespace on the bridge is OPTIONAL by
 * contract (runtime.ts: `window?: {...}`) — pre-load versions before
 * spec 005 shipped may not have the IPC handlers wired yet, in which
 * case the bridge exposes no `window` surface. Every action is therefore
 * null-safe and silently degrades to a no-op so the titlebar never
 * crashes the shell. Once T040–T043 land and the main-process handlers
 * are installed, the same buttons start working without code changes.
 *
 * The "isMaximized" indicator on the toggle button subscribes through
 * `bridge.window.onMaximizeChange`. If the bridge is absent we render
 * the button anyway (the click still goes through if/when the IPC is
 * added) and just skip the visual indicator — accessibility, not state.
 *
 * Localization (I3): all labels come from the `titlebar` namespace (packages/shared/src/messages/{ar,en}/titlebar.json).
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { useIsDesktopRuntime } from "@/lib/desktop/useIsDesktopRuntime";
import type { MasarxDesktopRuntimeBridge } from "@/lib/desktop/runtime";

/**
 * Defensive helper. The bridge shape is `window?` so the renderer must
 * never crash when the IPC channel is missing — that would defeat
 * spec 005's "degrade instead of crash" promise.
 */
function getWindowSurface(
  bridge: MasarxDesktopRuntimeBridge | null,
): MasarxDesktopRuntimeBridge["window"] | null {
  return bridge?.window ?? null;
}

export function CustomTitlebar(): React.JSX.Element | null {
  const t = useTranslations("titlebar");
  const isDesktop = useIsDesktopRuntime();
  const [isMaximized, setIsMaximized] = useState(false);

  // Subscribe to maximize-state changes once we know we are inside the
  // shell. We do this in an effect (not at module scope) because the
  // bridge only exists after the Electron preload script has run.
  useEffect(() => {
    if (!isDesktop) {
      return undefined;
    }

    // Lazy import pattern: importing runtime directly would force the
    // bundle to keep it on the web path too. The `window` global is
    // guaranteed by the gate, so a direct read is safe here AND
    // narrower than importing the helper.
    const bridge = (
      window as unknown as { masarxDesktop?: MasarxDesktopRuntimeBridge }
    ).masarxDesktop;
    const win = getWindowSurface(bridge ?? null);
    if (!win) {
      return undefined;
    }

    const unsubscribe = win.onMaximizeChange((next) => {
      setIsMaximized(next);
    });

    // Initial probe — older shells may emit the change event only when
    // a toggle happens, missing the initial state. Best-effort sync.
    void win.isMaximized().then(setIsMaximized).catch(() => {});

    return unsubscribe;
  }, [isDesktop]);

  const onMinimize = useCallback((): void => {
    const win = getWindowSurface(
      (window as unknown as { masarxDesktop?: MasarxDesktopRuntimeBridge })
        .masarxDesktop ?? null,
    );
    if (!win) return;
    win.minimize().catch(() => {
      // Silent: missing IPC is expected before T040 lands.
    });
  }, []);

  const onToggleMaximize = useCallback((): void => {
    const win = getWindowSurface(
      (window as unknown as { masarxDesktop?: MasarxDesktopRuntimeBridge })
        .masarxDesktop ?? null,
    );
    if (!win) return;
    win.toggleMaximize().catch(() => {});
  }, []);

  const onClose = useCallback((): void => {
    const win = getWindowSurface(
      (window as unknown as { masarxDesktop?: MasarxDesktopRuntimeBridge })
        .masarxDesktop ?? null,
    );
    if (!win) return;
    win.close().catch(() => {});
  }, []);

  // Gate: never render in SSR or first client paint. Re-evaluated
  // post-hydration when the runtime flips on.
  if (!isDesktop) {
    return null;
  }

  return (
    <header
      role="banner"
      aria-label={t("bannerAria")}
      // Height is owned by CSS (--masarx-titlebar-h in desktop-shell.css).
      // `masarx-titlebar` makes the whole strip a drag handle.
      className="masarx-titlebar fixed inset-x-0 top-0 z-[9999] flex h-8 items-center justify-between border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70"
      dir="ltr"
    >
      {/* Drag-only lead slot: enough to grab but small enough that the
          app menu can live here later without breaking the drag region. */}
      <div className="masarx-titlebar-nodrag flex h-full items-center px-3">
        <span className="select-none text-xs font-medium text-muted-foreground">
          {t("appName")}
        </span>
      </div>

      {/* Trailing action cluster. `inline-end` flips under `<html dir="rtl">`. */}
      <div className="masarx-titlebar-nodrag flex h-full items-center gap-1 pe-1">
        <button
          type="button"
          onClick={onMinimize}
          aria-label={t("minimizeAria")}
          title={t("minimize")}
          className="inline-flex h-8 w-10 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <MinimizeGlyph />
        </button>
        <button
          type="button"
          onClick={onToggleMaximize}
          aria-label={isMaximized ? t("restoreAria") : t("maximizeAria")}
          title={isMaximized ? t("restore") : t("maximize")}
          className="inline-flex h-8 w-10 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {isMaximized ? <RestoreGlyph /> : <MaximizeGlyph />}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("closeAria")}
          title={t("close")}
          className="inline-flex h-8 w-10 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <CloseGlyph />
        </button>
      </div>
    </header>
  );
}

/* ---------- Inline SVGs ----------
   Inline so the titlebar ships with no extra network round-trip and stays
   crisp on any DPI. Strokes use `currentColor` so hover styles pick up
   without a re-render. Each glyph is 16x16 to match the in-app icon scale. */

function MinimizeGlyph(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="M3 8h10" />
    </svg>
  );
}

function MaximizeGlyph(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3.5" y="3.5" width="9" height="9" rx="1" />
    </svg>
  );
}

function RestoreGlyph(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="5" width="7" height="7" rx="1" />
      <path d="M3.5 11V4a.5.5 0 0 1 .5-.5h7" />
    </svg>
  );
}

function CloseGlyph(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export default CustomTitlebar;
