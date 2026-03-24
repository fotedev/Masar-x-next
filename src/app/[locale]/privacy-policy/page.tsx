"use client";

import { useTranslations } from "next-intl";
import {
  Shield,
  Lock,
  Eye,
  FileText,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "@/i18n/routing";

export default function PrivacyPolicyPage() {
  const t = useTranslations("privacyPolicy");
  const router = useRouter();
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-brand-blue/10 dark:bg-brand-blue/20 mb-6 shadow-xl shadow-brand-blue/5 animate-in fade-in zoom-in duration-700">
            <Shield className="w-10 h-10 text-brand-blue" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
            {t("title")}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 font-medium max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </div>

        {/* Content Sections */}
        <div className="space-y-8">
          {/* Introduction */}
          <section className="modern-card p-8 sm:p-10 hover:shadow-2xl transition-all duration-500 group">
            <div className="flex items-start gap-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                  {t("intro.title")}
                </h2>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t("intro.content")}
                </p>
              </div>
            </div>
          </section>

          {/* Information Collection */}
          <section className="modern-card p-8 sm:p-10 hover:shadow-2xl transition-all duration-500 group">
            <div className="flex items-start gap-6">
              <div className="w-12 h-12 rounded-2xl bg-brand-blue/5 dark:bg-brand-blue/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <Eye className="w-6 h-6 text-brand-blue" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                  {t("collection.title")}
                </h2>
                <div className="space-y-4">
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    {t("collection.description")}
                  </p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      t("collection.items.fullName"),
                      t("collection.items.academicLevel"),
                      t("collection.items.summaries"),
                      t("collection.items.interactions"),
                      t("collection.items.performance"),
                      t("collection.items.profileImage"),
                    ].map((item, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-3 text-slate-600 dark:text-slate-400 font-medium"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-blue" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => router.push("/privacy-details")}
                      className="inline-flex items-center gap-3 px-6 py-3 bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue rounded-xl font-bold transition-all group border border-brand-blue/20 hover:border-brand-blue/40"
                    >
                      <span>{t("collection.moreDetails")}</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">
                      {t("collection.detailsNote")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Data Protection */}
          <section className="modern-card p-8 sm:p-10 hover:shadow-2xl transition-all duration-500 group">
            <div className="flex items-start gap-6">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <Lock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                  {t("protection.title")}
                </h2>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t("protection.content")}
                </p>
              </div>
            </div>
          </section>

          {/* Contact Section */}
          <section className="bg-brand-blue rounded-[2.5rem] p-10 sm:p-12 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:scale-125 transition-transform duration-700" />
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="text-center md:text-right">
                <h2 className="text-3xl font-bold mb-4">
                  {t("contact.title")}
                </h2>
                <p className="text-white/80 font-medium max-w-md">
                  {t("contact.description")}
                </p>
              </div>
              <a
                href="https://wa.me/201207688761"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-8 py-4 bg-white text-brand-blue rounded-2xl font-bold hover:bg-slate-50 transition-all shadow-xl shadow-black/10 group/btn"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 19 19"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="transition-transform group-hover:scale-110"
                >
                  <path
                    d="M15.255 3.713a8 8 0 0 0-5.684-2.36c-4.433 0-8.043 3.603-8.043 8.036 0 1.394.364 2.771 1.045 3.974l-1.164 4.26 4.354-1.14a8.06 8.06 0 0 0 3.8.957c4.434 0 8.044-3.61 8.044-8.043 0-2.145-.84-4.172-2.352-5.692zM4.283 13.11c-.76-.863-1.18-2.312-1.18-3.72a6.467 6.467 0 0 1 6.46-6.46 6.42 6.42 0 0 1 4.568 1.891 6.42 6.42 0 0 1 1.892 4.568 6.467 6.467 0 0 1-6.46 6.46c-1.258 0-2.596-.404-3.562-1.06l-2.343.609z"
                    fill="currentColor"
                  ></path>
                  <path
                    d="M11.748 10.434c.182.064 1.148.539 1.346.641.198.103.333.15.38.23.048.08.048.475-.119.934s-.95.879-1.33.934c-.34.048-.768.072-1.242-.079a12 12 0 0 1-1.125-.412c-1.979-.854-3.27-2.842-3.364-2.976-.103-.143-.8-1.069-.8-2.035s.507-1.448.689-1.646a.72.72 0 0 1 .522-.246h.38c.12 0 .285-.047.444.34.166.396.562 1.362.61 1.465a.38.38 0 0 1 .015.349c-.063.134-.095.213-.198.324a8 8 0 0 1-.293.348c-.095.095-.198.206-.087.404.119.198.507.84 1.093 1.362.752.673 1.385.879 1.583.974s.309.079.428-.048c.118-.135.49-.578.625-.776s.261-.166.443-.095z"
                    fill="currentColor"
                  ></path>
                </svg>
                <span>{t("contact.whatsapp")}</span>
                <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
              </a>
            </div>
          </section>
        </div>

        {/* Footer Info */}
        <div className="mt-16 text-center"></div>
      </div>
    </div>
  );
}
