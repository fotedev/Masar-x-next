"use client";

import { ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Footer } from "./Footer";
import { PWAInstallPrompt } from "./PWAInstallPrompt";
import { NotificationPrompt } from "./NotificationManager";
import { AcademicOnboardingGate } from "./AcademicOnboardingGate";
import { useIsDesktopRuntime } from "@/lib/desktop/useIsDesktopRuntime";

interface LayoutProps {
  children: ReactNode;
}

const AppNav = dynamic(
  () => import("./sidenav/AppNav").then((mod) => mod.AppNav),
  { ssr: false },
);

// SPLIT-1 (perf audit 2026-11-02): no `ssr: false` — with it, server HTML
// ships an empty <main> on every non-light route (LCP waits for full
// hydration + client fetch; the SSR'd footer shifts = measured CLS 0.89).
// The dynamic import still code-splits framer-motion; it just SSRs now.
const PageTransition = dynamic(() =>
  import("./PageTransition").then((m) => m.PageTransition),
);

export function Layout({ children }: LayoutProps) {
  const pathname = usePathname();
  const localeMatch = pathname?.match(/^\/(ar|en)(\/|$)/);
  const localePrefix = localeMatch ? `/${localeMatch[1]}` : "";
  const pathWithoutLocale = localePrefix
    ? pathname?.slice(localePrefix.length) || "/"
    : pathname || "/";

  const isLightRoute =
    pathWithoutLocale === "/" ||
    pathWithoutLocale === "/privacy" ||
    pathWithoutLocale === "/privacy-policy" ||
    pathWithoutLocale === "/privacy-details" ||
    pathWithoutLocale === "/faq" ||
    pathWithoutLocale === "/login" ||
    pathWithoutLocale === "/signup" ||
    pathWithoutLocale === "/reset-password";

  // Admin surface isolation: every /[locale]/admin* route renders inside its
  // own full-screen shell. The public marketing Header, the Footer, the PWA +
  // notification prompts, the onboarding gate and the padded max-w-7xl <main>
  // are all skipped so the admin shell owns the viewport edge-to-edge.
  const isAdminRoute =
    pathWithoutLocale === "/admin" ||
    pathWithoutLocale.startsWith("/admin/") ||
    pathWithoutLocale === "/admin-dashboard" ||
    pathWithoutLocale.startsWith("/admin-dashboard/");

  // AI assistant route isolation: /ai-assistant (and any nested paths) must
  // render as a fixed-viewport chat app — no marketing footer, no overscroll.
  // The startsWith guard covers trailing-slash variants and future sub-routes.
  const isAssistantRoute =
    pathWithoutLocale === "/ai-assistant" ||
    pathWithoutLocale.startsWith("/ai-assistant/");

  // Spec 005 / US2 / T024 — FR-019: web-only chrome surfaces are skipped
  // when the desktop shell is active. The desktop app does not have a
  // marketing footer, no "install as PWA" prompt (it IS installed), and
  // no web-push opt-in (notifications use the Electron update channel).
  //
  // useIsDesktopRuntime is hydration-safe: false on the server and on
  // the first client paint, then flips post-mount. By gating AFTER the
  // rest of the chrome is committed we guarantee that the SSR HTML
  // matches the browser's first paint byte-for-byte (FR-011); the
  // web-only surfaces disappear one frame later, which is invisible
  // inside the Electron window because the shell renders the page only
  // after JS has finished loading.
  const isDesktop = useIsDesktopRuntime();

  // Desktop shell (spec 005 US2/US3): CustomTitlebar owns the chrome, so
  // the web nav shell (side rail + mobile top bar) is skipped the same
  // way Footer / PWA / NotificationPrompt already are. Hydration-safe:
  // isDesktop is false on SSR + first paint, so the first HTML matches
  // the browser; the chrome disappears one frame later inside Electron.
  // Padding drops from the 56px web top bar to the 32px titlebar so the
  // three-column workspace can fill the remaining viewport (FR-017).
  //
  // Web nav (owner decision 2026-11-05): collapsible side rail on ≥lg.
  // The rail width is shared through --sidenav-w (set by AppNav), so the
  // content push animates in lockstep with the rail; below lg a slim
  // fixed top bar (56px) takes its place.
  return (
    <div
      className={
        isDesktop
          ? "flex h-screen w-screen flex-col overflow-hidden bg-background pt-8"
          : isAdminRoute
            ? "h-dvh w-full overflow-hidden bg-gray-50 dark:bg-gray-900"
            : isAssistantRoute
              ? "h-dvh bg-slate-50 dark:bg-brand-navy flex flex-col overflow-hidden pt-[calc(56px+env(safe-area-inset-top))] lg:pt-0 lg:ps-[var(--sidenav-w,4rem)] transition-[padding,background-color] duration-300"
              : "min-h-dvh bg-slate-50 dark:bg-brand-navy flex flex-col pt-[calc(56px+env(safe-area-inset-top))] lg:pt-0 lg:ps-[var(--sidenav-w,4rem)] transition-[padding,background-color] duration-300"
      }
    >
      {!isDesktop && !isAdminRoute && <AppNav />}
      {!isAdminRoute && <AcademicOnboardingGate />}
      <main
        className={
          isDesktop
            ? "relative flex min-h-0 w-full flex-1 flex-col overflow-hidden pe-4"
            : isAdminRoute
              ? "h-full w-full min-h-0"
              : isAssistantRoute
                ? "relative flex min-h-0 w-full flex-1 flex-col overflow-hidden"
                : "max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 grow w-full relative"
        }
      >
        {/* NOTE: the assistant route must keep rendering through PageTransition
            (ssr:false). Rendering its children in a plain div makes Next 16
            evaluate the "use client" page in the RSC layer during SSR, which
            crashes on useRouter ("not supported in Server Components").
            PageTransition's own root is already a full-height flex column, so
            the chat page's flex chain is preserved without the bypass. */}
        {/* NOTE (spec 032, SPLIT-1): PageTransition now renders server-side.
            The 2026-09-16 "useRouter is not supported in Server Components"
            crash on /ai-assistant no longer reproduces at Next 16.4.1 — the
            cold-repro experiment (2026-11-03, spec 032) rendered this page's
            children in a plain div (the exact 28b8fc5 state) without the
            crash, with /login + /privacy-policy as controls, and five other
            "use client" + useRouter pages already SSR through the same plain
            div daily. Shipping an empty <main> on ~30 routes (both measured
            LCP outliers + the 4-route footer CLS) for one stale crash was
            the worse trade. If a useRouter-RSC crash ever resurfaces, re-run
            the cold experiment before re-adding ssr:false. */}
        {isLightRoute || isAdminRoute ? (
          <div className="w-full h-full min-h-0">{children}</div>
        ) : (
          <PageTransition pathname={pathname || "/"}>{children}</PageTransition>
        )}
      </main>
      {/* T024 gate: every block below belongs to the web experience
          and must not leak into the Electron shell (FR-019, FR-011). */}
      {!isDesktop && !isAdminRoute && <PWAInstallPrompt />}
      {!isDesktop && !isAdminRoute && <NotificationPrompt />}
      {!isDesktop && !isAdminRoute && !isAssistantRoute && <Footer />}
    </div>
  );
}
