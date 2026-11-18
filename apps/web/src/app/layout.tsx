import { type ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import "../index.css";
import "@/styles/desktop-shell.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
import { cookies, headers } from "next/headers";
import ThemeScript from "@/components/ThemeScript";
import "@/styles/html-clip.css";

import { SITE_URL } from "@/lib/site-url";
import {
  resolveFacultyPresetIdFromEnv,
  type FacultyPresetId,
} from "masarx-shared";

import { getTranslations } from "next-intl/server";
import { getLocale } from "next-intl/server";

type Locale = "ar" | "en";

/**
 * Spec 052: the brand strings the metadata surfaces. Faculty deployments
 * (NEXT_PUBLIC_FACULTY set) swap in their preset from the `faculty`
 * namespace; core keeps the exact metadata.json values (BRANDING.md §2).
 */
interface MetadataBrand {
  title: string;
  siteName: string;
  titleSuffix: string;
}

async function getFacultyBrand(
  locale: Locale,
  facultyId: FacultyPresetId,
): Promise<MetadataBrand> {
  const ft = await getTranslations({ locale, namespace: "faculty" });
  return {
    title: ft(`${facultyId}.seoTitle`),
    siteName: ft(`${facultyId}.displayName`),
    titleSuffix: ft(`${facultyId}.titleSuffix`),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as Locale;
  const t = await getTranslations({ locale, namespace: "metadata" });

  const facultyId = resolveFacultyPresetIdFromEnv();
  const brand: MetadataBrand = facultyId
    ? await getFacultyBrand(locale, facultyId)
    : { title: t("title"), siteName: t("siteName"), titleSuffix: t("siteName") };

  return {
    metadataBase: new URL(SITE_URL),
    // NOTE: `applicationName` is intentionally NOT set — Next 16.4.6's
    // metadata resolver no longer renders it (verified 2026-11-19 in the
    // dev-server HTML); og:site_name covers the application name for
    // crawlers and PWA install reads /manifest.webmanifest directly.
    title: {
      default: brand.title,
      template: `%s | ${brand.titleSuffix}`,
    },
    description: t("description"),
    keywords: t("keywords"),
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "48x48" },
        { url: "/favicon.svg", type: "image/svg+xml" },
      ],
      apple: "/apple-touch-icon.png",
    },
    openGraph: {
      title: brand.title,
      description: `${t("slogan")} — ${t("description")}`,
      siteName: brand.siteName,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: brand.siteName }],
    },
    twitter: {
      title: brand.title,
      description: `${t("slogan")} — ${t("description")}`,
      card: "summary_large_image",
      images: ["/og-image.png"],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const headersList = await headers();
  const cookieStore = await cookies();
  const headerLocale = headersList.get("x-next-intl-locale");
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const normalizeLocale = (value: string | null | undefined): Locale | null =>
    value === "en" || value === "ar" ? value : null;

  const localeFromRequest = async (): Promise<Locale> => {
    try {
      const intlLocale = await getLocale();
      return (
        normalizeLocale(intlLocale) ??
        normalizeLocale(headerLocale) ??
        normalizeLocale(cookieLocale) ??
        "ar"
      );
    } catch {
      return (
        normalizeLocale(headerLocale) ?? normalizeLocale(cookieLocale) ?? "ar"
      );
    }
  };

  const locale = await localeFromRequest();
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const assistantName = tNav("assistant");

  const fontVariable =
    locale === "ar"
      ? (await import("@/lib/fonts/almaraiFont")).almaraiClassName
      : (await import("@/lib/fonts/interFont")).interClassName;

  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
      className="html-overflow-clip"
    >
      <head>
        <ThemeScript
          siteUrl={SITE_URL}
          assistantName={assistantName}
          nonce={headersList.get("x-nonce") ?? undefined}
        />
      </head>
      <body
        className={`${fontVariable} min-h-dvh-safe bg-slate-50 dark:bg-brand-navy antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
