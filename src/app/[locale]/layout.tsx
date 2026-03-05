import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { AppProviders } from "@/components/AppProviders";

type Locale = "ar" | "en";

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: { locale: string };
}>) {
  const locale = params.locale as Locale;

  if (locale !== "ar" && locale !== "en") {
    notFound();
  }

  const messages = (await import(`@/messages/${locale}.json`)).default;
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AppProviders dir={dir}>{children}</AppProviders>
    </NextIntlClientProvider>
  );
}
