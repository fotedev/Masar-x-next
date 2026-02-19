"use client";

import { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { PWAInstallPrompt } from "./PWAInstallPrompt";
import { NotificationPrompt } from "./NotificationManager";
import { AcademicOnboardingGate } from "./AcademicOnboardingGate";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-brand-navy transition-colors flex flex-col">
      <Header />
      <AcademicOnboardingGate />
      <main className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 flex-grow w-full">
        {children}
      </main>
      <PWAInstallPrompt />
      <NotificationPrompt />
      <Footer />
    </div>
  );
}
