import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import {
  detectPlatform,
  getLatestReleaseUrls,
  type Platform,
  type ReleaseUrls,
} from "@/lib/github-releases";
import { DesktopAppBannerClient } from "./DesktopAppBannerClient";

/**
 * Server-rendered container for the top desktop app banner.
 *
 * Fetches the latest release URLs from GitHub (cached 1h) and
 * determines the initial platform from the User-Agent header.
 * Passes data to the client component which handles dismissal,
 * interactive states, and client-side OS verification.
 */
export async function DesktopAppBanner({ locale }: { locale: string }) {
  const t = await getTranslations("downloads");

  const [ua, release] = await Promise.all([
    headers().then((h) => h.get("user-agent")),
    getLatestReleaseUrls().catch<ReleaseUrls | null>(() => null),
  ]);

  if (!release) return null;

  const initialPlatform: Platform = detectPlatform(ua);

  return (
    <DesktopAppBannerClient
      release={release}
      initialPlatform={initialPlatform}
      locale={locale}
      translations={{
        title: t("hero.title"),
        subtitle: t("hero.subtitle"),
        primaryCta: t("hero.primaryCta"),
        secondaryCta: t("hero.secondaryCta"),
        allPlatformsCta: t("hero.allPlatformsCta"),
        dismiss: t("hero.dismiss"),
      }}
    />
  );
}
