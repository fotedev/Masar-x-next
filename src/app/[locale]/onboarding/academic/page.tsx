import { type FormEvent } from "react";
"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "../../../../contexts/AuthContext";
import { useUserAcademic } from "../../../../hooks/useUserAcademic";

export default function AcademicOnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { academic, loading, setUserAcademic } = useUserAcademic();

  const initialLevel = useMemo(() => academic.level ?? 1, [academic.level]);
  const initialSemester = useMemo(
    () => academic.semester ?? 1,
    [academic.semester],
  );

  const [level, setLevel] = useState<number>(initialLevel);
  const [semester, setSemester] = useState<number>(initialSemester);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push("/login");
  }, [authLoading, router, user]);

  useEffect(() => {
    if (loading || authLoading) return;
    if (!user) return;
    if (saving) return; // DON'T redirect if we are currently saving
    if (hasRedirected.current) return;

    if (isAdmin) {
      hasRedirected.current = true;
      router.replace("/");
      return;
    }

    if (academic.level != null && academic.semester != null) {
      hasRedirected.current = true;
      router.replace("/");
    }
  }, [
    academic.level,
    academic.semester,
    isAdmin,
    loading,
    authLoading,
    router,
    saving,
    user,
  ]);

  useEffect(() => {
    setLevel(initialLevel);
  }, [initialLevel]);

  useEffect(() => {
    setSemester(initialSemester);
  }, [initialSemester]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!user) return;

    if (![1, 2, 3, 4].includes(level)) {
      setError("اختر مستوى صحيح");
      return;
    }

    if (![1, 2].includes(semester)) {
      setError("اختر ترم صحيح");
      return;
    }

    setSaving(true);
    try {
      // Small timeout to allow optimistic UI updates to happen first
      const result = await setUserAcademic(
        {
          level,
          semester,
          department_id: null,
        },
        { isProfileUpdate: false },
      );

      if (!result.success) {
        setError(result.message || "حدث خطأ أثناء الحفظ. حاول مرة أخرى.");
        setSaving(false);
        return;
      }

      // Redirect immediately after optimistic update succeeds
      router.replace("/");
    } catch {
      setError("حدث خطأ غير متوقع. حاول مرة أخرى.");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-10">
      <div className="modern-card p-8 sm:p-10">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-2">
            تحديد المستوى والترم
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            اختر بياناتك الدراسية لعرض المواد المناسبة لك
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl text-sm font-bold bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 mr-1">
              المستوى
            </label>
            <select
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="w-full px-4 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-brand-blue focus:border-transparent bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none transition-all"
            >
              <option value={1}>المستوى الأول</option>
              <option value={2}>المستوى الثاني</option>
              <option value={3}>المستوى الثالث</option>
              <option value={4}>المستوى الرابع</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 mr-1">
              الترم
            </label>
            <select
              value={semester}
              onChange={(e) => setSemester(Number(e.target.value))}
              className="w-full px-4 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-brand-blue focus:border-transparent bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none transition-all"
            >
              <option value={1}>ترم 1</option>
              <option value={2}>ترم 2</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-3 bg-brand-blue hover:bg-brand-sky text-white px-6 py-4 rounded-2xl font-bold shadow-lg shadow-brand-blue/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "جاري الحفظ..." : "متابعة"}
          </button>
        </form>
      </div>
    </div>
  );
}
