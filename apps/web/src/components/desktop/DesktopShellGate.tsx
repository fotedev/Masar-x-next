"use client";

import { useEffect } from "react";

import { useIsDesktopRuntime } from "@/lib/desktop/useIsDesktopRuntime";

/**
 * DesktopShellGate — runtime-gated entry point for spec 005's native-feel pass.
 *
 * Responsibility:
 *   1. When (and only when) useIsDesktopRuntime() is true, mark the root
 *      <html> element with `data-masarx-desktop="true"`. EVERY rule in
 *      desktop-shell.css is scoped under that single marker, so this one
 *      attribute is what flips the entire native-feel pass on and off.
 *   2. While the shell is active, suppress the platform context menu so
 *      right-click does not surface Back / Reload / Inspect (FR-016).
 *
 * In a plain browser tab the hook returns false on every render (SSR +
 * first-paint), the effects short-circuit, and the gate renders nothing.
 * This guarantees FR-011: the browser experience is unchanged when the
 * desktop shell is absent.
 *
 * NOTE: We deliberately do NOT call isDesktopRuntime() directly here.
 * The hook is hydration-safe (false on the server, false on the first
 * client render, flips in an effect). A bare runtime check in the
 * component body would render `null` on the server and `null` on the
 * first client paint but potentially flip in the same commit, which
 * React would log as a hydration mismatch.
 *
 * Cleanup is symmetric: on unmount we restore the prior attribute state
 * (or remove it if it was unset) and detach the contextmenu listener so
 * removing the gate restores the browser default.
 */
export function DesktopShellGate(): null {
  const isDesktop = useIsDesktopRuntime();

  useEffect(() => {
    if (!isDesktop) return;

    const root = document.documentElement;

    // FR-011: capture the prior value so we restore it on unmount rather
    // than blindly removing an attribute another component might rely on.
    const previousValue = root.getAttribute("data-masarx-desktop");

    if (previousValue !== "true") {
      root.setAttribute("data-masarx-desktop", "true");
    }

    // FR-016: suppress the platform context menu while the shell is active.
    // Capture phase so we run before any in-app contextmenu handler that
    // might want to show its own UI; the desktop app does not have one.
    const suppressContextMenu = (event: MouseEvent): void => {
      event.preventDefault();
    };
    document.addEventListener("contextmenu", suppressContextMenu, true);

    return () => {
      document.removeEventListener("contextmenu", suppressContextMenu, true);

      if (previousValue === null) {
        root.removeAttribute("data-masarx-desktop");
      } else {
        root.setAttribute("data-masarx-desktop", previousValue);
      }
    };
  }, [isDesktop]);

  return null;
}