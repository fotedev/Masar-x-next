"use client";

import { ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Footer } from "./Footer";
import { PWAInstallPrompt } from "./PWAInstallPrompt";
import { NotificationPrompt } from "./NotificationManager";
import { AcademicOnboardingGate } from "./AcademicOnboardingGate";

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

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-brand-navy transition-colors flex flex-col pt-[calc(72px+env(safe-area-inset-top))]">
      <Header />
      <AcademicOnboardingGate />
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 flex-grow w-full relative">
        {isLightRoute ? (
          <div className="w-full">{children}</div>
        ) : (
          <PageTransition pathname={pathname || "/"}>{children}</PageTransition>
        )}
      </main>
      <PWAInstallPrompt />
      <NotificationPrompt />
      <Footer />
    </div>
  );
}
