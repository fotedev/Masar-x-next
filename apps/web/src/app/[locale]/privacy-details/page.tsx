"use client";

import { useTranslations } from "next-intl";
import {
  Shield,
  Eye,
  ArrowLeft,
  ChevronRight,
  CheckCircle,
  Info,
} from "lucide-react";
import { useRouter } from '@/navigation';

export default function PrivacyDetailsPage() {
  const t = useTranslations("privacyDetails");
  const router = useRouter();

  const dataTypes = [
    {
      title: t("dataTypes.auth.title"),
      icon: "user",
      purpose: t("dataTypes.auth.purpose"),
      details: [
        t("dataTypes.auth.details.0"),
        t("dataTypes.auth.details.1"),
        t("dataTypes.auth.details.2"),
      ],
      necessity: t("dataTypes.auth.necessity"),
    },
    {
      title: t("dataTypes.academic.title"),
      icon: "graduation",
      purpose: t("dataTypes.academic.purpose"),
      details: [
        t("dataTypes.academic.details.0"),
        t("dataTypes.academic.details.1"),
        t("dataTypes.academic.details.2"),
      ],
      necessity: t("dataTypes.academic.necessity"),
    },
    {
      title: t("dataTypes.summaries.title"),
      icon: "file-text",
      purpose: t("dataTypes.summaries.purpose"),
      details: [
        t("dataTypes.summaries.details.0"),
        t("dataTypes.summaries.details.1"),
        t("dataTypes.summaries.details.2"),
      ],
      necessity: t("dataTypes.summaries.necessity"),
    },
    {
      title: t("dataTypes.interactions.title"),
      icon: "message-circle",
      purpose: t("dataTypes.interactions.purpose"),
      details: [
        t("dataTypes.interactions.details.0"),
        t("dataTypes.interactions.details.1"),
        t("dataTypes.interactions.details.2"),
      ],
      necessity: t("dataTypes.interactions.necessity"),
    },
    {
      title: t("dataTypes.performance.title"),
      icon: "bar-chart",
      purpose: t("dataTypes.performance.purpose"),
      details: [
        t("dataTypes.performance.details.0"),
        t("dataTypes.performance.details.1"),
        t("dataTypes.performance.details.2"),
      ],
      necessity: t("dataTypes.performance.necessity"),
    },
    {
      title: t("dataTypes.profileImage.title"),
      icon: "camera",
      purpose: t("dataTypes.profileImage.purpose"),
      details: [
        t("dataTypes.profileImage.details.0"),
        t("dataTypes.profileImage.details.1"),
        t("dataTypes.profileImage.details.2"),
      ],
      necessity: t("dataTypes.profileImage.necessity"),
    },
  ];

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "user":
        return "👤";
      case "graduation":
        return "🎓";
      case "file-text":
        return "📄";
      case "message-circle":
        return "💬";
      case "bar-chart":
        return "📊";
      case "camera":
        return "📸";
      default:
        return "📋";
    }
  };

  const getNecessityColor = (necessity: string) => {
    if (necessity === t("dataTypes.auth.necessity"))
      return "text-red-600 bg-red-50 dark:bg-red-900/20";
    if (necessity === t("dataTypes.summaries.necessity"))
      return "text-orange-600 bg-orange-50 dark:bg-orange-900/20";
    if (necessity === t("dataTypes.academic.necessity"))
      return "text-blue-600 bg-blue-50 dark:bg-blue-900/20";
    if (necessity === t("dataTypes.interactions.necessity"))
      return "text-green-600 bg-green-50 dark:bg-green-900/20";
    if (necessity === t("dataTypes.performance.necessity"))
      return "text-purple-600 bg-purple-50 dark:bg-purple-900/20";
    return "text-gray-600 bg-gray-50 dark:bg-gray-900/20";
  };

  return (
    <div className="min-h-dvh-safe bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <button
            onClick={() => router.push("/privacy-policy")}
            className="inline-flex items-center gap-2 text-brand-blue hover:text-brand-blue/80 transition-colors mb-6 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("backToPolicy")}
          </button>

          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-brand-blue/10 dark:bg-brand-blue/20 mb-6 shadow-xl shadow-brand-blue/5 animate-in fade-in zoom-in duration-700">
              <Eye className="w-10 h-10 text-brand-blue" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
              {t("title")}
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 font-medium max-w-3xl mx-auto">
              {t("subtitle")}
            </p>
          </div>
        </div>

        {/* Data Types Grid */}
        <div className="space-y-8">
          {dataTypes.map((dataType, index) => (
            <div
              key={index}
              className="modern-card p-8 sm:p-10 hover:shadow-2xl transition-all duration-500 group"
            >
              <div className="flex items-start gap-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-blue/10 to-brand-blue/20 dark:from-brand-blue/20 dark:to-brand-blue/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform text-2xl">
                  {getIcon(dataType.icon)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                      {dataType.title}
                    </h2>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${getNecessityColor(
                        dataType.necessity,
                      )}`}
                    >
                      {dataType.necessity}
                    </span>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="font-semibold text-blue-900 dark:text-blue-100">
                        {t("collectionPurpose")}:
                      </span>
                    </div>
                    <p className="text-blue-800 dark:text-blue-200 font-medium">
                      {dataType.purpose}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                      <ChevronRight className="w-5 h-5 text-brand-blue" />
                      {t("detailsExplanation")}:
                    </h3>
                    <ul className="space-y-3">
                      {dataType.details.map((detail, detailIndex) => (
                        <li
                          key={detailIndex}
                          className="flex items-start gap-3 text-slate-600 dark:text-slate-400 font-medium"
                        >
                          <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Security Notice */}
        <div className="mt-12 modern-card p-8 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border-green-200 dark:border-green-800">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
              <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                {t("commitment.title")}
              </h3>
              <div className="space-y-2 text-slate-600 dark:text-slate-400">
                <p>{t("commitment.content1")}</p>
                <p>{t("commitment.content2")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
