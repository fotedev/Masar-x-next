"use client";

import {
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Languages,
  LogOut,
  Moon,
  Sun,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { adminNavGroups, type AdminTabId } from "@/lib/admin-shell/navigation";
import { usePathname, useRouter } from "@/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminTheme } from "@/hooks/admin-shell/useAdminTheme";
import { useAdminShell } from "./AdminShellProvider";
import { AdminSidebarGroup } from "./SidebarGroup";
import type { AdminSidebarBadge } from "./AdminSidebarItem";
import { NavTooltip } from "./NavTooltip";

/**
 * Sidebar — the admin navigation rail.
 *
 * desktop variant (default): fixed inline-start column, visible from lg up.
 *   expanded -> 264px (labels + badges)
 *   collapsed -> 72px icon rail (sr-only labels + floating tooltips)
 * mobile variant: rendered inside MobileNav; always expanded, includes a
 *   close button; selecting an entry closes the drawer.
 *
 * Bottom utilities (desktop only):
 *   Profile pill, language switch (AR/EN), theme toggle, back to portal,
 *   sign out, and sidebar collapse button.
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

export function Sidebar({
  variant = "desktop",
  activeTab,
  onSelectTab,
  adminRole,
  badges,
}: AdminSidebarProps) {
  const t = useTranslations("adminDashboard");
  const { state, actions } = useAdminShell();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useAdminTheme();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  const isMobile = variant === "mobile";
  const rail = !isMobile && state.collapsed;
  const isDoctor = adminRole === "doctor";

  const nextLocale = locale === "ar" ? "en" : "ar";
  const email = user?.email ?? "";
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) || email;
  const initial = (displayName || "?").trim().charAt(0).toUpperCase();

  const roleLabel =
    adminRole === "doctor"
      ? t("shell.roleDoctor")
      : adminRole === "student_admin"
        ? t("shell.roleStudentAdmin")
        : t("shell.roleAdmin");

  const focusRing =
    "focus-visible:ring-2 focus-visible:ring-ax-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface";

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
        !isMobile &&
          state.hydrated &&
          "transition-[width] duration-ax-base ease-ax-standard",
        widthClass,
      )}
    >
      {/* Brand header */}
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
            className={cn(
              "ms-auto flex h-11 w-11 items-center justify-center rounded-md text-ax-secondary outline-none transition-colors duration-150 hover:bg-ax-surface-hover hover:text-ax-primary",
              focusRing,
            )}
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      {/* Main navigation links */}
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

      {/* Bottom utilities (hidden on mobile drawer — topbar owns mobile profile/actions) */}
      {!isMobile ? (
        <div
          className={cn(
            "shrink-0 border-t border-ax-edge p-2 space-y-1",
            rail && "flex flex-col items-center gap-1 space-y-0",
          )}
        >
          {rail ? (
            <>
              {/* Rail: Profile initial with tooltip */}
              <NavTooltip label={displayName} hint={roleLabel}>
                {(triggerProps) => (
                  <div
                    tabIndex={0}
                    aria-label={`${displayName} (${roleLabel})`}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-md outline-none",
                      focusRing,
                    )}
                    {...triggerProps}
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ax-accent-soft text-xs font-bold text-ax-accent"
                    >
                      {initial}
                    </span>
                    <span className="sr-only">
                      {displayName} ({roleLabel})
                    </span>
                  </div>
                )}
              </NavTooltip>

              {/* Rail: Language toggle */}
              <NavTooltip
                label={t("shell.language")}
                hint={locale === "ar" ? "EN" : "AR"}
              >
                {(triggerProps) => (
                  <button
                    type="button"
                    onClick={() =>
                      router.replace(pathname, { locale: nextLocale })
                    }
                    aria-label={t("shell.language")}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-md text-ax-secondary outline-none transition-colors duration-150 hover:bg-ax-surface-hover hover:text-ax-primary",
                      focusRing,
                    )}
                    {...triggerProps}
                  >
                    <Languages aria-hidden="true" className="h-5 w-5" />
                    <span className="sr-only">{t("shell.language")}</span>
                  </button>
                )}
              </NavTooltip>

              {/* Rail: Theme toggle */}
              <NavTooltip label={t("shell.toggleTheme")}>
                {(triggerProps) => (
                  <button
                    type="button"
                    onClick={toggleTheme}
                    aria-label={t("shell.toggleTheme")}
                    aria-pressed={theme === "dark"}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-md text-ax-secondary outline-none transition-colors duration-150 hover:bg-ax-surface-hover hover:text-ax-primary",
                      focusRing,
                    )}
                    {...triggerProps}
                  >
                    <Sun aria-hidden="true" className="hidden h-5 w-5 dark:block" />
                    <Moon aria-hidden="true" className="h-5 w-5 dark:hidden" />
                    <span className="sr-only">{t("shell.toggleTheme")}</span>
                  </button>
                )}
              </NavTooltip>

              {/* Rail: Back to portal */}
              <NavTooltip label={t("shell.viewSite")}>
                {(triggerProps) => (
                  <button
                    type="button"
                    onClick={() => router.push("/")}
                    aria-label={t("shell.viewSite")}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-md text-ax-secondary outline-none transition-colors duration-150 hover:bg-ax-surface-hover hover:text-ax-primary",
                      focusRing,
                    )}
                    {...triggerProps}
                  >
                    <ExternalLink aria-hidden="true" className="h-5 w-5" />
                    <span className="sr-only">{t("shell.viewSite")}</span>
                  </button>
                )}
              </NavTooltip>

              {/* Rail: Sign out */}
              <NavTooltip label={t("shell.signOut")}>
                {(triggerProps) => (
                  <button
                    type="button"
                    onClick={async () => {
                      await signOut();
                    }}
                    aria-label={t("shell.signOut")}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-md text-ax-danger outline-none transition-colors duration-150 hover:bg-ax-danger-soft",
                      focusRing,
                    )}
                    {...triggerProps}
                  >
                    <LogOut aria-hidden="true" className="h-5 w-5" />
                    <span className="sr-only">{t("shell.signOut")}</span>
                  </button>
                )}
              </NavTooltip>
            </>
          ) : (
            <>
              {/* Expanded: Profile row */}
              <div className="mx-1 flex h-11 w-[calc(100%-0.5rem)] items-center gap-3 rounded-md px-3">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ax-accent-soft text-xs font-bold text-ax-accent"
                >
                  {initial}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-ax-primary">
                    {displayName}
                  </p>
                  <p className="truncate text-[11px] text-ax-muted">
                    {roleLabel}
                  </p>
                </div>
              </div>

              {/* Expanded: Language switch */}
              <button
                type="button"
                onClick={() => router.replace(pathname, { locale: nextLocale })}
                aria-label={t("shell.language")}
                className={cn(
                  "group mx-1 flex h-11 w-[calc(100%-0.5rem)] items-center gap-3 rounded-md px-3 text-sm font-medium text-ax-secondary outline-none transition-colors duration-150 ease-ax-standard hover:bg-ax-surface-hover hover:text-ax-primary",
                  focusRing,
                )}
              >
                <Languages aria-hidden="true" className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-start">
                  {t("shell.language")}
                </span>
                <span className="ms-auto flex h-5 items-center justify-center rounded bg-ax-surface-inset px-1.5 text-xs font-semibold uppercase text-ax-muted">
                  {locale === "ar" ? "EN" : "AR"}
                </span>
              </button>

              {/* Expanded: Theme toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={t("shell.toggleTheme")}
                aria-pressed={theme === "dark"}
                className={cn(
                  "group mx-1 flex h-11 w-[calc(100%-0.5rem)] items-center gap-3 rounded-md px-3 text-sm font-medium text-ax-secondary outline-none transition-colors duration-150 ease-ax-standard hover:bg-ax-surface-hover hover:text-ax-primary",
                  focusRing,
                )}
              >
                <span className="relative flex shrink-0 items-center justify-center">
                  <Sun aria-hidden="true" className="hidden h-5 w-5 dark:block" />
                  <Moon aria-hidden="true" className="h-5 w-5 dark:hidden" />
                </span>
                <span className="min-w-0 flex-1 truncate text-start">
                  {t("shell.toggleTheme")}
                </span>
              </button>

              {/* Expanded: Back to portal */}
              <button
                type="button"
                onClick={() => router.push("/")}
                className={cn(
                  "group mx-1 flex h-11 w-[calc(100%-0.5rem)] items-center gap-3 rounded-md px-3 text-sm font-medium text-ax-secondary outline-none transition-colors duration-150 ease-ax-standard hover:bg-ax-surface-hover hover:text-ax-primary",
                  focusRing,
                )}
              >
                <ExternalLink aria-hidden="true" className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-start">
                  {t("shell.viewSite")}
                </span>
              </button>

              {/* Expanded: Sign out */}
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                }}
                className={cn(
                  "group mx-1 flex h-11 w-[calc(100%-0.5rem)] items-center gap-3 rounded-md px-3 text-sm font-medium text-ax-danger outline-none transition-colors duration-150 ease-ax-standard hover:bg-ax-danger-soft",
                  focusRing,
                )}
              >
                <LogOut aria-hidden="true" className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-start">
                  {t("shell.signOut")}
                </span>
              </button>
            </>
          )}

          {/* Collapse toggle (always the last element) */}
          <button
            type="button"
            onClick={actions.toggleCollapsed}
            aria-label={
              rail ? t("shell.expandSidebar") : t("shell.collapseSidebar")
            }
            className={cn(
              "flex h-11 items-center justify-center gap-2 rounded-md text-xs font-medium text-ax-secondary outline-none",
              "transition-colors duration-150 hover:bg-ax-surface-hover hover:text-ax-primary",
              focusRing,
              rail ? "w-11" : "mx-1 w-[calc(100%-0.5rem)]",
            )}
          >
            {rail ? (
              <ChevronsRight
                aria-hidden="true"
                className="h-4 w-4 rtl:rotate-180"
              />
            ) : (
              <>
                <ChevronsLeft
                  aria-hidden="true"
                  className="h-4 w-4 rtl:rotate-180"
                />
                <span>{t("shell.collapseSidebar")}</span>
              </>
            )}
          </button>
        </div>
      ) : null}
    </aside>
  );
}