"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminTheme } from "@/hooks/admin-shell/useAdminTheme";
import { useAdminShell } from "./AdminShellProvider";
import { AdminCommandPalette } from "./AdminCommandPalette";
import type { AdminTabId } from "@/lib/admin-shell/navigation";

/**
 * AdminTopbar — sticky admin header.
 *
 * Left:  mobile hamburger + breadcrumb (Admin / <current section>); the root
 *        crumb jumps back to the Overview tab.
 * Right: quick-search trigger (Ctrl/Cmd+K opens AdminCommandPalette), theme
 *        toggle, and the signed-in admin pill with an account menu
 *        (view site / sign out).
 *
 * Every control is a >= 44px touch target. The theme icon is CSS-driven via
 * the dark: variant, so there is no hydration mismatch; the ⌘K / Ctrl+K hint
 * resolves after mount for the same reason.
 */
export interface AdminTopbarProps {
  activeTab: AdminTabId;
  sectionLabel: string;
  onSelectTab: (tab: AdminTabId) => void;
  adminRole: string | null | undefined;
  onAddNew?: () => void;
}

export function AdminTopbar({
  activeTab,
  sectionLabel,
  onSelectTab,
  adminRole,
  onAddNew,
}: AdminTopbarProps) {
  const t = useTranslations("adminDashboard");
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { state, actions } = useAdminShell();
  const { theme, toggleTheme } = useAdminTheme();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isApple, setIsApple] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsApple(/Mac|iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);

  // Global Ctrl/Cmd+K toggles the command palette.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Close the account menu on outside pointerdown.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  // Close notifications popover on outside pointerdown.
  useEffect(() => {
    if (!notificationsOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target as Node)
      ) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [notificationsOpen]);

  const isOverview = activeTab === "overview";
  const email = user?.email ?? "";
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) || email;
  const initial = (displayName || "?").trim().charAt(0).toUpperCase();

  const focusRing =
    "focus-visible:ring-2 focus-visible:ring-ax-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface";

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-ax-edge bg-ax-surface px-3 sm:px-4 lg:px-6">
        {/* Masar X logo mark - mobile only, jumps to overview */}
        <button
          type="button"
          onClick={() => onSelectTab("overview")}
          aria-label={t("tabs.overview")}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-md outline-none transition-colors duration-150 hover:bg-ax-surface-hover lg:hidden",
            focusRing,
          )}
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ax-accent text-sm font-bold text-ax-on-accent"
          >
            M
          </span>
        </button>

        <button
          type="button"
          onClick={() => actions.setMobileOpen(true)}
          aria-label={t("shell.openNavigation")}
          aria-controls="ax-mobile-drawer"
          aria-expanded={state.mobileOpen}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ax-secondary outline-none transition-colors duration-150 hover:bg-ax-surface-hover hover:text-ax-primary lg:hidden",
            focusRing,
          )}
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
        </button>

        {/* Breadcrumb */}
        <nav aria-label={t("shell.breadcrumb")} className="min-w-0 flex-1">
          <ol className="flex items-center gap-1.5 text-sm">
            <li className="min-w-0">
              <button
                type="button"
                onClick={() => onSelectTab("overview")}
                aria-current={isOverview ? "page" : undefined}
                className={cn(
                  "truncate rounded-md px-1.5 py-1 font-medium outline-none transition-colors duration-150",
                  isOverview
                    ? "text-ax-primary"
                    : "text-ax-muted hover:text-ax-primary",
                  focusRing,
                )}
              >
                {t("shell.breadcrumbAdmin")}
              </button>
            </li>
            {!isOverview ? (
              <>
                <li aria-hidden="true">
                  <ChevronRight className="h-4 w-4 shrink-0 text-ax-muted rtl:rotate-180" />
                </li>
                <li
                  aria-current="page"
                  className="min-w-0 truncate px-1.5 font-medium text-ax-primary"
                >
                  {sectionLabel}
                </li>
              </>
            ) : null}
          </ol>
        </nav>

        {/* Quick search trigger */}
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label={t("shell.quickSearch")}
          className={cn(
            "hidden h-10 shrink-0 items-center gap-2 rounded-lg border border-ax-edge bg-ax-surface-inset ps-3 pe-2 text-sm text-ax-muted outline-none transition-colors duration-150 hover:border-ax-edge-strong hover:text-ax-secondary md:flex",
            focusRing,
          )}
        >
          <Search aria-hidden="true" className="h-4 w-4" />
          <span className="max-w-[28ch] truncate">
            {t("shell.searchPlaceholder")}
          </span>
          <kbd className="ms-4 rounded border border-ax-edge bg-ax-surface px-1.5 py-0.5 text-[10px] font-semibold text-ax-muted">
            {isApple ? "\u2318K" : "Ctrl K"}
          </kbd>
        </button>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label={t("shell.quickSearch")}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ax-secondary outline-none transition-colors duration-150 hover:bg-ax-surface-hover hover:text-ax-primary md:hidden",
            focusRing,
          )}
        >
          <Search aria-hidden="true" className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={t("shell.toggleTheme")}
          aria-pressed={theme === "dark"}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ax-secondary outline-none transition-colors duration-150 hover:bg-ax-surface-hover hover:text-ax-primary",
            focusRing,
          )}
        >
          <Sun aria-hidden="true" className="hidden h-5 w-5 dark:block" />
          <Moon aria-hidden="true" className="h-5 w-5 dark:hidden" />
        </button>

        {/* Notifications trigger + empty-state popover */}
        <div ref={notificationsRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setNotificationsOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={notificationsOpen}
            aria-label={t("notifications.label")}
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ax-secondary outline-none transition-colors duration-150 hover:bg-ax-surface-hover hover:text-ax-primary",
              focusRing,
            )}
          >
            <Bell aria-hidden="true" className="h-5 w-5" />
          </button>

          {notificationsOpen ? (
            <div
              role="menu"
              aria-label={t("notifications.label")}
              className="absolute end-0 top-full z-popover mt-2 w-64 overflow-hidden rounded-xl border border-ax-edge bg-ax-surface p-4 shadow-ax-lg sm:w-72"
            >
              <div className="flex flex-col items-center justify-center gap-2 py-4 text-center">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-ax-surface-inset text-ax-muted"
                >
                  <Bell className="h-5 w-5" />
                </span>
                <p className="text-sm font-semibold text-ax-primary">
                  {t("notifications.emptyTitle")}
                </p>
                <p className="text-xs text-ax-muted">
                  {t("notifications.emptyHint")}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <span
          aria-hidden="true"
          className="mx-1 hidden h-6 w-px shrink-0 bg-ax-edge sm:block"
        />

        {/* Signed-in admin pill */}
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={cn(
              "flex h-11 items-center gap-2 rounded-full border border-ax-edge bg-ax-surface ps-1 pe-2 outline-none transition-colors duration-150 hover:bg-ax-surface-hover",
              focusRing,
            )}
          >
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ax-accent-soft text-sm font-semibold text-ax-accent"
            >
              {initial}
            </span>
            <span className="hidden max-w-[16ch] truncate text-sm font-medium text-ax-primary lg:block">
              {displayName}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "h-4 w-4 shrink-0 text-ax-muted transition-transform duration-150",
                menuOpen && "rotate-180",
              )}
            />
          </button>

          {menuOpen ? (
            <div
              role="menu"
              aria-label={t("shell.userMenu")}
              className="absolute end-0 top-full z-popover mt-2 w-60 overflow-hidden rounded-xl border border-ax-edge bg-ax-surface shadow-ax-lg"
            >
              <div className="border-b border-ax-edge px-4 py-3">
                <p className="text-xs text-ax-muted">
                  {t("shell.signedInAs")}
                </p>
                <p className="truncate text-sm font-medium text-ax-primary">
                  {email || displayName}
                </p>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  router.push("/");
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ax-secondary outline-none transition-colors duration-150 hover:bg-ax-surface-hover hover:text-ax-primary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ax-accent"
              >
                <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0" />
                {t("shell.viewSite")}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={async () => {
                  setMenuOpen(false);
                  await signOut();
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ax-danger outline-none transition-colors duration-150 hover:bg-ax-danger-soft focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ax-accent"
              >
                <LogOut aria-hidden="true" className="h-4 w-4 shrink-0" />
                {t("shell.signOut")}
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <AdminCommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelectTab={onSelectTab}
        adminRole={adminRole}
        onAddNew={onAddNew}
      />
    </>
  );
}
