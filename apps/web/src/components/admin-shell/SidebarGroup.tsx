"use client";

import { useEffect, useId } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminNavGroup, AdminTabId } from "@/lib/admin-shell/navigation";
import { useAdminShell } from "./AdminShellProvider";
import { AdminSidebarItem, type AdminSidebarBadge } from "./AdminSidebarItem";

/**
 * AdminSidebarGroup — one collapsible admin navigation section.
 *
 * - Header is a <button> with aria-expanded + aria-controls (list id).
 * - Collapse uses the CSS grid-rows 0fr -> 1fr technique (.ax-collapse-grid),
 *   so there is no JS height measuring and no layout jank.
 * - The chevron rotates 180deg (.ax-chevron, 150ms, transform only).
 * - Auto-expands when the active view lives inside the group (effect-driven,
 *   never a render-time mutation).
 * - doctorOnly entries are filtered out for non-doctor admins, mirroring the
 *   legacy AdminDashboardTabs role gate.
 */

export interface AdminSidebarGroupProps {
  group: AdminNavGroup;
  groupLabel: string;
  activeTab: AdminTabId;
  onSelectTab: (id: AdminTabId) => void;
  rail: boolean;
  isDoctor: boolean;
  labelFor: (id: AdminTabId) => string;
  badges?: Partial<Record<AdminTabId, AdminSidebarBadge>>;
}

export function AdminSidebarGroup({
  group,
  groupLabel,
  activeTab,
  onSelectTab,
  rail,
  isDoctor,
  labelFor,
  badges,
}: AdminSidebarGroupProps) {
  const { state, actions } = useAdminShell();
  const t = useTranslations("adminDashboard");
  const panelId = useId();

  const items = group.items.filter((item) => !item.doctorOnly || isDoctor);
  const open = state.expandedGroups.includes(group.id);
  const containsActive = items.some((item) => item.id === activeTab);

  useEffect(() => {
    if (containsActive && !open) actions.openGroup(group.id);
  }, [containsActive, open, actions, group.id]);

  if (items.length === 0) return null;

  if (rail) {
    return (
      <li className="border-t border-ax-edge pt-2 first:border-t-0 first:pt-0">
        <span className="sr-only">{groupLabel}</span>
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              <AdminSidebarItem
                id={item.id}
                label={labelFor(item.id)}
                icon={item.icon}
                active={activeTab === item.id}
                rail
                badge={badges?.[item.id]}
                disabled={item.disabled}
                soonLabel={item.soonLabelKey ? t(item.soonLabelKey) : undefined}
                onSelect={onSelectTab}
              />
            </li>
          ))}
        </ul>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => actions.toggleGroup(group.id)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md px-3 text-start",
          "text-[11px] font-semibold uppercase tracking-wider text-ax-muted outline-none",
          "transition-colors duration-150 hover:text-ax-secondary",
          "focus-visible:ring-2 focus-visible:ring-ax-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface",
        )}
      >
        <span className="truncate">{groupLabel}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn("ax-chevron h-4 w-4 shrink-0", open && "rotate-180")}
        />
      </button>

      <div id={panelId} className="ax-collapse-grid" data-open={open}>
        <ul className="space-y-0.5 pt-0.5">
          {items.map((item) => (
            <li key={item.id}>
              <AdminSidebarItem
                id={item.id}
                label={labelFor(item.id)}
                icon={item.icon}
                active={activeTab === item.id}
                rail={false}
                badge={badges?.[item.id]}
                disabled={item.disabled}
                soonLabel={item.soonLabelKey ? t(item.soonLabelKey) : undefined}
                onSelect={onSelectTab}
              />
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}