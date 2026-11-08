import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "../../../lib/supabase/server";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // getCachedUser dedupes with the [locale] layout's call in the same
  // render pass (spec 033 Track C) — one auth roundtrip, not two.
  const user = await getCachedUser();
  const supabase = await createClient();

  if (!user) {
    // Locale-prefixed redirects: bare paths rely on middleware locale
    // detection and can flip the visitor's language (review 2026-11-07 D2).
    redirect(`/${locale}/login`);
  }

  const { data: adminRow, error: adminError } = await supabase
    .from("admins")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError || !adminRow) {
    redirect(`/${locale}/unauthorized`);
  }

  return children;
}
