import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { AppProviders } from "@/components/AppProviders";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cache } from "react";
import { notFound } from "next/navigation";
import { type ReactNode } from "react";
import { isAdminRole } from "@/lib/auth/roles";
import { logger } from "@/lib/logger";

type Locale = "ar" | "en";

// Profile row shape — kept loose to avoid coupling layout to the Drizzle schema
type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  website: string | null;
  level: number | null;
  semester: number | null;
  department_id: string | null;
  show_extra_assets: boolean | null;
  show_extra_assets_updated_at: string | null;
  updated_at: string | null;
  created_at: string | null;
} | null;

// Cached profile fetch via Supabase JS (service role). Avoids the
// pg + Drizzle driver, which breaks on Next.js 16 dev with webpack
// (native TLS module is not externalized reliably).
const getProfile = cache(async (userId: string): Promise<ProfileRow> => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, username, full_name, avatar_url, website, level, semester, department_id, show_extra_assets, show_extra_assets_updated_at, updated_at, created_at",
      )
      .eq("id", userId)
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error(`[layout] Error fetching profile for ${userId}: ${error.message}`, {
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return null;
    }

    return (data as ProfileRow) ?? null;
  } catch (error) {
    // Raw console.error to see the full error object (logger.summary strips details)
    console.error("[layout] RAW ERROR:", error);
    const message = error instanceof Error ? error.message : String(error);
    // `cause` is an ES2022 property on Error — guarded for older lib targets.
    const cause = (() => {
      if (!(error instanceof Error)) return "";
      const errWithCause = error as Error & { cause?: unknown };
      if (errWithCause.cause instanceof Error) {
        return ` | cause: ${errWithCause.cause.message}`;
      }
      return "";
    })();
    logger.error(`[layout] Unexpected error fetching profile for ${userId}: ${message}${cause}`);
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  let isAdmin = false;

  if (user) {
    const rawProfile = await getProfile(user.id);
    // Map Supabase's snake_case to the camelCase shape AppProviders expects.
    if (rawProfile) {
      profile = {
        id: rawProfile.id,
        updatedAt: rawProfile.updated_at,
        username: rawProfile.username,
        fullName: rawProfile.full_name,
        avatarUrl: rawProfile.avatar_url,
        website: rawProfile.website,
        level: rawProfile.level,
        semester: rawProfile.semester,
        departmentId: rawProfile.department_id,
        showExtraAssets: rawProfile.show_extra_assets,
        showExtraAssetsUpdatedAt: rawProfile.show_extra_assets_updated_at,
      };
    }
    const role = user.app_metadata?.role;
    isAdmin = isAdminRole(role);
  }

  const dir = typedLocale === "ar" ? "rtl" : "ltr";

  return (
    <NextIntlClientProvider
      locale={typedLocale}
      messages={messages}
      timeZone="Africa/Cairo"
    >
      <AppProviders dir={dir} user={user} profile={profile} isAdmin={isAdmin}>
        {children}
      </AppProviders>
    </NextIntlClientProvider>
  );
}
