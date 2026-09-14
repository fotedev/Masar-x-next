"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { AdminTabId } from "@/lib/admin-shell/navigation";
import { AdminShellProvider, useAdminShell } from "./AdminShellProvider";
import { Sidebar } from "./Sidebar";
import { AdminTopbar } from "./AdminTopbar";
import { MobileNav } from "./MobileNav";
import { SkipLink } from "./SkipLink";
import type { AdminSidebarBadge } from "./AdminSidebarItem";

/**
 * AdminLayout - composition root for the admin experience.
 *
 *   <div class="flex h-full w-full overflow-hidden">   <- owns the viewport
 *     <SkipLink />                                     first focusable
 *     <Sidebar />                                 in-flow column (lg+)
 *     <MobileNav><Sidebar variant="mobile" /></MobileNav>
 *     <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
 *       <AdminTopbar />
 *       <main class="flex-1 overflow-y-auto">{children}</main>
 *     </div>
 *   </div>
 *
 * Layout contract with components/Layout.tsx: for any /admin* route that file
 * renders a bare <div class="h-dvh w-full overflow-hidden"> with NO public
 * Header, Footer, PWA prompt, notification prompt or max-width padding. This
 * shell therefore fills 100% of that box and is the only scroll container.
 *
 * Accessibility: the sidebar is a landmark with an accessible name, the drawer
 * is role="dialog" aria-modal with a focus trap, and <main id="ax-main-content">
 * is the skip-link target.
 *
 * NOTE: renders *inside* the server-side auth/role guard in
 * app/[locale]/admin-dashboard/layout.tsx, which is intentionally unchanged.
 */

export interface AdminLayoutProps {
  activeTab: AdminTabId;
  onSelectTab: (id: AdminTabId) => void;
  adminRole: string | null | undefined;
  sectionLabel: string;
  badges?: Partial<Record<AdminTabId, AdminSidebarBadge>>;
  /** Opens the "create announcement" modal (exposed in the palette). */
  onAddNew?: () => void;
  children: ReactNode;
}

export function AdminLayout(props: AdminLayoutProps) {
  return (
    <AdminShellProvider>
      <AdminShellChrome {...props} />
    </AdminShellProvider>
  );
}

function AdminShellChrome({
  activeTab,
  onSelectTab,
  adminRole,
  sectionLabel,
  badges,
  onAddNew,
  children,
}: AdminLayoutProps) {
  const t = useTranslations("adminDashboard");
  const { state, actions } = useAdminShell();

  // If the viewport grows to desktop while the drawer is open, close it so the
  // persistent sidebar takes over cleanly.
  useEffect(() => {
    if (!state.mobileOpen) return;
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mql.matches) actions.setMobileOpen(false);
    };
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [state.mobileOpen, actions]);

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-ax-canvas text-ax-primary">
      <SkipLink label={t("shell.skipToContent")} />

      <Sidebar
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        adminRole={adminRole}
        badges={badges}
      />

      <MobileNav
        open={state.mobileOpen}
        onClose={() => actions.setMobileOpen(false)}
        label={t("shell.navigation")}
      >
        <Sidebar
          variant="mobile"
          activeTab={activeTab}
          onSelectTab={onSelectTab}
          adminRole={adminRole}
          badges={badges}
        />
      </MobileNav>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdminTopbar
          activeTab={activeTab}
          sectionLabel={sectionLabel}
          onSelectTab={onSelectTab}
          adminRole={adminRole}
          onAddNew={onAddNew}
        />
        <main
          id="ax-main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ax-accent sm:p-6"
        >
          <div className="ax-content-fade">{children}</div>
        </main>
      </div>
    </div>
  );
}
