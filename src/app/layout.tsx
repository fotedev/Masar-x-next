import { Inter, Almarai } from "next/font/google";
import "../index.css";
import { cookies, headers } from "next/headers";

const inter = Inter({ subsets: ["latin"] });
const almarai = Almarai({
  subsets: ["arabic"],
  weight: ["300", "400", "700", "800"],
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://masarx.vercel.app";

import { getTranslations } from "next-intl/server";
import { getLocale } from "next-intl/server";

type Locale = "ar" | "en";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}) {
  const locale = params.locale as Locale;
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
  children: React.ReactNode;
}>) {
  const headerLocale = headers().get("x-next-intl-locale");
  const cookieLocale = cookies().get("NEXT_LOCALE")?.value;
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

  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
      style={{ overflowX: "clip" }}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "MasarX",
              url: SITE_URL,
              description:
                `Study summaries, quizzes, courses, and ${assistantName} AI assistant platform`,
            }),
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  var supportDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches === true;
                  if (!theme && supportDarkMode) theme = 'dark';
                  if (!theme) theme = 'light';
                  document.documentElement.classList.toggle('dark', theme === 'dark');
                  document.documentElement.style.colorScheme = theme;
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${inter.className} ${almarai.className} min-h-screen bg-slate-50 dark:bg-brand-navy antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
