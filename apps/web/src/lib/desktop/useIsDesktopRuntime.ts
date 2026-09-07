"use client";

import { useEffect, useState } from "react";
import { isDesktopRuntime } from "./runtime";

/**
 * useIsDesktopRuntime — hydration-safe desktop detection (spec 005, FR-010)
 *
 * Returns `false` on the server AND on the very first client render, then
 * flips to `true` inside an effect if `window.masarxDesktop` is present.
 *
 * This ordering is deliberate: the server cannot know whether the request
 * came from Electron or a browser, so the first paint MUST match the web
 * markup or React logs a hydration mismatch and discards the tree. The
 * desktop chrome appears one frame later, which is invisible to the user
 * because the Electron window does not show until the page has loaded.
 *
 * Do NOT replace this with a bare `isDesktopRuntime()` call inside a
 * component body.
 */
export function useIsDesktopRuntime(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(isDesktopRuntime());
  }, []);

  return isDesktop;
}
