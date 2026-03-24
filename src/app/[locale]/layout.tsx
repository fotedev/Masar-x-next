import { NextIntlClientProvider } from "next-intl";
import { AppProviders } from "@/components/AppProviders";
import { notFound } from "next/navigation";

type Locale = "ar" | "en";

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: { locale: string };
}>) {
  const { locale } = params;
  const typedLocale = locale as Locale;

  if (typedLocale !== "ar" && typedLocale !== "en") {
    notFound();
  }

  const messages = (await import(`@/messages/${typedLocale}.json`)).default;
  const dir = typedLocale === "ar" ? "rtl" : "ltr";

  return (
    <NextIntlClientProvider 
      locale={typedLocale} 
      messages={messages} 
      timeZone="Africa/Cairo"
    >
      <AppProviders dir={dir}>{children}</AppProviders>
    </NextIntlClientProvider>
  );
}
