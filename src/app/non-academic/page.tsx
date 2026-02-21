"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SubjectsGrid } from "../../components/SubjectsGrid";
import { BookOpen, ShieldAlert } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

export default function NonAcademicPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkAccess() {
      if (authLoading) return;

      if (!user) {
        setIsAuthorized(false);
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("show_extra_assets")
        .eq("id", user.id)
        .single();

      if (error || !data?.show_extra_assets) {
        setIsAuthorized(false);
        router.replace("/");
      } else {
        setIsAuthorized(true);
      }
    }

    checkAccess();
  }, [user, authLoading, router]);

  const handleSubjectClick = (subjectName: string) => {
    router.push(`/non-academic/${encodeURIComponent(subjectName)}`);
  };

  if (authLoading || isAuthorized === null) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-brand-blue/20 border-t-brand-blue rounded-full animate-spin" />
        <p className="text-slate-500 font-bold animate-pulse">
          Authenticating...
        </p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
          Access Denied
        </h1>
        <p className="text-slate-500">
          System authentication failed. Redirecting...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center justify-center p-3 bg-brand-blue/10 rounded-2xl mb-4">
          <BookOpen className="w-8 h-8 text-brand-blue" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
          TRW
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-lg">
          Welcome to the Real World
        </p>
      </div>

      <div className="modern-card p-6 sm:p-8">
        <SubjectsGrid onSubjectClick={handleSubjectClick} is_academic={false} />
      </div>
    </div>
  );
}
