"use client";

import { useMemo, useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { useTranslations } from "next-intl";

type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export default function FaqPage() {
  const t = useTranslations("faq");
  const faqs = useMemo<FaqItem[]>(
    () => [
      {
        id: "whatIsMasarx",
        question: t("items.whatIsMasarx.question"),
        answer: t("items.whatIsMasarx.answer"),
      },
      {
        id: "approvalProcess",
        question: t("items.approvalProcess.question"),
        answer: t("items.approvalProcess.answer"),
      },
      {
        id: "accountRequired",
        question: t("items.accountRequired.question"),
        answer: t("items.accountRequired.answer"),
      },
      {
        id: "reportIssue",
        question: t("items.reportIssue.question"),
        answer: t("items.reportIssue.answer"),
      },
    ],
    [t],
  );

  const [openId, setOpenId] = useState<string | null>(faqs[0]?.id ?? null);

  return (
    <div className="space-y-6">
      <div className="modern-card p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-blue/10 text-brand-blue flex items-center justify-center flex-shrink-0">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {t("title")}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 font-medium">
              {t("subtitle")}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {faqs.map((item) => {
          const isOpen = item.id === openId;

          return (
            <div key={item.id} className="modern-card overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId((prev) => (prev === item.id ? null : item.id))}
                className="w-full flex items-center justify-between gap-4 p-5 sm:p-6 text-right"
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${item.id}`}
              >
                <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {item.question}
                </span>
                <span
                  className={`p-2 rounded-xl transition-colors ${
                    isOpen
                      ? "bg-brand-blue/10 text-brand-blue"
                      : "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300"
                  }`}
                >
                  <ChevronDown
                    className={`w-5 h-5 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : "rotate-0"
                    }`}
                  />
                </span>
              </button>

              {isOpen && (
                <div
                  id={`faq-panel-${item.id}`}
                  className="px-5 sm:px-6 pb-5 sm:pb-6 -mt-1"
                >
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
