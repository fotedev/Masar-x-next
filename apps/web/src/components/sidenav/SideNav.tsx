"use client";

import { BookOpen, Globe } from "lucide-react";

import { DynamicLogo } from "@/components/DynamicLogo";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/header/UserMenu";
import { NAV_ICONS } from "./navIcons";

interface NavItem {
  key: string;
  page: string;
  label: string;
  isActive: () => boolean;
}

interface SideNavProps {
  isMounted: boolean;
  /** Expanded shows the MASARX wordmark + link labels; collapsed is icon rail. */
  expanded: boolean;
  /**
   * Logo click — AppNav debounces it (single click = toggle, five rapid
   * clicks = the secret access gate), exactly like the old header logo.
   */
  onLogoActivate: () => void;
  items: readonly NavItem[];
  trwVisible: boolean;
  currentPage: string;
  loading: boolean;
  user: {
    id: string;
    email?: string;
    user_metadata?: { full_name?: string; avatar_url?: string };
  } | null;
  authProfile: { avatarUrl?: string | null } | null;
  isAdmin: boolean;
  isAdminLoading: boolean;
  onNavigate: (page: string) => void;
  onSignOut: () => void;
  tNav: (key: string) => string;
  tMobileNav: (key: string) => string;
}

/**
 * Collapsible side navigation rail (desktop ≥lg) — replaces the top navbar.
 * Collapsed (default, ~64px): mark logo + page icons with tooltips.
 * Expanded (~240px): lockup logo (mark + MASARX) + labels + active pill.
 * RTL: `start-0` anchors the rail to the right in Arabic automatically.
 */
export function SideNav({
  isMounted,
  expanded,
  onLogoActivate,
  items,
  trwVisible,
  currentPage,
  loading,
  user,
  authProfile,
  isAdmin,
  isAdminLoading,
  onNavigate,
  onSignOut,
  tNav,
  tMobileNav,
}: SideNavProps) {
  const itemButtonClass = (active: boolean) =>
    `group flex shrink-0 items-center gap-3 rounded-xl text-sm font-bold transition-colors focus:outline-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b82f6] ${
      expanded ? "w-full px-3 py-2.5" : "h-11 w-11 justify-center"
    } ${
      active
        ? "bg-brand-blue/10 text-brand-blue dark:text-cyan-400"
        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
    }`;

  return (
    <aside
      aria-label={tNav("primaryNavAria")}
      className={`hidden lg:flex fixed inset-y-0 start-0 z-header flex-col overflow-hidden border-e border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-950 transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        expanded ? "w-60" : "w-16"
      }`}
    >
      {/* The logo itself is the expand/collapse toggle (no burger icon). */}
      <div className="flex h-16 shrink-0 items-center justify-center border-b border-slate-200/60 dark:border-slate-800/60">
        <button
          type="button"
          onClick={onLogoActivate}
          aria-expanded={expanded}
          aria-label={expanded ? tNav("collapseSidebar") : tNav("expandSidebar")}
          className="flex h-11 items-center justify-center rounded-xl px-1 hover:bg-slate-100 dark:hover:bg-white/5 focus:outline-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b82f6]"
        >
          {expanded ? (
            <DynamicLogo
              width={116}
              height={40}
              className="object-contain h-9 w-auto"
              priority
            />
          ) : (
            <DynamicLogo
              variant="mark"
              width={32}
              height={32}
              className="object-contain w-8 h-8"
              priority
            />
          )}
        </button>
      </div>

      <nav
        aria-label={tNav("primaryNavAria")}
        className="flex flex-1 min-h-0 flex-col gap-1 overflow-y-auto overflow-x-hidden px-2 py-3 custom-scrollbar"
      >
        {items.map((item) => {
          const active = isMounted && item.isActive();
          const Icon = NAV_ICONS[item.key] ?? BookOpen;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.page)}
              aria-current={active ? "page" : undefined}
              title={expanded ? undefined : item.label}
              aria-label={expanded ? undefined : item.label}
              className={itemButtonClass(active)}
            >
              <Icon className="w-5 h-5 shrink-0" aria-hidden />
              {expanded && <span className="truncate">{item.label}</span>}
              {expanded && active && (
                <span
                  className="ms-auto h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue dark:bg-cyan-400"
                  aria-hidden
                />
              )}
            </button>
          );
        })}

        {trwVisible && (
          <button
            type="button"
            onClick={() => onNavigate("non-academic")}
            aria-current={
              isMounted && currentPage === "non-academic" ? "page" : undefined
            }
            title={expanded ? undefined : tMobileNav("theRealWorld")}
            aria-label={expanded ? undefined : tMobileNav("theRealWorld")}
            className={itemButtonClass(
              isMounted && currentPage === "non-academic",
            )}
          >
            <Globe className="w-5 h-5 shrink-0" aria-hidden />
            {expanded && (
              <span className="truncate">{tMobileNav("theRealWorld")}</span>
            )}
          </button>
        )}
      </nav>

      {/* Controls pinned to the bottom: theme, language, account. */}
      <div className="flex shrink-0 flex-col items-center gap-1 border-t border-slate-200/60 dark:border-slate-800/60 p-2">
        <div
          className={`flex gap-1 ${
            expanded ? "flex-row items-center self-stretch px-1" : "flex-col items-center"
          }`}
        >
          <ThemeToggle />
          <LanguageToggle />
        </div>
        <UserMenu
          isMounted={isMounted}
          loading={loading}
          user={user}
          profile={authProfile}
          isAdmin={isAdmin}
          isAdminLoading={isAdminLoading}
          compact={!expanded}
          handleNavigate={onNavigate}
          handleSignOut={onSignOut}
          tNav={tNav}
        />
      </div>
    </aside>
  );
}
