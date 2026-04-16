import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { AppProviders } from "@/components/AppProviders";
import { createClient } from "@/lib/supabase/server";
import { getAdminDb } from "@/lib/admin-db";
import { profiles } from "@/lib/admin-db/schema";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { notFound } from "next/navigation";
import { type ReactNode } from "react";

export const dynamic = "force-dynamic";

type Locale = "ar" | "en";

// Cached profile fetch to avoid duplicate queries
const getProfile = cache(async (userId: string) => {
  try {
    const adminDb = getAdminDb();
    const [profile] = await adminDb
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    return profile || null;
  } catch (error) {
    console.error("Error fetching profile in layout:", error);
    return null;
  }
});

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params?: Promise<{ locale: string }>;
}>) {
  const resolvedParams = await params;
  const locale = resolvedParams?.locale;
  if (!locale) {
    notFound();
  }
  const typedLocale = locale as Locale;

  if (typedLocale !== "ar" && typedLocale !== "en") {
    notFound();
  }

  const messages = await getMessages({ locale: typedLocale });
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  let profile = null;
  let isAdmin = false;

  if (user) {
    profile = await getProfile(user.id);
    const role = user.app_metadata?.role;
    isAdmin = role === 'admin' || role === 'doctor' || role === 'student_admin';
  }

  const dir = typedLocale === "ar" ? "rtl" : "ltr";

  return (
    <NextIntlClientProvider 
      locale={typedLocale} 
      messages={messages} 
      timeZone="Africa/Cairo"
    >
      <AppProviders 
        dir={dir} 
        user={user} 
        profile={profile} 
        isAdmin={isAdmin}
      >
        {children}
      </AppProviders>
    </NextIntlClientProvider>
  );
}
