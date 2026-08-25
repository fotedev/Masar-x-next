import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Link } from "@/navigation";
import {
  detectPlatform,
  formatBytes,
  getLatestReleaseUrls,
  type Platform,
  type ReleaseUrls,
} from "@/lib/github-releases";
import {
  Download,
  Monitor,
  Apple,
  Smartphone,
  ChevronRight,
} from "lucide-react";

/**
 * Server-rendered "Download the desktop app" banner.
 *
 * Fetches the real release URLs from GitHub (cached 1h) and
 * adapts the CTA based on the visitor's User-Agent. If the
 * release fetch fails, the banner silently renders nothing
 * rather than showing a broken link — the /downloads page has
 * its own error UI for that case.
 */
export async function DesktopAppBanner({ locale }: { locale: string }) {
  const t = await getTranslations("downloads");

  const [ua, release] = await Promise.all([
    headers().then((h) => h.get("user-agent")),
    getLatestReleaseUrls().catch<ReleaseUrls | null>(() => null),
  ]);

  if (!release) return null;

  const platform: Platform = detectPlatform(ua);
  const isWindows = platform === "windows";
  const isMac = platform === "macos";
  const isAndroid = platform === "android";

  // Pick the headline icon based on detected platform.
  const Icon = isWindows
    ? Monitor
    : isMac
      ? Apple
      : isAndroid
        ? Smartphone
        : Download;

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-gradient-to-br from-slate-50 via-white to-brand-blue/5 dark:from-slate-900 dark:via-slate-900 dark:to-brand-blue/10 p-5 sm:p-6"
      dir="auto"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-brand-blue/10 text-brand-blue flex items-center justify-center flex-shrink-0">
            <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                {t("hero.title")}
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                v{release.version}
              </span>
              {release.installerSizeBytes ? (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  · {formatBytes(release.installerSizeBytes)}
                </span>
              ) : null}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium mt-0.5">
              {t("hero.subtitle")}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-shrink-0">
          {isWindows ? (
            <>
              <a
                href={release.windowsInstaller}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg bg-brand-blue text-white font-bold text-sm hover:bg-brand-blue/90 active:scale-[0.97] transition-all shadow-sm shadow-brand-blue/20"
              >
                <Download className="w-4 h-4" />
                <span>{t("hero.primaryCta")}</span>
              </a>
              <Link
                href="/downloads"
                className="inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-brand-blue dark:hover:text-brand-blue transition-colors"
              >
                <span>{t("hero.secondaryCta")}</span>
                <ChevronRight
                  className={`w-4 h-4 ${locale === "ar" ? "rotate-180" : ""}`}
                />
              </Link>
            </>
          ) : (
            <Link
              href="/downloads"
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg bg-brand-blue text-white font-bold text-sm hover:bg-brand-blue/90 active:scale-[0.97] transition-all shadow-sm shadow-brand-blue/20"
            >
              <span>{t("hero.secondaryCta")}</span>
              <ChevronRight
                className={`w-4 h-4 ${locale === "ar" ? "rotate-180" : ""}`}
              />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
