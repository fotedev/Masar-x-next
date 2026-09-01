"use client";

import { useState, useEffect } from "react";
import { Link } from "@/navigation";
import type { Platform, ReleaseUrls } from "@/lib/github-releases";
import {
  Download,
  Monitor,
  Apple,
  Smartphone,
  ChevronRight,
  X,
} from "lucide-react";

interface DesktopAppBannerClientProps {
  release: ReleaseUrls;
  initialPlatform: Platform;
  locale: string;
  translations: {
    title: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
    allPlatformsCta: string;
    dismiss: string;
  };
}

export function DesktopAppBannerClient({
  release,
  initialPlatform,
  locale,
  translations,
}: DesktopAppBannerClientProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [platform, setPlatform] = useState<Platform>(initialPlatform);

  useEffect(() => {

    // Check if user previously dismissed this version
    const storageKey = `masarx_dismissed_banner_v_${release.version}`;
    if (typeof window !== "undefined") {
      if (localStorage.getItem(storageKey) === "true") {
        setIsDismissed(true);
      }

      // Client-side UA refinement
      const ua = navigator.userAgent || "";
      if (/Android/i.test(ua)) setPlatform("android");
      else if (/iPhone|iPad|iPod/i.test(ua)) setPlatform("other");
      else if (/Windows/i.test(ua)) setPlatform("windows");
      else if (/Mac OS X|macOS/i.test(ua)) setPlatform("macos");
      else if (/Linux/i.test(ua)) setPlatform("other");
    }
  }, [release.version]);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem(`masarx_dismissed_banner_v_${release.version}`, "true");
    }
  };

  if (isDismissed) return null;

  const isWindows = platform === "windows";
  const isMac = platform === "macos";
  const isAndroid = platform === "android";

  const Icon = isWindows
    ? Monitor
    : isMac
      ? Apple
      : isAndroid
        ? Smartphone
        : Download;

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-r from-slate-50 via-white to-brand-blue/5 dark:from-slate-900 dark:via-slate-900/90 dark:to-brand-blue/10 py-3.5 px-4 sm:px-5 mb-6 sm:mb-8 shadow-sm transition-all duration-300"
      dir="auto"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        {/* Left Info: Icon + Title + Version + Subtitle */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                {translations.title}
              </h2>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/60 dark:border-slate-700">
                v{release.version}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-1 mt-0.5">
              {translations.subtitle}
            </p>
          </div>
        </div>

        {/* Right Actions: Primary CTA + Secondary Link + Dismiss Button */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-end sm:self-center">
          {isWindows ? (
            <>
              <a
                href={release.windowsInstaller}
                className="inline-flex items-center justify-center gap-1.5 h-8 sm:h-9 px-3.5 sm:px-4 rounded-xl bg-brand-blue text-white font-bold text-xs sm:text-sm hover:bg-brand-blue/90 active:scale-[0.97] transition-all shadow-sm shadow-brand-blue/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{translations.primaryCta}</span>
              </a>
              <Link
                href="/downloads"
                dir={locale === "ar" ? "rtl" : "ltr"}
                className="group inline-flex items-center justify-center gap-1 h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-brand-blue dark:hover:text-brand-blue hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors"
              >
                <span>{translations.secondaryCta}</span>
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 ${
                    locale === "ar" ? "rotate-180" : ""
                  }`}
                />
              </Link>
            </>
          ) : (
            <Link
              href="/downloads"
              dir={locale === "ar" ? "rtl" : "ltr"}
              className="group inline-flex items-center justify-center gap-1.5 h-8 sm:h-9 px-3.5 sm:px-4 rounded-xl bg-brand-blue text-white font-bold text-xs sm:text-sm hover:bg-brand-blue/90 active:scale-[0.97] transition-all shadow-sm shadow-brand-blue/20"
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{translations.allPlatformsCta}</span>
              <ChevronRight
                className={`w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 ${
                  locale === "ar" ? "rotate-180" : ""
                }`}
              />
            </Link>
          )}

          {/* Dismiss Button */}
          <button
            onClick={handleDismiss}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors shrink-0 ms-1"
            aria-label={translations.dismiss}
            title={translations.dismiss}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}
