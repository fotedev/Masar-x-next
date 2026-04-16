import { type ReactNode } from "react";
import "../index.css";
import { cookies, headers } from "next/headers";
import ThemeScript from "@/components/ThemeScript";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://masarx.vercel.app";

import { getTranslations } from "next-intl/server";
import { getLocale } from "next-intl/server";

type Locale = "ar" | "en";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as Locale;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    title: {
      default: t("title"),
      template: `%s | ${t("siteName")}`,
    },
    description: t("description"),
    keywords: t("keywords"),
    openGraph: {
      title: t("title"),
      description: t("description"),
      siteName: t("siteName"),
    },
    twitter: {
      title: t("title"),
      description: t("description"),
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
        normalizeLocale(headerLocale) ??
        normalizeLocale(cookieLocale) ??
        "ar"
      );
    }
  };

  const locale = await localeFromRequest();
  const assistantName = locale === "ar" ? "زين" : "ZANE";

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
      style={{ overflowX: "clip" }}
    >
      <head>
        <ThemeScript siteUrl={SITE_URL} assistantName={assistantName} />
      </head>
      <body
        className={`${fontVariable} min-h-screen bg-slate-50 dark:bg-brand-navy antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
