"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * AdminStatusBadge - small pill used in table cells for row state.
 * Tones map onto the namespaced --ax-* feedback tokens, so they stay
 * WCAG AA compliant in both themes (verified by the token contrast audit).
 */
export type AdminBadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE_CLASS: Record<AdminBadgeTone, string> = {
  neutral: "bg-ax-surface-inset text-ax-secondary",
  info: "bg-ax-info-soft text-ax-info",
  success: "bg-ax-success-soft text-ax-success",
  warning: "bg-ax-warning-soft text-ax-warning",
  danger: "bg-ax-danger-soft text-ax-danger",
};

export function AdminStatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: AdminBadgeTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASS[tone],
      )}
    >
      {children}
    </span>
  );
}
