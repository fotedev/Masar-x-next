"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/hooks/admin-shell/useFocusTrap";
import { useScrollLock } from "@/hooks/admin-shell/useScrollLock";

/**
 * MobileNav — off-canvas admin navigation drawer (< lg viewports only).
 *
 * Contract with the Topbar hamburger:
 *   hamburger carries aria-controls="ax-mobile-drawer" + aria-expanded;
 *   this panel carries id="ax-mobile-drawer".
 *
 * Accessibility:
 * - role="dialog" aria-modal="true" aria-label while open.
 * - Strict focus trap: Tab cycles inside, initial focus moves in, focus is
 *   restored to the hamburger on close.
 * - Escape dismisses; backdrop click dismisses.
 * - Body scroll lock with scrollbar compensation.
 * - Closed state is `invisible` + pointer-events-none, which removes the
 *   panel from the tab order and the accessibility tree, so closed links are
 *   NOT tabbable. The visibility transition keeps the slide-out animation
 *   intact and flips to hidden only at the end.
 * - SSR safe: the portal renders only after mount; the DOM stays mounted
 *   after the first open so exit transitions can play.
 * - RTL aware: slides from the inline-start edge in both directions.
 */

export interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label?: string;
}

export function MobileNav({
  open,
  onClose,
  children,
  label = "Navigation",
}: MobileDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) setEverOpened(true);
  }, [open]);

  useFocusTrap(panelRef, open);
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!mounted || !everOpened) return null;

  return createPortal(
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "ax-drawer-backdrop fixed inset-0 z-[70] bg-black/40 lg:hidden",
          open ? "visible opacity-100" : "pointer-events-none invisible opacity-0",
        )}
      />

      <div
        ref={panelRef}
        id="ax-mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-hidden={!open}
        tabIndex={-1}
        className={cn(
          "ax-drawer-panel fixed inset-y-0 start-0 z-[75] flex w-[min(84vw,320px)] flex-col bg-ax-surface shadow-lg outline-none lg:hidden",
          "ps-[env(safe-area-inset-left)]",
          open
            ? "visible translate-x-0"
            : "pointer-events-none invisible -translate-x-full rtl:translate-x-full",
        )}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}