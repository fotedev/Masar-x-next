"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatCardTone = "neutral" | "accent" | "warning" | "info";
export type StatBadgeTone = "success" | "warning" | "danger" | "neutral";

export interface StatCardBadge {
  label: string;
  tone?: StatBadgeTone;
}

export interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  tone?: StatCardTone;
  badge?: StatCardBadge;
  trend?: ReactNode;
  className?: string;
}

const STAT_TONE: Record<StatCardTone, { icon: string }> = {
  neutral: { icon: "bg-ax-surface-inset text-ax-secondary" },
  accent: { icon: "bg-ax-accent-soft text-ax-accent" },
  warning: { icon: "bg-ax-warning-soft text-ax-warning" },
  info: { icon: "bg-ax-info-soft text-ax-info" },
};

const BADGE_TONE: Record<StatBadgeTone, string> = {
  success: "bg-ax-success-soft text-ax-success",
  warning: "bg-ax-warning-soft text-ax-warning",
  danger: "bg-ax-danger-soft text-ax-danger",
  neutral: "bg-ax-surface-inset text-ax-muted",
};

export function StatCard({
  icon: Icon,
  label,
  value,
  tone = "neutral",
  badge,
  trend,
  className,
}: StatCardProps) {
  const displayValue =
    typeof value === "number" ? value.toLocaleString() : value;

  return (
    <div
      className={cn(
        "flex min-w-0 items-start gap-3 rounded-xl border border-ax-edge bg-ax-surface p-3.5 shadow-ax-sm sm:gap-4 sm:p-5",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:h-11 sm:w-11",
          STAT_TONE[tone].icon,
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-ax-secondary sm:text-sm">
          {label}
        </p>
        <p className="mt-1 truncate text-xl font-bold tabular-nums text-ax-primary sm:text-2xl lg:text-3xl">
          {displayValue}
        </p>
        {badge || trend ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:mt-2">
            {badge ? (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap sm:text-xs",
                  BADGE_TONE[badge.tone ?? "neutral"],
                )}
              >
                {badge.label}
              </span>
            ) : null}
            {trend ? (
              <div className="inline-flex items-center">{trend}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
