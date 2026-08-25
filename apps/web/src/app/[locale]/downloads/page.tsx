import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  Download,
  Monitor,
  Apple,
  Smartphone,
  Check,
  Clock,
  HardDrive,
  Bell,
  Wifi,
  RefreshCw,
  AppWindow,
} from "lucide-react";
import { DOWNLOAD_URLS, detectPlatform, type Platform } from "@/lib/github-releases";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "downloads" });
  return {
    title: t("meta.title"),
    description: t("meta.description"),
  };
}

export default async function DownloadsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("downloads");

  // Server-side platform detection. UA may be absent for crawlers
  // (Googlebot etc.) — fall back to "other" so the page still renders.
  const hdrs = await headers();
  const platform: Platform = detectPlatform(hdrs.get("user-agent"));

  return (
    <div className="space-y-10 pb-12" dir="auto">
      {/* ───── Hero ───── */}
      <section className="modern-card p-6 sm:p-10 text-center bg-gradient-to-br from-brand-blue/5 via-transparent to-purple-500/5">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-blue/10 px-3 py-1 text-xs font-bold text-brand-blue mb-4">
          <AppWindow className="w-3.5 h-3.5" />
          <span>{t("hero.badge")}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {t("hero.title")}
        </h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 dark:text-slate-400 font-medium max-w-2xl mx-auto">
          {t("hero.subtitle")}
        </p>

        {/* Smart CTA — adapts copy to the visitor's platform */}
        {platform === "windows" ? (
          <a
            href={DOWNLOAD_URLS.windowsInstaller}
            className="mt-6 inline-flex items-center gap-2 h-12 px-6 sm:px-8 rounded-lg bg-brand-blue text-white font-bold text-base hover:bg-brand-blue/90 active:scale-[0.97] transition-all shadow-lg shadow-brand-blue/20"
          >
            <Download className="w-5 h-5" />
            <span>{t("hero.primaryCta")}</span>
          </a>
        ) : (
          <a
            href={`/${locale}/downloads#platforms`}
            className="mt-6 inline-flex items-center gap-2 h-12 px-6 sm:px-8 rounded-lg bg-brand-blue text-white font-bold text-base hover:bg-brand-blue/90 active:scale-[0.97] transition-all shadow-lg shadow-brand-blue/20"
          >
            <span>{t("hero.secondaryCta")}</span>
          </a>
        )}
      </section>

      {/* ───── Platform grid ───── */}
      <section id="platforms" className="space-y-4 scroll-mt-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <WindowsCard
            installerLabel={t("platforms.windows.installerLabel")}
            installerHint={t("platforms.windows.installerHint")}
            portableLabel={t("platforms.windows.portableLabel")}
            portableHint={t("platforms.windows.portableHint")}
            version={t("platforms.windows.version")}
            size={t("platforms.windows.size")}
            status={t("platforms.windows.status")}
          />
          <ComingSoonCard
            icon={<Apple className="w-7 h-7" />}
            name={t("platforms.macos.name")}
            status={t("platforms.macos.status")}
            cta={t("platforms.macos.notifyLabel")}
          />
          <ComingSoonCard
            icon={<Smartphone className="w-7 h-7" />}
            name={t("platforms.android.name")}
            status={t("platforms.android.status")}
            cta={t("platforms.android.notifyLabel")}
          />
        </div>
      </section>

      {/* ───── Why the desktop app? ───── */}
      <section className="space-y-4">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white text-center">
          {t("features.title")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard
            icon={<Wifi className="w-6 h-6" />}
            title={t("features.offlineTitle")}
            body={t("features.offlineBody")}
          />
          <FeatureCard
            icon={<RefreshCw className="w-6 h-6" />}
            title={t("features.updatesTitle")}
            body={t("features.updatesBody")}
          />
          <FeatureCard
            icon={<AppWindow className="w-6 h-6" />}
            title={t("features.systemTitle")}
            body={t("features.systemBody")}
          />
        </div>
      </section>

      {/* ───── FAQ ───── */}
      <section className="space-y-4">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white text-center">
          {t("faq.title")}
        </h2>
        <div className="modern-card p-6 sm:p-8 space-y-5">
          <FaqItem q={t("faq.items.free.q")} a={t("faq.items.free.a")} />
          <FaqItem q={t("faq.items.account.q")} a={t("faq.items.account.a")} />
          <FaqItem q={t("faq.items.update.q")} a={t("faq.items.update.a")} />
          <FaqItem q={t("faq.items.uninstall.q")} a={t("faq.items.uninstall.a")} />
        </div>
      </section>
    </div>
  );
}

/* ───────────── Card components ───────────── */

function WindowsCard({
  installerLabel,
  installerHint,
  portableLabel,
  portableHint,
  version,
  size,
  status,
}: {
  installerLabel: string;
  installerHint: string;
  portableLabel: string;
  portableHint: string;
  version: string;
  size: string;
  status: string;
}) {
  return (
    <div className="modern-card p-6 flex flex-col gap-4 relative overflow-hidden ring-1 ring-brand-blue/20">
      <div className="absolute top-3 end-3 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
        <Check className="w-3 h-3" />
        <span>{status}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center">
          <Monitor className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Windows</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {version} · {size}
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        <a
          href={DOWNLOAD_URLS.windowsInstaller}
          className="group flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-brand-blue hover:bg-brand-blue/5 transition-colors"
        >
          <div className="w-9 h-9 rounded-lg bg-brand-blue text-white flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {installerLabel}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {installerHint}
            </div>
          </div>
        </a>

        <a
          href={DOWNLOAD_URLS.windowsPortable}
          className="group flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-brand-blue hover:bg-brand-blue/5 transition-colors"
        >
          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center flex-shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {portableLabel}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {portableHint}
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}

function ComingSoonCard({
  icon,
  name,
  status,
  cta,
}: {
  icon: React.ReactNode;
  name: string;
  status: string;
  cta: string;
}) {
  return (
    <div className="modern-card p-6 flex flex-col gap-4 opacity-80 hover:opacity-100 transition-opacity">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{name}</h3>
          <div className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <Clock className="w-3 h-3" />
            <span>{status}</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled
        className="w-full h-10 px-4 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-500 dark:text-slate-400 inline-flex items-center justify-center gap-2 cursor-not-allowed"
        title={cta}
      >
        <Bell className="w-4 h-4" />
        <span>{cta}</span>
      </button>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="modern-card p-6 space-y-3">
      <div className="w-11 h-11 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center">
        {icon}
      </div>
      <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{body}</p>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-base font-bold text-slate-900 dark:text-white">{q}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{a}</p>
    </div>
  );
}
