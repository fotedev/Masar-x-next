"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * Strict, SSR-safe focus trap (Aurora Admin port).
 * Tab cycles inside the container; focusables re-queried per keydown;
 * focus restored to the pre-activation element on deactivation.
 */
const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

export interface FocusTrapOptions {
  initialFocus?: boolean;
  returnFocus?: boolean;
}

function isElementVisible(el: HTMLElement): boolean {
  try {
    if (typeof el.checkVisibility === "function") {
      return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    }
  } catch {
    /* older engines */
  }
  return el.getClientRects().length > 0;
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("disabled") && !el.closest("[inert]") && isElementVisible(el),
  );
}

export function useFocusTrap<T extends HTMLElement>(
  ref: RefObject<T | null>,
  active: boolean,
  options: FocusTrapOptions = {},
): void {
  const { initialFocus = true, returnFocus = true } = options;
  const restoreTarget = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    restoreTarget.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (initialFocus) {
      const focusables = getFocusable(container);
      (focusables[0] ?? container).focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusables = getFocusable(container);
      if (focusables.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement;
      const inside = current instanceof Node && container.contains(current);

      if (event.shiftKey) {
        if (current === first || !inside) {
          event.preventDefault();
          last.focus();
        }
      } else if (current === last || !inside) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (returnFocus) {
        const el = restoreTarget.current;
        if (el && document.contains(el)) el.focus();
      }
      restoreTarget.current = null;
    };
  }, [active, initialFocus, returnFocus, ref]);
}
