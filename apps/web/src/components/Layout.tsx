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

const Header = dynamic(() => import("./Header").then((mod) => mod.Header), {
  ssr: false,
  loading: () => (
    <div className="h-[72px] w-full bg-transparent fixed top-0 inset-x-0 z-50 border-b border-transparent transition-colors duration-300" />
  ),
});

const PageTransition = dynamic(
  () => import("./PageTransition").then((m) => m.PageTransition),
  { ssr: false },
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
  // the web Header (logo + marketing nav + login) is skipped the same
  // way Footer / PWA / NotificationPrompt already are. Hydration-safe:
  // isDesktop is false on SSR + first paint, so the first HTML matches
  // the browser; the header disappears one frame later inside Electron.
  // Padding drops from the 72px web header to the 32px titlebar so the
  // three-column workspace can fill the remaining viewport (FR-017).
  return (
    <div
      className={
        isDesktop
          ? "flex h-screen w-screen flex-col overflow-hidden bg-background pt-8"
          : "min-h-dvh bg-slate-50 dark:bg-brand-navy transition-colors flex flex-col pt-[calc(72px+env(safe-area-inset-top))]"
      }
    >
      {!isDesktop && <Header />}
      <AcademicOnboardingGate />
      <main
        className={
          isDesktop
            ? "relative flex min-h-0 w-full flex-1 flex-col overflow-hidden"
            : "max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 flex-grow w-full relative"
        }
      >
        {isLightRoute ? (
          <div className="w-full h-full min-h-0">{children}</div>
        ) : (
          <PageTransition pathname={pathname || "/"}>{children}</PageTransition>
        )}
      </main>
      {/* T024 gate: every block below belongs to the web experience
          and must not leak into the Electron shell (FR-019, FR-011). */}
      {!isDesktop && <PWAInstallPrompt />}
      {!isDesktop && <NotificationPrompt />}
      {!isDesktop && <Footer />}
    </div>
  );
}
