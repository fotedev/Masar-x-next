"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminTabId } from "@/lib/admin-shell/navigation";
import { NavTooltip, type NavTooltipTriggerProps } from "./NavTooltip";

/**
 * AdminSidebarItem — one admin navigation entry.
 *
 * The legacy admin dashboard drives views with component state (activeTab),
 * not URLs, so this is a <button> rather than a <Link>. The active entry is
 * marked aria-current="page" and flagged with an accent fill plus a 3px
 * inline-start indicator.
 *
 * Touch target is always >= 44x44px (h-11). In rail mode the label moves to an
 * sr-only span and a floating NavTooltip supplies the visual affordance.
 */

export type AdminBadgeTone = "info" | "success" | "warning" | "danger";

export interface AdminSidebarBadge {
  count: number;
  tone?: AdminBadgeTone;
}

export interface AdminSidebarItemProps {
  id: AdminTabId;
  label: string;
  icon: LucideIcon;
  active: boolean;
  rail: boolean;
  hint?: string;
  badge?: AdminSidebarBadge;
  onSelect: (id: AdminTabId) => void;
}

const badgeToneClasses: Record<AdminBadgeTone, string> = {
  info: "bg-ax-info-soft text-ax-info",
  success: "bg-ax-success-soft text-ax-success",
  warning: "bg-ax-warning-soft text-ax-warning",
  danger: "bg-ax-danger-soft text-ax-danger",
};

const dotToneClasses: Record<AdminBadgeTone, string> = {
  info: "bg-ax-info",
  success: "bg-ax-success",
  warning: "bg-ax-warning",
  danger: "bg-ax-danger",
};

function formatCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

export function AdminSidebarItem({
  id,
  label,
  icon: Icon,
  active,
  rail,
  hint,
  badge,
  onSelect,
}: AdminSidebarItemProps) {
  const tone = badge?.tone ?? "info";

  const button = (triggerProps?: NavTooltipTriggerProps) => (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-11 items-center gap-3 rounded-md text-sm font-medium outline-none",
        "transition-colors duration-150 ease-ax-standard",
        "focus-visible:ring-2 focus-visible:ring-ax-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface",
        rail ? "mx-auto w-11 justify-center" : "mx-1 w-[calc(100%-0.5rem)] px-3",
        active
          ? "bg-ax-accent-soft text-ax-accent"
          : "text-ax-secondary hover:bg-ax-surface-hover hover:text-ax-primary",
      )}
      {...triggerProps}
    >
      {active && !rail ? (
        <span
          aria-hidden="true"
          className="absolute start-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-e-full bg-ax-accent"
        />
      ) : null}

      <span className="relative flex shrink-0 items-center justify-center">
        <Icon aria-hidden="true" className="h-5 w-5" />
        {rail && badge ? (
          <span
            aria-hidden="true"
            className={cn(
              "absolute -end-1 -top-1 h-2 w-2 rounded-full ring-2 ring-ax-surface",
              dotToneClasses[tone],
            )}
          />
        ) : null}
      </span>

      {rail ? (
        <span className="sr-only">{label}</span>
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate text-start">{label}</span>
          {badge ? (
            <span
              className={cn(
                "ms-auto flex h-5 min-w-[1.5rem] shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
                badgeToneClasses[tone],
              )}
            >
              <span aria-hidden="true">{formatCount(badge.count)}</span>
              <span className="sr-only">
                {badge.count > 99 ? "more than 99 items" : `${badge.count} items`}
              </span>
            </span>
          ) : null}
        </>
      )}
    </button>
  );

  if (!rail) return button();

  return (
    <NavTooltip label={label} hint={hint}>
      {(triggerProps) => button(triggerProps)}
    </NavTooltip>
  );
}