"use client";

import { useAuth } from "../contexts/AuthContext";
import { useTranslations, useLocale } from "next-intl";
import { Heart } from "lucide-react";
import { FooterBrand } from "./footer/FooterBrand";
import { FooterLinks } from "./footer/FooterLinks";
import { FooterSupport } from "./footer/FooterSupport";
import { FooterDeveloper } from "./footer/FooterDeveloper";

export function Footer() {
  const tFooter = useTranslations("footer");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const { user, profile } = useAuth();
  const displayName = profile?.username || user?.user_metadata?.username || user?.email?.split("@")[0] || "";
  const phoneNumber = "201207688761";
  const whatsappUrl = `https://wa.me/${phoneNumber}`;
  const trwWhatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(
    locale === "ar"
      ? `أنا الطالب: ${displayName || "زائر"}، أريد الانضمام إلى قسم TRW`
      : `I am the student: ${displayName || "Guest"}, I want to join the TRW section`,
  )}`;

  const localePrefix = locale === "en" ? "/en" : "/ar";

  return (
    <footer
      className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pt-12 pb-6 mt-auto transition-colors"
      suppressHydrationWarning
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12 mb-12">
          <FooterBrand t={tFooter} />

          <FooterLinks
            tFooter={tFooter}
            tNav={tNav}
            localePrefix={localePrefix}
            trwWhatsappUrl={trwWhatsappUrl}
          />

          <FooterSupport tFooter={tFooter} whatsappUrl={whatsappUrl} />

          <FooterDeveloper tFooter={tFooter} />
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 dark:text-slate-500 text-xs font-medium">
            {tFooter("copyright", { year: new Date().getFullYear() })}
          </p>
          <div className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-500">
            <span className="text-brand-blue font-bold">Aboalayoun</span>
            <span lang="en" dir="ltr" className="bidi-ltr">
              {tFooter("by")}
            </span>
            <Heart className="w-3 h-3 text-white fill-white animate-pulse" />
            <span lang="en" dir="ltr" className="bidi-ltr">
              {tFooter("madeWith")}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
