"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
// NOTE: useMemo is still used above to memoize the supabase client.

import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Monitor } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { queryCache, cacheKeys, cacheTTL } from "@/lib/queryCache";

// Phase 1 of refactor/decouple-trw-subjects:
// /non-academic/[subject] is now exclusively backed by the trw_categories
// table. The legacy code read this URL segment against the academic
// `subjects` table, which is the wrong data source and would return rows
// unrelated to the TRW membership context.
type TRWCategory = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  cover_url?: string | null;
};

function SubjectDetailsContent() {
  const params = useParams();
  const subjectSlug = params?.subject as string;
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [category, setCategory] = useState<TRWCategory | null>(null);
  const [loading, setLoading] = useState(true);

  const normalizedSlug = subjectSlug ? decodeURIComponent(subjectSlug) : "";

  useEffect(() => {
    async function fetchTRWCategory() {
      if (!normalizedSlug) return;

      const cacheKey = cacheKeys.subjectDetails(normalizedSlug);
      const cached = queryCache.get<TRWCategory>(cacheKey);
      if (cached) {
        setCategory(cached);
        setLoading(false);
        return;
      }

      try {
        // The [subject] segment is the trw_categories.slug, not a row in
        // `subjects`. Filtering on is_published keeps unpublished drafts out
        // of the public-facing gate even if the URL is guessed.
        const { data } = await supabase
          .from("trw_categories")
          .select("id, slug, name, description, cover_url")
          .eq("slug", normalizedSlug)
          .eq("is_published", true)
          .maybeSingle();

        if (data) {
          setCategory(data as TRWCategory);
          queryCache.set(cacheKey, data as TRWCategory, cacheTTL.subjects);
        }
      } catch {
        // Intentionally swallow — empty state already communicates "coming soon".
      } finally {
        setLoading(false);
      }
    }
    fetchTRWCategory();
  }, [normalizedSlug, supabase]);

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
          العودة لـ TRW
        </button>
      </div>

      <div className="relative group overflow-hidden rounded-[3rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-10">
        <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start justify-between relative z-10">
          <div className="flex-1 space-y-6 text-right">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.1]">
              {category?.name || normalizedSlug}
            </h1>
            <p className="text-xl text-brand-blue font-bold tracking-widest uppercase">
              MONEY MAKING IS A SKILL
            </p>
            <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed font-medium">
              {category?.description ||
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
