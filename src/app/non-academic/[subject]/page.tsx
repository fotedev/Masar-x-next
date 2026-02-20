"use client";

import React, { Suspense, useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Monitor } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { queryCache, cacheKeys, cacheTTL } from "../../../lib/queryCache";

function SubjectDetailsContent() {
  const params = useParams();
  const subjectId = params?.subject as string;
  const router = useRouter();

  const [subjectDetails, setSubjectDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const subjectName = subjectId ? decodeURIComponent(subjectId) : "";
  const normalizedSubjectName = useMemo(
    () => subjectName.trim(),
    [subjectName],
  );

  useEffect(() => {
    async function fetchSubjectDetails() {
      if (!normalizedSubjectName) return;

      const cacheKey = cacheKeys.subjectDetails(normalizedSubjectName);
      const cached = queryCache.get<any>(cacheKey);
      if (cached) {
        setSubjectDetails(cached);
        setLoading(false);
        return;
      }

      try {
        const { data } = await supabase
          .from("subjects")
          .select(
            "id, name, professor, description, schedule, location, level, semester, status, show_on_home, created_at, is_academic",
          )
          .eq("name", normalizedSubjectName)
          .maybeSingle();

        if (data) {
          setSubjectDetails(data);
          queryCache.set(cacheKey, data, cacheTTL.subjects);
        }
      } catch (error) {
        console.error("Error fetching subject details:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSubjectDetails();
  }, [normalizedSubjectName]);

  if (loading) {
    return (
      <div className="p-12 text-center animate-pulse">جاري التحميل...</div>
    );
  }

  return (
    <div className="space-y-8 pb-12" dir="rtl">
      <div className="flex justify-start">
        <button
          onClick={() => router.push("/non-academic")}
          className="group flex items-center gap-3 px-6 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-black hover:border-brand-blue hover:text-brand-blue transition-all shadow-sm"
        >
          <ArrowRight className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-300" />
          العودة للأقسام العامة
        </button>
      </div>

      <div className="relative group overflow-hidden rounded-[3rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-10">
        <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start justify-between relative z-10">
          <div className="flex-1 space-y-6 text-right">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.1]">
              {normalizedSubjectName}
            </h1>
            <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed font-medium">
              {subjectDetails?.description ||
                "قسم مهارات عامة وكورسات تطويرية."}
            </p>
          </div>
        </div>
      </div>

      <div className="text-center py-20">
        <Monitor className="w-20 h-20 text-slate-200 dark:text-slate-800 mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
          قريباً...
        </h2>
        <p className="text-slate-500 dark:text-slate-400">
          جاري تجهيز محتوى هذا القسم.
        </p>
      </div>
    </div>
  );
}

export default function NonAcademicSubjectPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center animate-pulse">جاري التحميل...</div>
      }
    >
      <SubjectDetailsContent />
    </Suspense>
  );
}
