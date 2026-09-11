"use client";

import { ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { adminNavGroups, type AdminTabId } from "@/lib/admin-shell/navigation";
import { useAdminShell } from "./AdminShellProvider";
import { AdminSidebarGroup } from "./SidebarGroup";
import type { AdminSidebarBadge } from "./AdminSidebarItem";

/**
 * AdminSidebar — the admin navigation rail.
 *
 * desktop variant (default): fixed inline-start column, visible from lg up.
 *   expanded -> 264px (labels + badges)
 *   collapsed -> 72px icon rail (sr-only labels + floating tooltips)
 * mobile variant: rendered inside MobileDrawer; always expanded, includes a
 *   close button; selecting an entry closes the drawer.
 *
 * Width transitions ~200ms and only after hydration (no first-paint flash).
 * Uses logical properties (start-0, border-e, ps-*) so RTL is correct by
 * construction — Masar X serves Arabic as the default locale.
 */

export interface AdminSidebarProps {
  variant?: "desktop" | "mobile";
  activeTab: AdminTabId;
  onSelectTab: (id: AdminTabId) => void;
  adminRole: string | null | undefined;
  badges?: Partial<Record<AdminTabId, AdminSidebarBadge>>;
}

export function AdminSidebar({
  variant = "desktop",
  activeTab,
  onSelectTab,
  adminRole,
  badges,
}: AdminSidebarProps) {
  const t = useTranslations("adminDashboard");
  const { state, actions } = useAdminShell();
  const isMobile = variant === "mobile";
  const rail = !isMobile && state.collapsed;
  const isDoctor = adminRole === "doctor";

  const labelFor = (id: AdminTabId): string => {
    for (const group of adminNavGroups) {
      const item = group.items.find((candidate) => candidate.id === id);
      if (item) return t(item.labelKey);
    }
    return id;
  };

  const handleSelect = (id: AdminTabId) => {
    onSelectTab(id);
    if (isMobile) actions.setMobileOpen(false);
  };

  const widthClass = isMobile
    ? "w-full"
    : cn("hidden lg:flex", rail ? "w-ax-sidebar-collapsed" : "w-ax-sidebar");

  return (
    <aside
      aria-label={t("shell.sidebarLabel")}
      className={cn(
        "flex h-full flex-col border-e border-ax-edge bg-ax-surface",
        !isMobile && "relative z-40 shrink-0",
        !isMobile && state.hydrated && "transition-[width] duration-ax-base ease-ax-standard",
        widthClass,
      )}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-ax-edge",
          rail ? "justify-center px-2" : "gap-3 px-4",
        )}
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ax-accent text-sm font-bold text-ax-on-accent"
        >
          M
        </span>
        {!rail ? (
          <span className="truncate text-sm font-semibold tracking-tight text-ax-primary">
            {t("title")}
          </span>
        ) : null}
        {isMobile ? (
          <button
            type="button"
            onClick={() => actions.setMobileOpen(false)}
            aria-label={t("shell.closeNavigation")}
            className="ms-auto flex h-11 w-11 items-center justify-center rounded-md text-ax-secondary outline-none transition-colors duration-150 hover:bg-ax-surface-hover hover:text-ax-primary focus-visible:ring-2 focus-visible:ring-ax-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <nav
        aria-label={t("shell.mainNavigation")}
        className="flex-1 overflow-y-auto overflow-x-hidden p-2"
      >
        <ul className={cn(rail ? "space-y-2" : "space-y-4")}>
          {adminNavGroups.map((group) => (
            <AdminSidebarGroup
              key={group.id}
              group={group}
              groupLabel={t(group.labelKey)}
              activeTab={activeTab}
              onSelectTab={handleSelect}
              rail={rail}
              isDoctor={isDoctor}
              labelFor={labelFor}
              badges={badges}
            />
          ))}
        </ul>
      </nav>

      {!isMobile ? (
        <div
          className={cn(
            "shrink-0 border-t border-ax-edge p-2",
            rail && "flex flex-col items-center",
          )}
        >
          <button
            type="button"
            onClick={actions.toggleCollapsed}
            aria-label={rail ? t("shell.expandSidebar") : t("shell.collapseSidebar")}
            className={cn(
              "flex h-11 items-center justify-center gap-2 rounded-md text-xs font-medium text-ax-secondary outline-none",
              "transition-colors duration-150 hover:bg-ax-surface-hover hover:text-ax-primary",
              "focus-visible:ring-2 focus-visible:ring-ax-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface",
              rail ? "w-11" : "w-full",
            )}
          >
            {rail ? (
              <ChevronsRight aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
            ) : (
              <>
                <ChevronsLeft aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
                <span>{t("shell.collapseSidebar")}</span>
              </>
            )}
          </button>
        </div>
      ) : null}
    </aside>
  );
}