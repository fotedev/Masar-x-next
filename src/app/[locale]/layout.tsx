import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { AppProviders } from "@/components/AppProviders";
import { notFound } from "next/navigation";
import { type ReactNode } from "react";

export const dynamic = "force-dynamic";

type Locale = "ar" | "en";

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params: { locale: string } | Promise<{ locale: string }>;
}>) {
  const { locale } = await Promise.resolve(params);
  const typedLocale = locale as Locale;

  if (typedLocale !== "ar" && typedLocale !== "en") {
    notFound();
  }

  const messages = await getMessages({ locale: typedLocale });
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
