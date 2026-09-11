"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * NavTooltip — accessible floating tooltip for the collapsed sidebar rail.
 *
 * - Shows on hover (300ms intent delay) AND on keyboard :focus-visible
 *   (instant). Never uses the `title` attribute.
 * - Portaled to <body> with position:fixed, so it is never clipped by the
 *   sidebar's overflow container.
 * - The chip is role="tooltip" + aria-hidden: the trigger keeps its own
 *   accessible name (the rail renders an sr-only label), so screen readers
 *   hear exactly one clean name with no double announcement.
 * - RTL aware: flips to the inline-start side when <html dir="rtl">.
 */

export interface NavTooltipTriggerProps {
  onMouseEnter: (event: ReactMouseEvent<HTMLElement>) => void;
  onMouseLeave: () => void;
  onFocus: (event: ReactFocusEvent<HTMLElement>) => void;
  onBlur: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
}

export interface NavTooltipProps {
  label: string;
  hint?: string;
  disabled?: boolean;
  children: (props: NavTooltipTriggerProps) => ReactElement;
}

const SHOW_DELAY_MS = 300;

export function NavTooltip({
  label,
  hint,
  disabled = false,
  children,
}: NavTooltipProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [rtl, setRtl] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
    setRtl(document.documentElement.dir === "rtl");
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    setOpen(false);
  }, [clearTimer]);

  const showAt = useCallback((element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const isRtl = document.documentElement.dir === "rtl";
    const x = isRtl ? rect.left - 12 : rect.right + 12;
    const y = Math.min(Math.max(rect.top + rect.height / 2, 24), window.innerHeight - 24);
    setCoords({ x, y });
    setOpen(true);
  }, []);

  const scheduleShow = useCallback(
    (element: HTMLElement, delay: number) => {
      clearTimer();
      timerRef.current = window.setTimeout(() => showAt(element), delay);
    },
    [clearTimer, showAt],
  );

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => hide();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, hide]);

  const triggerProps: NavTooltipTriggerProps = disabled
    ? {
        onMouseEnter: () => undefined,
        onMouseLeave: () => undefined,
        onFocus: () => undefined,
        onBlur: () => undefined,
        onKeyDown: () => undefined,
      }
    : {
        onMouseEnter: (event) => scheduleShow(event.currentTarget, SHOW_DELAY_MS),
        onMouseLeave: () => hide(),
        onFocus: (event) => {
          const el = event.currentTarget;
          let focusVisible = true;
          try {
            focusVisible = el.matches(":focus-visible");
          } catch {
            focusVisible = true;
          }
          if (focusVisible) scheduleShow(el, 0);
        },
        onBlur: () => hide(),
        onKeyDown: (event) => {
          if (event.key === "Escape") hide();
        },
      };

  return (
    <>
      {children(triggerProps)}
      {mounted && open && coords
        ? createPortal(
            <div
              role="tooltip"
              aria-hidden="true"
              style={{ left: coords.x, top: coords.y }}
              className={cn(
                "pointer-events-none fixed z-[80] max-w-[16rem] rounded-md bg-ax-tooltip-bg px-2.5 py-1.5 shadow-lg",
                "ax-tooltip-fade",
                rtl ? "-translate-x-full -translate-y-1/2" : "-translate-y-1/2",
              )}
            >
              <span className="block text-xs font-medium text-ax-tooltip-fg">
                {label}
              </span>
              {hint ? (
                <span className="mt-0.5 block text-xs text-ax-tooltip-fg/70">
                  {hint}
                </span>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}